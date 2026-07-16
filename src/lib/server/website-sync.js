// Website Knowledge Sync — turn an operator's public website into knowledge.
//
// It reuses the exact same pipeline as manual knowledge: a discovered page
// becomes a `knowledge_items` row (metadata.source = 'website') and is embedded
// via reingestItem, so retrieval/answering already merges website + AI Knowledge
// with no new "priority engine" needed. No crawler jargon leaks to the operator.
//
// Scan = fast URL discovery (sitemap → links) + URL-based categorisation.
// Import = fetch + extract readable text + embed the pages the operator approved.
import { supabase } from '$lib/server/supabase.js';
import { reingestItem } from '$lib/server/rag.js';

const UA = 'Mozilla/5.0 (compatible; MakutanoBot/1.0; +https://ai.makutano.co.tz)';
const ITEM_COLS = 'id, client_id, title, body, category, price_amount, price_currency, metadata';
const MAX_IMPORT = 40; // pages embedded per import run
const MAX_TEXT = 9000; // chars of extracted body per page

/** Fetch a URL as text with a browser-ish UA and a hard timeout. Null on failure. */
async function fetchText(url, timeout = 9000) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeout);
	try {
		const res = await fetch(url, {
			headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml,*/*' },
			redirect: 'follow',
			signal: ctrl.signal
		});
		if (!res.ok) return null;
		return await res.text();
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
	let fetched = 0;
	while (queue.length && fetched < 12 && pages.size < 300) {
		const sm = queue.shift();
		if (seen.has(sm)) continue;
		seen.add(sm);
		const xml = await fetchText(sm, 8000);
		if (!xml) continue;
		fetched++;
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

// Fallback when there's no sitemap: same-origin links off the homepage.
async function discoverFromHomepage(url) {
	const html = await fetchText(url.href);
	if (!html) return [];
	const hrefs = new Set();
	const re = /<a[^>]+href=["']([^"']+)["']/gi;
	let m;
	while ((m = re.exec(html)) !== null) {
		try {
			const abs = new URL(m[1], url.href);
			if (abs.origin === url.origin) hrefs.add(abs.href.split('#')[0]);
		} catch {
			/* ignore bad hrefs */
		}
	}
	return [...hrefs];
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

// ---- Public API ------------------------------------------------------------

/**
 * Fast scan: discover pages and group them, WITHOUT downloading every page —
 * so the operator gets an instant "23 pages found · 9 tours…" preview.
 */
export async function scanWebsite(input, { max = 60 } = {}) {
	const base = normalizeBase(input);
	if (!base) return { error: 'Please enter a valid website address, e.g. https://yourbusiness.com' };

	let urls = await discoverFromSitemaps(base.origin);
	let via = 'sitemap';
	if (!urls.length) {
		urls = await discoverFromHomepage(base);
		via = 'links';
	}
	urls.unshift(`${base.origin}/`);
	urls = [...new Set(urls.map((u) => u.split('#')[0]))].filter((u) => !isNonContent(u)).slice(0, max);

	if (!urls.length) {
		return { error: "We couldn't find any pages on that website. Double-check the address and try again." };
	}

	const pages = urls.map((u) => ({ url: u, label: prettyLabel(u), category: categorize(u) }));
	const counts = {};
	for (const p of pages) counts[p.category] = (counts[p.category] || 0) + 1;
	return { origin: base.origin, via, total: pages.length, counts, pages };
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
	let imported = 0;
	const failed = [];

	for (const url of list) {
		const html = await fetchText(url);
		if (!html) {
			failed.push(`${prettyLabel(url)}: couldn't open the page`);
			continue;
		}
		const { title, text } = htmlToText(html);
		const body = text.slice(0, MAX_TEXT);
		if (body.length < 140) {
			failed.push(`${prettyLabel(url)}: not enough readable content`);
			continue;
		}
		const row = {
			client_id: clientId,
			title: title || prettyLabel(url),
			body,
			category: categorize(url, title),
			metadata: { source: 'website', source_url: url, last_synced: now }
		};

		// Update the existing item for this URL, or insert a new one.
		const { data: existing } = await supabase
			.from('knowledge_items')
			.select('id')
			.eq('client_id', clientId)
			.contains('metadata', { source_url: url })
			.maybeSingle();

		let item, error;
		if (existing) {
			({ data: item, error } = await supabase
				.from('knowledge_items')
				.update({ ...row, updated_at: now })
				.eq('id', existing.id)
				.select(ITEM_COLS)
				.single());
		} else {
			({ data: item, error } = await supabase.from('knowledge_items').insert(row).select(ITEM_COLS).single());
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
