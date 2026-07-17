// Website Knowledge Sync — turn an operator's public website into knowledge.
//
// It reuses the exact same pipeline as manual knowledge: a discovered page
// becomes a `knowledge_items` row (metadata.source = 'website') and is embedded
// via reingestItem, so retrieval/answering already merges website + AI Knowledge
// with no new "priority engine" needed. No crawler jargon leaks to the operator.
//
// Scan = fast URL discovery (sitemap → links) + URL-based categorisation.
// Import = fetch + extract readable text + embed the pages the operator approved.
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { env } from '$env/dynamic/private';
import { supabase } from '$lib/server/supabase.js';
import { reingestItem } from '$lib/server/rag.js';
import { embedQuery } from '$lib/server/embeddings.js';
import { customerQuestions } from '$lib/server/dashboard.js';

const UA = 'Mozilla/5.0 (compatible; MakutanoBot/1.0; +https://ai.makutano.co.tz)';
const ITEM_COLS = 'id, client_id, title, body, category, price_amount, price_currency, metadata';
const MAX_IMPORT = 40; // pages embedded per import run
const MAX_RESYNC = 100; // pages re-checked per re-sync run (stalest first)
const MAX_TEXT = 9000; // chars of extracted body per page
// Escape hatch for local dev/testing against localhost. NEVER set in production.
const ALLOW_PRIVATE = env.WEBSITE_SYNC_ALLOW_PRIVATE === 'on';
// Clients with a re-sync in progress — prevents a manual re-sync and the scheduler
// (or a double-click) from re-embedding the same items concurrently, which would
// race in reingestItem's non-atomic delete-then-insert.
const resyncing = new Set();

// ---- SSRF guard ------------------------------------------------------------
// We fetch operator-supplied and stored URLs server-side (scan, import, and the
// background re-sync), so a URL pointing at a private/loopback/link-local host
// (cloud metadata 169.254.169.254, Caddy admin on localhost, RFC-1918 LAN, …)
// must be refused — including after a redirect.

function ipIsPrivate(ip) {
	const v = isIP(ip);
	if (v === 4) {
		const p = ip.split('.').map(Number);
		return (
			p[0] === 0 || p[0] === 10 || p[0] === 127 || // this-network, private, loopback
			(p[0] === 169 && p[1] === 254) || // link-local + cloud metadata
			(p[0] === 172 && p[1] >= 16 && p[1] <= 31) || // private
			(p[0] === 192 && p[1] === 168) || // private
			(p[0] === 100 && p[1] >= 64 && p[1] <= 127) || // CGNAT
			p[0] >= 224 // multicast/reserved
		);
	}
	if (v === 6) {
		const s = ip.toLowerCase();
		if (s.startsWith('::ffff:')) return ipIsPrivate(s.slice(7)); // IPv4-mapped
		return s === '::1' || s === '::' || s.startsWith('fe80') || s.startsWith('fc') || s.startsWith('fd');
	}
	return true; // unknown → refuse
}

/** True if it's safe to fetch this URL (public http/https host). */
async function urlIsSafe(u) {
	if (ALLOW_PRIVATE) return /^https?:\/\//i.test(u);
	let url;
	try {
		url = new URL(u);
	} catch {
		return false;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
	const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
	if (isIP(host)) return !ipIsPrivate(host);
	try {
		const { address } = await lookup(host);
		return !ipIsPrivate(address);
	} catch {
		return false; // unresolvable → refuse
	}
}

/** Fetch a URL as text with a browser-ish UA, a hard timeout, and SSRF checks on
 *  every hop (redirects are followed manually so we can vet each target). */
async function fetchText(url, timeout = 9000) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeout);
	try {
		let current = url;
		for (let hop = 0; hop < 5; hop++) {
			if (!(await urlIsSafe(current))) return null;
			const res = await fetch(current, {
				headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml,*/*' },
				redirect: 'manual',
				signal: ctrl.signal
			});
			if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
				try {
					current = new URL(res.headers.get('location'), current).href;
				} catch {
					return null;
				}
				continue;
			}
			if (!res.ok) return null;
			// Cap body size so one huge/hostile page can't spike memory (worse under
			// the crawler's concurrency). Skip on a large declared length; hard-cap the
			// buffered text as a backstop.
			if (Number(res.headers.get('content-length') || 0) > 6_000_000) return null;
			const body = await res.text();
			return body.length > 6_000_000 ? body.slice(0, 6_000_000) : body;
		}
		return null; // too many redirects
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

function normalizeBase(input) {
	let u = String(input ?? '').trim();
	if (!u) return null;
	if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
	try {
		return new URL(u);
	} catch {
		return null;
	}
}

function decodeEntities(s) {
	return String(s)
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}

// ---- Page discovery --------------------------------------------------------

function extractLocs(xml) {
	const out = [];
	const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
	let m;
	while ((m = re.exec(xml)) !== null) out.push(decodeEntities(m[1]));
	return out;
}

// Walk sitemap.xml (and sitemap indexes) to collect page URLs. Bounded.
async function discoverFromSitemaps(origin) {
	const start = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
	const robots = await fetchText(`${origin}/robots.txt`, 6000);
	if (robots) {
		for (const line of robots.split('\n')) {
			const m = line.match(/^\s*sitemap:\s*(\S+)/i);
			if (m) start.push(m[1].trim());
		}
	}
	const queue = [...new Set(start)];
	const seen = new Set();
	const pages = new Set();
	let attempts = 0; // bound total fetches (incl. failures), not just successes
	while (queue.length && attempts < 15 && pages.size < 300) {
		const sm = queue.shift();
		if (seen.has(sm)) continue;
		seen.add(sm);
		attempts++;
		const xml = await fetchText(sm, 8000);
		if (!xml) continue;
		const isIndex = /<sitemapindex/i.test(xml);
		for (const loc of extractLocs(xml)) {
			if (isIndex || /\.xml(\?|$)/i.test(loc)) {
				if (!seen.has(loc)) queue.push(loc);
			} else {
				pages.add(loc);
			}
		}
	}
	return [...pages];
}

// Normalise a URL for dedup: drop the fragment and common tracking params so the
// same page under ?utm_*/fbclid/etc. isn't crawled or listed multiple times.
function normUrl(u) {
	try {
		const url = new URL(u);
		url.hash = '';
		for (const k of [...url.searchParams.keys()]) {
			if (/^(utm_|fbclid|gclid|mc_|igshid|ref_)/i.test(k) || k.toLowerCase() === 'ref') url.searchParams.delete(k);
		}
		return url.href;
	} catch {
		return String(u).split('#')[0];
	}
}

// Rank URLs so a bounded crawl spends its budget on itinerary-like pages and the
// index pages that link to them, before generic pages.
function crawlPriority(url) {
	const s = url.toLowerCase();
	if (/(itinerar|\bsafari|\btour\b|package|expedition|excursion|\d+[-\s]?day|day[-\s]?(trip|tour)|holiday|adventure|\btrek|climb|honeymoon|gorilla|migration)/.test(s)) return 3;
	if (/\/(tours?|safaris?|packages?|itinerar\w*|destinations?|trips?|experiences?|holidays?|adventures?)\/?$/.test(s)) return 2; // index/listing pages
	return 1;
}

// Deep discovery: a bounded, same-origin breadth-first crawl that follows links
// several levels in — so itinerary pages reachable only from a /tours listing
// (never the homepage) are found even when the site has no sitemap. Reuses the
// SSRF-guarded fetchText, stays on-origin, skips non-content, and is bounded by
// page count, depth, and a wall-clock budget so it always terminates.
async function crawlSite(base, { maxPages = 150, maxDepth = 3, timeBudgetMs = 30000, concurrency = 6, seeds = [] } = {}) {
	const origin = base.origin;
	const seen = new Set();
	const content = new Set();
	const frontier = [];
	const enqueue = (u, depth) => {
		const clean = normUrl(u);
		if (seen.has(clean) || isNonContent(clean)) return;
		seen.add(clean);
		frontier.push({ url: clean, depth });
	};
	enqueue(`${origin}/`, 0);
	for (const s of seeds) {
		try {
			if (new URL(s).origin === origin) enqueue(s, 1);
		} catch {
			/* ignore bad seed */
		}
	}

	const deadline = Date.now() + timeBudgetMs;
	while (frontier.length && content.size < maxPages && Date.now() < deadline) {
		// Fetch the highest-priority, shallowest URLs first.
		frontier.sort((a, b) => crawlPriority(b.url) - crawlPriority(a.url) || a.depth - b.depth);
		const batch = frontier.splice(0, concurrency);
		const fetched = await Promise.all(batch.map((it) => fetchText(it.url, 8000).then((html) => ({ ...it, html }))));
		for (const { url, depth, html } of fetched) {
			if (!html) continue;
			content.add(url);
			if (depth >= maxDepth) continue;
			const re = /<a[^>]+href=["']([^"']+)["']/gi;
			let m;
			while ((m = re.exec(html)) !== null) {
				try {
					const abs = new URL(m[1], url);
					if (abs.origin === origin) enqueue(abs.href, depth + 1);
				} catch {
					/* bad href */
				}
			}
		}
	}
	return [...content];
}

function isNonContent(url) {
	return (
		/\.(jpe?g|png|gif|webp|svg|pdf|zip|css|js|ico|xml|json|mp4|mp3|woff2?)(\?|$)/i.test(url) ||
		/\/(cart|checkout|account|login|sign-?in|wp-admin|wp-login|feed|tag\/|author\/|search)/i.test(url)
	);
}

function categorize(url, title = '') {
	const s = `${url} ${title}`.toLowerCase();
	if (/(faq|frequently|question|q&a|q-and-a)/.test(s)) return 'FAQ';
	if (/(blog|article|guide|tips|news|story|journal)/.test(s)) return 'Travel guide';
	if (/(accommodation|lodge|hotel|camp|stay|resort|room)/.test(s)) return 'Accommodation';
	if (/(transport|transfer|flight|shuttle|logistics)/.test(s)) return 'Transport';
	if (/(policy|policies|terms|privacy|refund|cancellation|conditions)/.test(s)) return 'Policy';
	if (/(destination|park|reserve|zanzibar|serengeti|ngorongoro|kilimanjaro|region)/.test(s)) return 'Destination';
	if (/(tour|safari|package|itinerary|trip|excursion|expedition|holiday|adventure|\bday\b)/.test(s)) return 'Tour';
	if (/(about|contact|home)/.test(s)) return 'About';
	return 'Website page';
}

function prettyLabel(url) {
	try {
		const p = new URL(url);
		const seg = p.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop();
		if (!seg) return p.hostname.replace(/^www\./, '');
		return decodeURIComponent(seg)
			.replace(/\.\w+$/, '')
			.replace(/[-_]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	} catch {
		return url;
	}
}

// ---- HTML → readable text --------------------------------------------------

function htmlToText(html) {
	const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
	const ti = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
	const title = decodeEntities((og?.[1] || ti?.[1] || h1?.[1] || '').replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();

	let s = html
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
		.replace(/<(nav|footer|header|form|svg)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<\/(p|div|li|h[1-6]|section|article|tr|br)\s*>/gi, '\n')
		.replace(/<[^>]+>/g, ' ');
	s = decodeEntities(s)
		.replace(/[ \t\f\v]+/g, ' ')
		.replace(/\n[ \t]*/g, '\n')
		.replace(/\n{2,}/g, '\n')
		.trim();
	return { title, text: s };
}

// ---- Best-effort structured extraction (price, duration) -------------------

const CUR = { $: 'USD', '€': 'EUR', '£': 'GBP', usd: 'USD', eur: 'EUR', gbp: 'GBP', tzs: 'TZS', tsh: 'TZS', kes: 'KES', ksh: 'KES' };

// Pull a headline price only when a currency is explicit (so we never grab a
// phone number or year). Prefer amounts sitting near price/from/per-person words.
function extractPrice(text) {
	const t = String(text ?? '').slice(0, 7000);
	const re = /(usd|eur|gbp|tzs|tsh|kes|ksh|\$|€|£)\s*([\d][\d,]{1,})|([\d][\d,]{1,})\s*(usd|eur|gbp|tzs|tsh|kes|ksh)/gi;
	let best = null;
	let m;
	while ((m = re.exec(t)) !== null) {
		const cur = CUR[(m[1] || m[4] || '').toLowerCase()];
		const amount = Number(String(m[2] || m[3]).replace(/,/g, ''));
		if (!cur || !amount || amount < 10 || amount > 100000000) continue;
		const ctx = t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 24).toLowerCase();
		const score = (/(price|from|cost|per person|per pax|\bpp\b|package|rate)/.test(ctx) ? 2 : 0);
		if (!best || score > best.score) best = { amount, currency: cur, score };
	}
	return best ? { amount: best.amount, currency: best.currency } : null;
}

function extractDuration(text) {
	const m = String(text ?? '').match(/\b(\d{1,2})\s*[-\s]?\s*days?\b(?:[^\n.]{0,20}?\b(\d{1,2})\s*nights?\b)?/i);
	if (!m) return null;
	return m[2] ? `${m[1]} Days / ${m[2]} Nights` : `${m[1]} Days`;
}

function contentHash(s) {
	return createHash('sha1').update(String(s ?? '')).digest('hex').slice(0, 16);
}

// ---- Conflict detection (website vs AI Knowledge) --------------------------

function normTitle(s) {
	return String(s ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\b(the|a|an|of|from|to|in|and|day|days|tour|safari|package|trip|our)\b/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
function tokenOverlap(a, b) {
	const A = new Set(a.split(' ').filter(Boolean));
	const B = new Set(b.split(' ').filter(Boolean));
	if (!A.size || !B.size) return 0;
	let inter = 0;
	for (const w of A) if (B.has(w)) inter++;
	return inter / new Set([...A, ...B]).size;
}

/**
 * Conservative: flag only when a website page and a manually-kept item clearly
 * describe the same thing (matching title) and quote a DIFFERENT price in the
 * SAME currency. Everything else is left alone — never a false alarm on price.
 */
export function detectConflicts(items) {
	const web = (items ?? []).filter((i) => i?.metadata?.source === 'website' && i.price_amount != null && !i.metadata?.price_dismissed);
	const manual = (items ?? []).filter((i) => i?.metadata?.source !== 'website' && i.price_amount != null);
	const out = [];
	for (const w of web) {
		const wn = normTitle(w.title);
		if (!wn) continue;
		const match = manual.find((m) => {
			const mn = normTitle(m.title);
			return mn && (mn === wn || tokenOverlap(mn, wn) >= 0.6);
		});
		if (!match || w.price_currency !== match.price_currency) continue;
		const wp = Number(w.price_amount);
		const mp = Number(match.price_amount);
		if (Math.max(wp, mp) > 0 && Math.abs(wp - mp) / Math.max(wp, mp) > 0.02) {
			out.push({
				currency: w.price_currency ?? 'USD',
				website: { id: w.id, title: w.title, amount: wp, url: w.metadata?.source_url ?? null },
				knowledge: { id: match.id, title: match.title, amount: mp }
			});
		}
	}
	return out;
}

/** Resolve one price conflict: adopt the website price, or keep the saved one. */
export async function resolveConflict(clientId, { action, websiteId, knowledgeId }) {
	const [{ data: web }, { data: kn }] = await Promise.all([
		supabase.from('knowledge_items').select(ITEM_COLS).eq('id', websiteId).eq('client_id', clientId).maybeSingle(),
		supabase.from('knowledge_items').select(ITEM_COLS).eq('id', knowledgeId).eq('client_id', clientId).maybeSingle()
	]);
	if (!web || !kn) return { error: 'That item no longer exists.' };
	const now = new Date().toISOString();

	if (action === 'useWebsite') {
		// The website is right → update AI Knowledge to match, and re-learn it.
		const { data: updated, error } = await supabase
			.from('knowledge_items')
			.update({ price_amount: web.price_amount, price_currency: web.price_currency, updated_at: now })
			.eq('id', kn.id)
			.select(ITEM_COLS)
			.single();
		if (error) return { error: error.message };
		await reingestItem(updated);
		return { ok: `Updated “${kn.title}” to ${web.price_currency} ${Number(web.price_amount).toLocaleString()}.` };
	}
	// keepKnowledge: the saved price is right → align the website item so it stops
	// contradicting, and mark it resolved.
	const meta = { ...(web.metadata ?? {}), price_dismissed: true };
	const { data: updated, error } = await supabase
		.from('knowledge_items')
		.update({ price_amount: kn.price_amount, price_currency: kn.price_currency, metadata: meta, updated_at: now })
		.eq('id', web.id)
		.select(ITEM_COLS)
		.single();
	if (error) return { error: error.message };
	await reingestItem(updated);
	return { ok: `Kept your saved price for “${kn.title}”.` };
}

// ---- Public API ------------------------------------------------------------

/**
 * Fast scan: discover pages and group them, WITHOUT downloading every page —
 * so the operator gets an instant "23 pages found · 9 tours…" preview.
 */
export async function scanWebsite(input, { max = 60, deep = false } = {}) {
	const base = normalizeBase(input);
	if (!base) return { error: 'Please enter a valid website address, e.g. https://yourbusiness.com' };

	// Deep scan casts a much wider net; the fast scan stays capped for speed.
	const cap = deep ? Math.max(max, 250) : max;

	let urls;
	let via;
	if (deep) {
		// Crawl the whole site AND read the sitemap, then merge — so we catch pages
		// the sitemap omits and pages no sitemap lists.
		const [sitemapUrls, crawledUrls] = await Promise.all([
			discoverFromSitemaps(base.origin),
			crawlSite(base, { maxPages: cap, maxDepth: 3, timeBudgetMs: 30000 })
		]);
		urls = [...sitemapUrls, ...crawledUrls];
		via = 'deep';
	} else {
		urls = await discoverFromSitemaps(base.origin);
		via = 'sitemap';
		if (!urls.length) {
			// No sitemap → a quick 2-level crawl (better than homepage-only).
			urls = await crawlSite(base, { maxPages: cap, maxDepth: 2, timeBudgetMs: 15000 });
			via = 'links';
		}
	}
	const home = `${base.origin}/`;
	urls = [...new Set(urls.map(normUrl))].filter((u) => !isNonContent(u));
	if (!urls.length) {
		return { error: "We couldn't find any pages on that website. Double-check the address and try again." };
	}
	if (!urls.includes(home)) urls.unshift(home);
	// Rank so the homepage stays first and itinerary/tour pages survive the cap —
	// never truncated in favour of generic pages the crawl/sitemap also returned.
	urls.sort((a, b) => (a === home ? -1 : b === home ? 1 : crawlPriority(b) - crawlPriority(a)));
	urls = urls.slice(0, cap);

	const pages = urls.map((u) => ({ url: u, label: prettyLabel(u), category: categorize(u) }));
	const counts = {};
	for (const p of pages) counts[p.category] = (counts[p.category] || 0) + 1;
	return { origin: base.origin, via, total: pages.length, counts, pages };
}

/**
 * Fetch one URL and turn it into a knowledge_items row (readable text + best-effort
 * price/duration + a content hash). `prevMeta` is preserved (so flags like
 * price_dismissed / auto_sync survive a re-sync). Returns { row, hash } or { error }.
 */
async function fetchPageRow(clientId, url, now, prevMeta = {}) {
	const html = await fetchText(url);
	if (!html) return { error: `${prettyLabel(url)}: couldn't open the page` };
	const { title, text } = htmlToText(html);
	const body = text.slice(0, MAX_TEXT);
	if (body.length < 140) return { error: `${prettyLabel(url)}: not enough readable content` };

	const hash = contentHash(body);
	const price = extractPrice(body);
	const duration = extractDuration(body);
	// Best-effort structured fields so the AI answers with real prices/duration
	// and so conflicts can be detected against AI Knowledge.
	const metadata = { ...prevMeta, source: 'website', source_url: url, last_synced: now, hash };
	if (duration) metadata.duration = duration;
	else delete metadata.duration;
	const row = {
		client_id: clientId,
		title: title || prettyLabel(url),
		body,
		category: categorize(url, title),
		// Always write price so a page that DROPS its price clears the old value,
		// rather than the assistant quoting a number no longer on the site.
		price_amount: price ? price.amount : null,
		price_currency: price ? price.currency : null,
		metadata
	};
	return { row, hash };
}

/** True if the client currently has weekly auto-sync enabled (flag lives on any
 *  of their website items' metadata). */
async function clientHasAutoSync(clientId) {
	const { data } = await supabase
		.from('knowledge_items')
		.select('id')
		.eq('client_id', clientId)
		.contains('metadata', { source: 'website', auto_sync: true })
		.limit(1);
	return !!(data && data.length);
}

/**
 * Import (approve): re-fetch each approved URL, extract readable text, and store
 * it as a knowledge item that the AI can use — updating in place if the page was
 * imported before (so re-syncing never duplicates). Returns a per-page summary.
 */
export async function importWebsitePages(clientId, urls) {
	const list = (Array.isArray(urls) ? urls : []).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, MAX_IMPORT);
	if (!list.length) return { imported: 0, failed: ['No pages selected.'] };

	const now = new Date().toISOString();
	// If the client already has auto-sync on, new pages inherit it — otherwise a
	// page added after enabling auto-sync would silently be left out of it.
	const clientAutoSync = await clientHasAutoSync(clientId);
	let imported = 0;
	const failed = [];

	for (const url of list) {
		// Preserve any prior metadata (e.g. a resolved price, auto-sync flag).
		const { data: existing } = await supabase
			.from('knowledge_items')
			.select('id, metadata')
			.eq('client_id', clientId)
			.contains('metadata', { source_url: url })
			.maybeSingle();

		const built = await fetchPageRow(clientId, url, now, existing?.metadata ?? {});
		if (built.error) {
			failed.push(built.error);
			continue;
		}
		if (!existing && clientAutoSync) built.row.metadata.auto_sync = true;

		let item, error;
		if (existing) {
			({ data: item, error } = await supabase
				.from('knowledge_items')
				.update({ ...built.row, updated_at: now })
				.eq('id', existing.id)
				.select(ITEM_COLS)
				.single());
		} else {
			({ data: item, error } = await supabase.from('knowledge_items').insert(built.row).select(ITEM_COLS).single());
		}
		if (error) {
			failed.push(`${prettyLabel(url)}: ${error.message}`);
			continue;
		}

		try {
			await reingestItem(item);
			imported++;
		} catch (e) {
			failed.push(`${prettyLabel(url)}: saved but couldn't be learned — ${e.message}`);
		}
	}

	return { imported, failed };
}

/**
 * Change monitoring: re-fetch every connected website page, and only re-embed the
 * ones whose content actually changed (compared via content hash). Unchanged pages
 * just get their "last synced" bumped — no wasted embedding cost. `force` re-embeds
 * everything regardless. Returns { checked, updated, unchanged, failed }.
 */
export async function resyncWebsitePages(clientId, { force = false } = {}) {
	if (resyncing.has(clientId)) return { checked: 0, updated: 0, unchanged: 0, failed: [], skipped: true };
	resyncing.add(clientId);
	try {
		const { data: items } = await supabase
			.from('knowledge_items')
			.select('id, metadata')
			.eq('client_id', clientId)
			.contains('metadata', { source: 'website' });
		// Oldest-checked first, so if a client has more pages than one run can cover,
		// successive runs rotate through the stale ones instead of the same arbitrary set.
		const list = (items ?? [])
			.filter((i) => i.metadata?.source_url)
			.sort((a, b) => (a.metadata?.last_synced ?? '') < (b.metadata?.last_synced ?? '') ? -1 : 1)
			.slice(0, MAX_RESYNC);
		if (!list.length) return { checked: 0, updated: 0, unchanged: 0, failed: [] };

		const now = new Date().toISOString();
		let updated = 0;
		let unchanged = 0;
		const failed = [];

		for (const it of list) {
			const url = it.metadata.source_url;
			const built = await fetchPageRow(clientId, url, now, it.metadata ?? {});
			if (built.error) {
				failed.push(built.error);
				continue;
			}
			// Unchanged → just record that we checked; never re-embed (saves cost).
			if (!force && built.hash === it.metadata?.hash) {
				await supabase
					.from('knowledge_items')
					.update({ metadata: { ...(it.metadata ?? {}), last_synced: now } })
					.eq('id', it.id)
					.eq('client_id', clientId);
				unchanged++;
				continue;
			}
			const { data: saved, error } = await supabase
				.from('knowledge_items')
				.update({ ...built.row, updated_at: now })
				.eq('id', it.id)
				.eq('client_id', clientId)
				.select(ITEM_COLS)
				.single();
			if (error) {
				failed.push(`${prettyLabel(url)}: ${error.message}`);
				continue;
			}
			try {
				await reingestItem(saved);
				updated++;
			} catch (e) {
				failed.push(`${prettyLabel(url)}: saved but couldn't be learned — ${e.message}`);
			}
		}

		return { checked: list.length, updated, unchanged, failed };
	} finally {
		resyncing.delete(clientId);
	}
}

/**
 * Turn weekly auto-sync on/off for a client. There's no client settings table, so
 * the flag lives on the website items' metadata (the same jsonb the rest of this
 * feature uses) — the scheduler reads it back from there.
 */
export async function setAutoSync(clientId, on) {
	const { data: items } = await supabase
		.from('knowledge_items')
		.select('id, metadata')
		.eq('client_id', clientId)
		.contains('metadata', { source: 'website' });
	const list = items ?? [];
	if (!list.length) return { error: 'Connect at least one website page before turning on auto-sync.' };
	for (const it of list) {
		await supabase
			.from('knowledge_items')
			.update({ metadata: { ...(it.metadata ?? {}), auto_sync: !!on } })
			.eq('id', it.id)
			.eq('client_id', clientId);
	}
	return { ok: on ? 'Auto-sync on — your website is checked weekly and updated when it changes.' : 'Auto-sync turned off.' };
}

// Similarity (1 = identical) below which a customer question looks uncovered by
// the current knowledge base. Voyage-3 well-covered questions score ~0.6–0.8.
const GAP_THRESHOLD = 0.5;

/**
 * AI gap suggestions: find questions customers asked that the knowledge base
 * barely covers (low retrieval similarity), and — when possible — suggest an
 * un-imported website page that likely answers them. Reuses match_chunks, so it
 * measures exactly what the live assistant would have retrieved. On-demand only
 * (it embeds each question), never on page load.
 */
export async function findKnowledgeGaps(clientId, { limit = 12 } = {}) {
	const { data: convs } = await supabase
		.from('conversations')
		.select('messages, summary, created_at')
		.eq('client_id', clientId)
		.order('created_at', { ascending: false })
		.limit(120);
	const questions = customerQuestions(convs ?? [], limit)
		.map((q) => ({ question: q.q.replace(/…$/, '').trim(), count: q.count }))
		.filter((x) => x.question.length >= 6);
	if (!questions.length) return { gaps: [], checked: 0 };

	// Score each question against current coverage.
	const gaps = [];
	for (const item of questions) {
		let best = 1; // on any error, don't flag it as a gap
		try {
			const emb = await embedQuery(item.question, { clientId, feature: 'website_sync' });
			const { data } = await supabase.rpc('match_chunks', {
				p_client_id: clientId,
				p_query_embedding: emb,
				p_match_count: 3
			});
			best = (data ?? []).reduce((a, r) => Math.max(a, r.similarity ?? 0), 0);
		} catch {
			best = 1;
		}
		if (best < GAP_THRESHOLD) gaps.push({ ...item, score: Number(best.toFixed(2)) });
	}
	if (!gaps.length) return { gaps: [], checked: questions.length };

	// Best-effort: suggest an un-imported website page for each gap.
	const [{ data: client }, { data: webItems }] = await Promise.all([
		supabase.from('clients').select('website_url').eq('id', clientId).maybeSingle(),
		supabase.from('knowledge_items').select('metadata').eq('client_id', clientId).contains('metadata', { source: 'website' })
	]);
	const connected = new Set((webItems ?? []).map((i) => i.metadata?.source_url).filter(Boolean));
	let candidates = [];
	if (client?.website_url) {
		const scan = await scanWebsite(client.website_url);
		if (!scan.error) candidates = scan.pages.filter((p) => !connected.has(p.url));
	}
	for (const g of gaps) {
		if (!candidates.length) continue;
		const qn = normTitle(g.question);
		let bestP = null;
		let bestScore = 0;
		for (const p of candidates) {
			const s = tokenOverlap(qn, normTitle(`${p.label} ${p.category}`));
			if (s > bestScore) {
				bestScore = s;
				bestP = p;
			}
		}
		if (bestP && bestScore >= 0.12) g.suggestion = { url: bestP.url, label: bestP.label, category: bestP.category };
	}
	return { gaps, checked: questions.length };
}
