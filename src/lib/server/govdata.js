// Live TAUSI public-data lookups for the AI assistant.
//
// These hit VERIFIED PUBLIC TAUSI endpoints (no auth, no PII) at request time so
// the assistant answers on CURRENT data instead of stale snapshots. Covered:
//   Land sales   — per-council summaries, projects per council, lot-use
//   House rent   — government rental projects per council
//   By-laws      — published legislation, councils with by-laws, by-law detail
//   Taxpayer     — taxpayer categories (reference)
//   Auctions     — public e-auction listings
// Anything transactional / per-user (licences, tax bills, payments, owners,
// plot-level price & size) needs the citizen's OWN Bearer token and is NOT here.
//
// Every exported function returns a plain, AI-readable STRING and NEVER throws:
// a timeout / network / geo-block failure degrades to a friendly "couldn't reach
// the service" line. All external free-text is passed through clean() first
// (whitespace/newlines collapsed, length capped) so a verbose or instruction-
// shaped payload can neither bloat tokens nor smuggle structure into the result.
import { env } from '$env/dynamic/private';
import { log } from './whatsapp/logger.js';

// The API gateway. Overridable so a future in-region proxy can be pointed at
// without a code change. Each service sits under `${GW}/<service>/…`.
const GW = (env.TAUSI_GATEWAY_BASE || 'https://tausi.tamisemi.go.tz/kivuko').replace(/\/+$/, '');
// Citizen-facing portal (where they log in to view detail, apply, pay, bid).
const PORTAL = (env.TAUSI_PORTAL_URL || 'https://tausi.tamisemi.go.tz').replace(/\/+$/, '');
const TIMEOUT_MS = 12000;
const PAGE_SIZE = 100;
const LAND = 'tausi-landsales-service';

// What the model should say when TAUSI itself is unreachable. Lead-free: it must
// NOT ask a citizen for contact details — point them to the portal instead.
const UNREACHABLE =
	`The live TAUSI service could not be reached right now, so I can’t pull the current data. ` +
	`Do NOT guess — tell the citizen to try again shortly or use the TAUSI portal directly: [TAUSI portal](${PORTAL}).`;

/** Request `${GW}/<service><path>?params`. Throws on timeout/network/non-2xx; callers wrap. */
async function request(service, path, { params, method = 'GET', body, timeoutMs = TIMEOUT_MS } = {}) {
	const qs = params
		? '?' +
			new URLSearchParams(
				Object.entries(params)
					.filter(([, v]) => v != null && v !== '')
					.map(([k, v]) => [k, String(v)])
			).toString()
		: '';
	const url = `${GW}/${service}${path}${qs}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			method,
			headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal
		});
		const text = await res.text(); // read body before clearing the timer (see whatsapp/client.js)
		clearTimeout(timer);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		try {
			return text ? JSON.parse(text) : {};
		} catch {
			throw new Error('unparseable JSON from TAUSI');
		}
	} catch (err) {
		clearTimeout(timer);
		throw err?.name === 'AbortError' ? new Error('TAUSI request timed out') : err;
	}
}

/** GET helper (the common case). */
const get = (service, path, params) => request(service, path, { params });

/** Pull the array out of the standard `{ data: { itemList | item } }` envelope. */
function listOf(json) {
	const d = json?.data;
	if (!d) return [];
	if (Array.isArray(d.itemList)) return d.itemList;
	if (d.item) return [d.item];
	if (Array.isArray(d)) return d;
	return [];
}

// Strip admin/geography noise words (Swahili + English) so "Dodoma" resolves to
// "Halmashauri ya Jiji la Dodoma" and "Dodoma City" still matches.
const NOISE = /\b(halmashauri|ya|la|jiji|manispaa|mji|wilaya|city|municipal|municipality|council|district|town)\b/gi;
const core = (s) =>
	String(s || '')
		.toLowerCase()
		.replace(NOISE, ' ')
		.replace(/[^a-z0-9']+/g, ' ')
		.trim();

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Plot status codes seen in the land search GeoJSON.
const PLOT_STATUS = { 3: 'Available', 4: 'Reserved', 5: 'Sold', 6: 'Hold', 10: 'On Preview' };
// Parse a possibly comma-formatted number; null unless a positive finite value.
const numPos = (v) => {
	const n = Number(String(v ?? '').replace(/,/g, ''));
	return Number.isFinite(n) && n > 0 ? n : null;
};
const money = (v) => {
	const n = numPos(v);
	return n == null ? null : 'TZS ' + n.toLocaleString('en-US');
};

// Sanitise untrusted TAUSI free-text before it reaches the model: collapse all
// whitespace/newlines to single spaces (defuses multi-line injection structure)
// and cap length (bounds token cost). Applied to every external string we echo.
const clean = (s, max = 140) => {
	let t = String(s ?? '').replace(/\s+/g, ' ').trim();
	if (t.length > max) t = t.slice(0, max).trimEnd() + '…';
	return t;
};

/** First present, non-empty candidate field (cleaned). '' if none. */
const pick = (o, keys, max = 120) => {
	if (!o || typeof o !== 'object') return '';
	for (const k of keys) if (o[k] != null && String(o[k]).trim()) return clean(o[k], max);
	return '';
};

/** Compact "k: v" of an object's scalar fields — fallback for unknown shapes. */
const compactObj = (o, maxFields = 6) => {
	if (!o || typeof o !== 'object') return clean(String(o), 120);
	const parts = [];
	for (const [k, v] of Object.entries(o)) {
		if (v == null || typeof v === 'object') continue;
		parts.push(`${k}: ${clean(String(v), 60)}`);
		if (parts.length >= maxFields) break;
	}
	return parts.join(', ');
};

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const landSummaryPath = (status) => (status === 'sold' ? '/api/v1/land-open-project/sold-council-summary' : '/api/v1/land-open-project/council-summary');
const landProjectPath = (status) => (status === 'sold' ? '/api/v1/land-open-project/sold-council-project' : '/api/v1/land-open-project/council-project');

// ============================ LAND SALES ============================

/** Fetch a council summary as normalised rows { code, name, projects, plots }.
 *  Rows with no usable place-name (blank, or purely admin noise words) are
 *  dropped: they can't be resolved or shown to a citizen, and an unnamed
 *  aggregate/rollup row would otherwise double-count into totals. */
async function summaryRows(status) {
	const rows = listOf(await get(LAND, landSummaryPath(status)));
	return rows
		.map((c) => ({ code: c.administrativeAreaCode, name: c.administrativeAreaName ?? '', projects: num(c.totalProjects), plots: num(c.totalPlots) }))
		.filter((r) => r.code != null && core(r.name));
}

/** Display label for a council row — never a bare empty string. */
const councilLabel = (r) => (r?.name ? clean(r.name, 80) : `area ${r?.code}`);

/** Comma-list of councils that currently have `status` land (for no-match help). */
async function councilList(status) {
	const rows = (await summaryRows(status)).sort((a, b) => b.plots - a.plots).slice(0, 40);
	if (!rows.length) return '';
	return rows.map((r) => `${councilLabel(r)} (${r.code})`).join(', ');
}

/**
 * Resolve a council NAME or numeric code (+ status) to { code, name }.
 * Returns null only for a genuine no-match when the REQUESTED catalogue was
 * actually reached; throws if the requested catalogue could not be fetched, so
 * the caller emits the honest "unreachable" fallback rather than "no such council".
 */
async function resolveCouncil(input, status) {
	const raw = String(input ?? '').trim();
	if (!raw) return null;
	if (/^\d+$/.test(raw)) return { code: raw, name: '' };
	const cq = core(raw);
	if (!cq) return null;
	const cqWords = cq.split(' ').filter(Boolean);
	const tryOrder = status === 'sold' ? ['sold', 'open'] : ['open', 'sold'];
	const primary = tryOrder[0];
	let reachedPrimary = false;
	for (const st of tryOrder) {
		let rows;
		try {
			rows = await summaryRows(st);
			if (st === primary) reachedPrimary = true;
		} catch {
			continue;
		}
		const hits = rows.filter((r) => {
			const cn = core(r.name);
			if (!cn) return false; // blank / all-noise name must never match every query
			return cn.includes(cq) || cq.includes(cn) || cn.split(' ').some((w) => w && cqWords.includes(w));
		});
		if (hits.length) return hits.sort((a, b) => b.plots - a.plots)[0];
	}
	if (!reachedPrimary) throw new Error('TAUSI summaries unreachable');
	return null;
}

// ---- Public tools (each returns an AI-readable string, never throws) --------

/** Per-council totals of land projects & plots. status: 'open' | 'sold'. */
export async function landNationalSummary(status = 'open') {
	const st = status === 'sold' ? 'sold' : 'open';
	try {
		const rows = (await summaryRows(st)).sort((a, b) => b.plots - a.plots);
		if (!rows.length) return `TAUSI reports no ${st === 'sold' ? 'sold' : 'available'} land projects right now.`;
		const total = rows.reduce((a, r) => a + r.plots, 0);
		const shown = rows.slice(0, 25);
		const lines = shown.map((r) => `- ${councilLabel(r)} (code ${r.code}): ${plural(r.projects, 'project')}, ${plural(r.plots, 'plot')}`);
		const more = rows.length > shown.length ? `\n…and ${rows.length - shown.length} more councils.` : '';
		return (
			`Live TAUSI ${st === 'sold' ? 'SOLD' : 'AVAILABLE (open)'} land — ${rows.length} councils, ${total} plots total:\n` +
			lines.join('\n') +
			more +
			`\nAsk about a specific council for its projects (use land_council_projects with the council name or its code).` +
			`\nShare this clickable link so the citizen can view detail, apply and pay: [TAUSI portal](${PORTAL})`
		);
	} catch (err) {
		log.warn('govdata_national_summary_failed', { status: st, error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

/** List projects in one council. `council` may be a name or an area code. */
export async function landCouncilProjects(council, status = 'open') {
	const st = status === 'sold' ? 'sold' : 'open';
	const raw = String(council ?? '').trim();
	if (!raw) return 'Ask the citizen which council or area they are interested in first, then call this tool with that council name.';
	try {
		const resolved = await resolveCouncil(raw, st);
		if (!resolved) {
			let list = '';
			try {
				const l = await councilList(st);
				if (l) list = ` Councils that currently have ${st === 'sold' ? 'sold' : 'available'} land: ${l}.`;
			} catch {
				/* fall through to the plain message */
			}
			return `I couldn’t find a council named “${clean(raw, 60)}” in the TAUSI catalogue.${list} A city or region can cover several councils — ask the citizen which one, or call land_national_summary.`;
		}
		const rows = listOf(await get(LAND, landProjectPath(st), { administrativeAreaCode: resolved.code, pageNo: 0, pageSize: PAGE_SIZE }));
		const label = councilLabel(resolved);
		if (!rows.length) return `No ${st === 'sold' ? 'sold' : 'available'} land projects are listed for ${label} right now.`;
		const shown = rows.slice(0, 20);
		const lines = shown.map((p, i) => {
			const name = clean(p.projectName || p.name || `Project ${p.projectId ?? i + 1}`, 80);
			const desc = clean(p.projectDescription || '', 140);
			const pid = p.projectId ?? p.id ?? '';
			return `${i + 1}. ${name}${desc ? ` — ${desc}` : ''}${pid !== '' ? ` (id ${pid})` : ''}`;
		});
		const capped = rows.length >= PAGE_SIZE;
		const more = capped
			? `\n…and more — over ${PAGE_SIZE} projects in this council; suggest the citizen narrow down (lot use, budget) or browse the TAUSI portal for the full list.`
			: rows.length > shown.length
				? `\n…and ${rows.length - shown.length} more.`
				: '';
		return (
			`${st === 'sold' ? 'Sold' : 'Available'} land projects in ${label} (live from TAUSI):\n` +
			lines.join('\n') +
			more +
			`\nFor plot-by-plot size and price in a project, call project_plots with its id. To apply or pay, the citizen signs in on the TAUSI portal: [TAUSI portal](${PORTAL}).`
		);
	} catch (err) {
		log.warn('govdata_council_projects_failed', { council: raw, status: st, error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

// ---- Tiny in-process TTL cache (plot/geo data only — NEVER PII) ------------
const _cache = new Map();
function cacheGet(key) {
	const e = _cache.get(key);
	if (!e) return undefined;
	if (e.expires <= Date.now()) {
		_cache.delete(key);
		return undefined;
	}
	return e.value;
}
function cacheSet(key, value, ttlMs) {
	_cache.set(key, { value, expires: Date.now() + ttlMs });
}
const SEARCH_TTL_MS = 12 * 60 * 1000; // don't hammer the government API

/**
 * Raw plot features (GeoJSON) for a project, cached ~12 min. The public /search
 * endpoint accepts ONLY an all-zeros body (0 = "no limit"); nulls/omissions
 * return statusCode 21001 with no data — so all four numeric fields are always 0
 * and any price/size narrowing happens client-side. Throws on transport failure.
 */
export async function searchProjectFeatures(projectId) {
	const id = String(projectId ?? '').trim();
	if (!id) return [];
	const key = `search:${id}`;
	const hit = cacheGet(key);
	if (hit) return hit;
	const json = await request(LAND, '/api/v1/land-open-project/search', {
		params: { pageNo: 0, pageSize: 5000 },
		method: 'POST',
		body: { projectId: id, minPrice: 0, maxPrice: 0, minLegalArea: 0, maxLegalArea: 0 },
		timeoutMs: 20000
	});
	const fc = json?.data?.features;
	const feats = Array.isArray(fc) ? fc : Array.isArray(fc?.features) ? fc.features : [];
	cacheSet(key, feats, SEARCH_TTL_MS);
	return feats;
}

/** Official council text for a project: { description, terms, name } or null.
 *  Cached ~12 min. Matches by projectId across the council's open then sold lists. */
export async function projectDescriptionFor(areaCode, projectId) {
	const code = String(areaCode ?? '').trim();
	const pid = String(projectId ?? '').trim();
	if (!code) return null;
	const key = `desc:${code}:${pid}`;
	const hit = cacheGet(key);
	if (hit !== undefined) return hit;
	for (const st of ['open', 'sold']) {
		let rows;
		try {
			rows = listOf(await get(LAND, st === 'sold' ? '/api/v1/land-open-project/sold-council-project' : '/api/v1/land-open-project/council-project', { administrativeAreaCode: code, pageNo: 0, pageSize: 200 }));
		} catch {
			continue;
		}
		const m = rows.find((r) => String(r.projectId ?? r.landProjectId ?? r.id ?? '') === pid) || (rows.length === 1 ? rows[0] : null);
		if (m) {
			const val = { description: String(m.projectDescription || m.description || ''), terms: String(m.termsAndCondition || ''), name: String(m.projectName || '') };
			cacheSet(key, val, SEARCH_TTL_MS);
			return val;
		}
	}
	cacheSet(key, null, SEARCH_TTL_MS);
	return null;
}

/**
 * PUBLIC plot-level detail for one land project: size + price + fees + status per
 * plot (cached via searchProjectFeatures; all-zeros body, client-side price/size
 * filters). Returns a bounded, sorted summary + a sample — never the raw 5000.
 */
export async function projectPlots(projectId, opts = {}) {
	const id = String(projectId ?? '').trim();
	if (!id) return 'Ask which project (its id) first — get ids from land_council_projects — then call this with that project id.';
	const SORTS = { price_asc: 'cheapest first', price_desc: 'most expensive first', size_asc: 'smallest first', size_desc: 'largest first' };
	const sort = SORTS[opts.sort] ? opts.sort : 'price_asc';
	try {
		const feats = await searchProjectFeatures(id);
		let plots = feats.map((ft) => ft?.properties || {}).filter((p) => p && (p.landPlotId != null || p.lotNumber != null || p.block != null));
		if (!plots.length) return `No plot-level detail is available for project “${clean(id, 40)}” right now (it may be sold out, closed, or need a login).`;
		// The public API only accepts an all-zeros body, so narrow client-side.
		const minP = numPos(opts.minPrice), maxP = numPos(opts.maxPrice), minA = numPos(opts.minArea), maxA = numPos(opts.maxArea);
		if (minP != null || maxP != null || minA != null || maxA != null) {
			const priceOf = (p) => numPos(p.price) ?? numPos(p.totalLandPlotCost);
			plots = plots.filter((p) => {
				const pr = priceOf(p), ar = numPos(p.legalArea);
				if (minP != null && (pr == null || pr < minP)) return false;
				if (maxP != null && (pr == null || pr > maxP)) return false;
				if (minA != null && (ar == null || ar < minA)) return false;
				if (maxA != null && (ar == null || ar > maxA)) return false;
				return true;
			});
			if (!plots.length) return `No plots in project “${clean(id, 40)}” match those price/size filters — widen the range or drop a filter.`;
		}

		const projName = clean(plots.find((p) => p.landProjectName)?.landProjectName || id, 80);
		const council = clean(plots.find((p) => p.administrativeAreaName)?.administrativeAreaName || '', 60);
		const statusOf = (p) => PLOT_STATUS[p.plotStatus] ?? (p.plotStatus != null ? String(p.plotStatus) : 'Unknown');

		const counts = {};
		for (const p of plots) counts[statusOf(p)] = (counts[statusOf(p)] || 0) + 1;
		const countStr = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${n} ${s}`).join(', ');

		const available = plots.filter((p) => statusOf(p) === 'Available');
		const header = `Plots in ${projName}${council ? ` (${council})` : ''} — ${plots.length} total: ${countStr}. Live from TAUSI.`;
		// No buyable plots → don't present sold plots' prices as if available, and no "reserve" CTA.
		if (!available.length) {
			return `${header}\nNo plots are available to buy in this project right now. Try another project (land_council_projects) or the TAUSI portal: [TAUSI portal](${PORTAL}).`;
		}
		const pool = available; // ranges / fees / sample are over AVAILABLE plots ONLY
		const areaUnit = clean(pool.find((p) => p.unitOfMeasure)?.unitOfMeasure || 'Sqm', 12);
		const plotPrice = (p) => numPos(p.price) ?? numPos(p.totalLandPlotCost); // numPos treats 0 as absent → real fallback

		// Sort so the citizen's ask (cheapest / largest …) surfaces first WITH its
		// block, lot number and price — nulls always last.
		const keyOf = (p) => (sort.startsWith('size') ? numPos(p.legalArea) : plotPrice(p));
		pool.sort((a, b) => {
			const ka = keyOf(a), kb = keyOf(b);
			if (ka == null && kb == null) return 0;
			if (ka == null) return 1;
			if (kb == null) return -1;
			return sort.endsWith('desc') ? kb - ka : ka - kb;
		});

		const priceNums = pool.map(plotPrice).filter((n) => n != null);
		const areaNums = pool.map((p) => numPos(p.legalArea)).filter((n) => n != null);
		const range = (arr, fmt) => (arr.length ? (Math.min(...arr) === Math.max(...arr) ? fmt(Math.min(...arr)) : `${fmt(Math.min(...arr))}–${fmt(Math.max(...arr))}`) : null);
		const priceRange = range(priceNums, (n) => 'TZS ' + n.toLocaleString('en-US'));
		const areaRange = range(areaNums, (n) => n.toLocaleString('en-US'));

		const sample = pool.slice(0, 10).map((p) => {
			const bits = [];
			if (p.block != null || p.lotNumber != null) bits.push(`Block ${clean(p.block ?? '?', 10)}, Lot ${clean(p.lotNumber ?? '?', 10)}`);
			const a = numPos(p.legalArea);
			if (a) bits.push(`${a.toLocaleString('en-US')} ${areaUnit}`);
			const pr = money(plotPrice(p));
			if (pr) bits.push(pr);
			const use = clean(p.lotUse || '', 24);
			if (use) bits.push(use);
			const fi = money(numPos(p.firstInstallmentFee));
			if (fi) bits.push(`1st inst. ${fi}`);
			return `- ${bits.join(' · ') || 'plot'} [${statusOf(p)}]`;
		});
		const more = pool.length > sample.length ? `\n…and ${pool.length - sample.length} more available plots — narrow with min_price/max_price/min_area/max_area, or change sort.` : '';

		const ranges = [priceRange && `Price: ${priceRange}`, areaRange && `Size: ${areaRange} ${areaUnit}`].filter(Boolean).join(' · ');
		const feeMin = (key) => { const ns = pool.map((p) => numPos(p[key])).filter((n) => n != null); return ns.length ? Math.min(...ns) : null; };
		const appFee = money(feeMin('applicationFee'));
		const firstInst = money(feeMin('firstInstallmentFee'));
		const fees = [appFee && `application fee from ${appFee}`, firstInst && `first installment from ${firstInst}`].filter(Boolean).join(', ');

		return (
			header +
			(ranges ? `\n${ranges}` : '') +
			(fees ? `\n(${fees})` : '') +
			`\nAvailable plots (${SORTS[sort]}):\n` +
			sample.join('\n') +
			more +
			`\nThese are live official figures. To reserve or pay, the citizen signs in on the TAUSI portal: [TAUSI portal](${PORTAL}).`
		);
	} catch (err) {
		log.warn('govdata_project_plots_failed', { projectId: id, error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

/** Map council name → administrative area code (across open + sold catalogues). */
export async function landAreaCodes() {
	try {
		const seen = new Map();
		let reached = false;
		for (const st of ['open', 'sold']) {
			let rows;
			try {
				rows = await summaryRows(st);
				reached = true;
			} catch {
				continue;
			}
			for (const r of rows) {
				const cur = seen.get(r.code);
				if (!cur || r.plots > cur.plots) seen.set(r.code, r);
			}
		}
		if (!reached) return UNREACHABLE;
		const rows = [...seen.values()].sort((a, b) => b.plots - a.plots);
		if (!rows.length) return 'TAUSI reports no councils with land right now.';
		const shown = rows.slice(0, 60);
		const lines = shown.map((r) => `- ${councilLabel(r)} — ${r.code}`);
		const more = rows.length > shown.length ? `\n…and ${rows.length - shown.length} more councils.` : '';
		return `Councils with land in the TAUSI portal (name — area code):\n` + lines.join('\n') + more;
	} catch (err) {
		log.warn('govdata_area_codes_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

/** Lot-use reference categories (residential, commercial, …). */
export async function landLotUse() {
	try {
		const rows = listOf(await get(LAND, '/api/v1/land-open-project/lot-use'));
		if (!rows.length) return 'No lot-use categories are published by TAUSI right now.';
		const names = rows.map((r) => clean(typeof r === 'string' ? r : r.name || r.lotUseName || r.description || r.code || '', 60)).filter(Boolean);
		if (!names.length) return 'No lot-use categories are published by TAUSI right now.';
		const shown = names.slice(0, 60);
		return `Lot-use categories in the TAUSI land catalogue: ${shown.join(', ')}${names.length > shown.length ? `, …and ${names.length - shown.length} more` : ''}.`;
	} catch (err) {
		log.warn('govdata_lot_use_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

// ============================ HOUSE RENT ============================

/** Government rental-housing projects per council (counts + region). */
export async function houseRentSummary() {
	try {
		const rows = listOf(await get('tausi-house-rent-service', '/portal/api/v1/projects/summary'));
		if (!rows.length) return 'TAUSI lists no government rental-housing projects right now.';
		const shown = rows.slice(0, 30);
		const lines = shown.map((r) => {
			const name = pick(r, ['administrativeAreaName', 'councilName', 'name'], 80) || 'Council';
			const region = pick(r, ['regionName', 'region'], 40);
			const projects = num(r.totalProjects ?? r.projectCount ?? r.projects);
			const structures = num(r.totalStructures ?? r.structureCount ?? r.structures ?? r.totalHouses);
			const counts = [projects ? plural(projects, 'project') : '', structures ? plural(structures, 'structure') : ''].filter(Boolean).join(', ');
			return `- ${name}${region && region.toLowerCase() !== name.toLowerCase() ? ` (${region})` : ''}${counts ? `: ${counts}` : ''}`;
		});
		const more = rows.length > shown.length ? `\n…and ${rows.length - shown.length} more.` : '';
		return `Government rental-housing (House Rent) projects per council, live from TAUSI:\n` + lines.join('\n') + more + `\nApplying and paying rent needs the citizen’s own login: [TAUSI portal](${PORTAL}).`;
	} catch (err) {
		log.warn('govdata_house_rent_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

// ============================ BY-LAWS ==============================

/** Published council by-laws / revenue legislation. */
export async function publishedLaws(pageNo = 0, pageSize = PAGE_SIZE) {
	const size = num(pageSize) || PAGE_SIZE;
	try {
		const rows = listOf(await get('tausi-council-management-service', '/api/v1/portal/published-law', { pageNo: num(pageNo), pageSize: size }));
		if (!rows.length) return 'No published by-laws are available from TAUSI right now.';
		const shown = rows.slice(0, 40);
		const lines = shown.map((r, i) => {
			const desc = pick(r, ['description', 'lawDescription', 'name', 'title'], 140) || compactObj(r);
			const rev = pick(r, ['revenueSource', 'revenueSourceName'], 60);
			const gfs = pick(r, ['gfsCode', 'gfs'], 30);
			const id = r.lawId ?? r.id ?? '';
			const meta = [rev && `revenue: ${rev}`, gfs && `GFS ${gfs}`, id !== '' && `id ${id}`].filter(Boolean).join(', ');
			return `${i + 1}. ${desc}${meta ? ` (${meta})` : ''}`;
		});
		const more = rows.length > shown.length ? `\n…and ${rows.length - shown.length} more on this page.` : '';
		const pages = rows.length >= size ? `\n(This is a full page — more by-laws may exist; call again with a higher page_no.)` : '';
		return `Published council by-laws / revenue legislation (live from TAUSI):\n` + lines.join('\n') + more + pages + `\nFor the full text of one by-law, use bylaw_detail with its id.`;
	} catch (err) {
		log.warn('govdata_published_laws_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

/** Councils that have published by-laws (with their area ids). */
export async function councilsWithBylaws() {
	try {
		const rows = listOf(await get('tausi-council-management-service', '/api/v1/portal/council-with-by-law'));
		if (!rows.length) return 'No councils with published by-laws are listed right now.';
		const shown = rows.slice(0, 60);
		const lines = shown.map((r) => {
			const name = pick(r, ['areaName', 'councilName', 'administrativeAreaName', 'name'], 80) || 'Council';
			const id = r.areaId ?? r.administrativeAreaCode ?? r.id ?? '';
			return `- ${name}${id !== '' ? ` (areaId ${id})` : ''}`;
		});
		const more = rows.length > shown.length ? `\n…and ${rows.length - shown.length} more.` : '';
		return `Councils that have published by-laws (name — areaId):\n` + lines.join('\n') + more + `\nUse council_bylaws with an areaId to list that council’s by-laws.`;
	} catch (err) {
		log.warn('govdata_councils_with_bylaws_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

/** Full detail of one published by-law by its lawId. */
export async function bylawDetail(lawId) {
	const id = String(lawId ?? '').trim();
	if (!id) return 'Ask which by-law (its id) the citizen wants — list ids with published_laws or council_bylaws — then call this with that id.';
	try {
		const json = await get('tausi-council-management-service', '/api/v1/portal/published-by-law', { lawId: id });
		const d = json?.data;
		// Handle bare object, top-level array, or the standard {item|itemList} envelope.
		const o = Array.isArray(d) ? d[0] : (d?.item ?? (Array.isArray(d?.itemList) ? d.itemList[0] : d));
		if (!o || typeof o !== 'object') return `No by-law found for id ${clean(id, 40)}.`;
		const desc = pick(o, ['description', 'lawDescription', 'name', 'title'], 400);
		const rev = pick(o, ['revenueSource', 'revenueSourceName'], 80);
		const gfs = pick(o, ['gfsCode', 'gfs'], 40);
		const date = pick(o, ['publishedDate', 'date', 'createdAt'], 40);
		const lines = [desc || compactObj(o, 10)];
		if (rev) lines.push(`Revenue source: ${rev}`);
		if (gfs) lines.push(`GFS code: ${gfs}`);
		if (date) lines.push(`Published: ${date}`);
		return `By-law ${clean(id, 40)} (live from TAUSI):\n` + lines.join('\n');
	} catch (err) {
		log.warn('govdata_bylaw_detail_failed', { lawId: id, error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

/** By-laws published by a specific council (areaId). */
export async function councilBylaws(areaId) {
	const id = String(areaId ?? '').trim();
	if (!id) return 'Ask which council (its areaId) first — list them with councils_with_bylaws — then call this with that areaId.';
	try {
		const rows = listOf(await get('tausi-council-management-service', '/api/v1/portal/council-published-by-law', { areaId: id }));
		if (!rows.length) return `No by-laws are published for areaId ${clean(id, 40)}.`;
		const shown = rows.slice(0, 25);
		const lines = shown.map((r, i) => {
			const desc = pick(r, ['description', 'lawDescription', 'name', 'title'], 140) || compactObj(r);
			const lid = r.lawId ?? r.id ?? '';
			return `${i + 1}. ${desc}${lid !== '' ? ` (id ${lid})` : ''}`;
		});
		const more = rows.length > shown.length ? `\n…and ${rows.length - shown.length} more.` : '';
		return `By-laws published by council areaId ${clean(id, 40)} (live from TAUSI):\n` + lines.join('\n') + more;
	} catch (err) {
		log.warn('govdata_council_bylaws_failed', { areaId: id, error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

// ============================ TAXPAYER ============================

/** Reference list of taxpayer categories. */
export async function taxpayerCategories() {
	try {
		const rows = listOf(await get('tausi-tax-payer-service', '/portal/api/v1/setup/taxpayer-category'));
		if (!rows.length) return 'No taxpayer categories are published by TAUSI right now.';
		const names = rows.map((r) => clean(typeof r === 'string' ? r : r.name || r.categoryName || r.description || r.code || '', 60)).filter(Boolean);
		if (!names.length) return 'No taxpayer categories are published by TAUSI right now.';
		const shown = names.slice(0, 60);
		return `Taxpayer categories in the TAUSI system: ${shown.join(', ')}${names.length > shown.length ? `, …and ${names.length - shown.length} more` : ''}.`;
	} catch (err) {
		log.warn('govdata_taxpayer_categories_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}

// ============================ AUCTIONS ============================

/** Current public e-auction items. */
export async function auctionListings(pageNo = 0, pageSize = 50) {
	const size = num(pageSize) || 50;
	try {
		const rows = listOf(await get('tausi-auction-management-service', '/api/v1/auction-item/auction/portal', { pageNo: num(pageNo), pageSize: size }));
		if (!rows.length) return 'There are no active public e-auctions on TAUSI right now.';
		const shown = rows.slice(0, 20);
		const lines = shown.map((r, i) => {
			const name = pick(r, ['itemName', 'auctionItemName', 'name', 'title', 'description'], 100) || compactObj(r);
			const loc = pick(r, ['location', 'region', 'councilName', 'administrativeAreaName'], 50);
			return `${i + 1}. ${name}${loc ? ` — ${loc}` : ''}`;
		});
		const more = rows.length > shown.length ? `\n…and ${rows.length - shown.length} more.` : '';
		return `Current public e-auctions on TAUSI:\n` + lines.join('\n') + more + `\nTo bid, the citizen signs in on the TAUSI portal: [TAUSI portal](${PORTAL}).`;
	} catch (err) {
		log.warn('govdata_auction_listings_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}
