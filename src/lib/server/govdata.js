// Live TAUSI land-sales lookups for the AI assistant.
//
// These hit the TAUSI public citizen catalogue (no auth) at request time so the
// assistant answers with CURRENT projects/plots instead of stale/guessed
// numbers. Only the public, no-token endpoints are exposed — plot-level detail,
// applications, owners and payments require each citizen's OWN Bearer token and
// are intentionally out of scope here.
//
// Every exported function returns a plain, AI-readable STRING and NEVER throws:
// a timeout / network / geo-block failure degrades to a friendly "couldn't
// reach the service" line that tells the model to fall back to collecting the
// customer's contact details (exactly what it did before these tools existed).
//
// All external free-text is passed through clean() before it enters the model
// context — whitespace/newlines collapsed and length capped — so a verbose or
// instruction-shaped TAUSI payload can neither bloat tokens nor smuggle
// structure into the tool result.
import { env } from '$env/dynamic/private';
import { log } from './whatsapp/logger.js';

// Overridable so a future in-region proxy can be pointed at without a code change.
const BASE = (env.TAUSI_LANDSALES_BASE || 'https://tausi.tamisemi.go.tz/kivuko/tausi-landsales-service/api/v1').replace(/\/+$/, '');
// Citizen-facing portal (where they log in to view detail, apply and pay) — the
// tools hand this to the assistant so it can share a clickable link, not prose.
const PORTAL = (env.TAUSI_PORTAL_URL || 'https://tausi.tamisemi.go.tz').replace(/\/+$/, '');
const TIMEOUT_MS = 12000;
const PAGE_SIZE = 100;

// What the model should say when TAUSI itself is unreachable — informs it AND
// prescribes the graceful fallback in one line.
const UNREACHABLE =
	'The live TAUSI land-sales service could not be reached right now, so I can’t pull current projects. ' +
	'Do NOT guess any plots, locations or prices — instead offer to take the customer’s name and WhatsApp number or email so the team can follow up with exact details.';

/** GET a TAUSI endpoint. Throws on timeout/network/non-2xx; callers wrap. */
async function get(path, params) {
	const qs = params
		? '?' +
			new URLSearchParams(
				Object.entries(params)
					.filter(([, v]) => v != null && v !== '')
					.map(([k, v]) => [k, String(v)])
			).toString()
		: '';
	const url = `${BASE}${path}${qs}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
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

// Sanitise untrusted TAUSI free-text before it reaches the model: collapse all
// whitespace/newlines to single spaces (defuses multi-line injection structure)
// and cap length (bounds token cost). Applied to every external string we echo.
const clean = (s, max = 140) => {
	let t = String(s ?? '').replace(/\s+/g, ' ').trim();
	if (t.length > max) t = t.slice(0, max).trimEnd() + '…';
	return t;
};

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const summaryPath = (status) => (status === 'sold' ? '/land-open-project/sold-council-summary' : '/land-open-project/council-summary');
const projectPath = (status) => (status === 'sold' ? '/land-open-project/sold-council-project' : '/land-open-project/council-project');

/** Fetch a council summary as normalised rows { code, name, projects, plots }.
 *  Rows with no usable place-name (blank, or purely admin noise words) are
 *  dropped: they can't be resolved or shown to a citizen, and an unnamed
 *  aggregate/rollup row would otherwise double-count into totals. */
async function summaryRows(status) {
	const rows = listOf(await get(summaryPath(status)));
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
	// The REQUESTED catalogue was never reached → treat as unreachable, not as a
	// confident "no such council" (which could be a partial outage of that status).
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
	if (!raw) return 'Ask the customer which council or area they are interested in first, then call this tool with that council name.';
	try {
		const resolved = await resolveCouncil(raw, st);
		if (!resolved) {
			// Genuine no-match (the catalogue WAS reached). Hand the model the real
			// council list so it can map a city/region (e.g. Dar es Salaam → Ilala,
			// Kinondoni, Temeke …) onto a council instead of dead-ending.
			let list = '';
			try {
				const l = await councilList(st);
				if (l) list = ` Councils that currently have ${st === 'sold' ? 'sold' : 'available'} land: ${l}.`;
			} catch {
				/* fall through to the plain message */
			}
			return `I couldn’t find a council named “${clean(raw, 60)}” in the TAUSI catalogue.${list} A city or region can cover several councils — ask the citizen which one, or call land_national_summary.`;
		}
		const rows = listOf(await get(projectPath(st), { administrativeAreaCode: resolved.code, pageNo: 0, pageSize: PAGE_SIZE }));
		const label = councilLabel(resolved);
		if (!rows.length) return `No ${st === 'sold' ? 'sold' : 'available'} land projects are listed for ${label} right now.`;
		const shown = rows.slice(0, 20);
		const lines = shown.map((p, i) => {
			const name = clean(p.projectName || p.name || `Project ${p.projectId ?? i + 1}`, 80);
			const desc = clean(p.projectDescription || '', 140);
			return `${i + 1}. ${name}${desc ? ` — ${desc}` : ''}`;
		});
		// pageSize caps the fetch, so a full page means "there are more we didn't fetch".
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
			`\nPlot-level detail, exact prices, applications and payments require the citizen’s own login on the TAUSI portal — share this clickable link: [TAUSI portal](${PORTAL}) — or offer to have the team follow up.`
		);
	} catch (err) {
		log.warn('govdata_council_projects_failed', { council: raw, status: st, error: String(err?.message || err) });
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
		const rows = listOf(await get('/land-open-project/lot-use'));
		if (!rows.length) return 'No lot-use categories are published by TAUSI right now.';
		const names = rows.map((r) => clean(typeof r === 'string' ? r : r.name || r.lotUseName || r.description || r.code || '', 60)).filter(Boolean);
		if (!names.length) return 'No lot-use categories are published by TAUSI right now.';
		return `Lot-use categories in the TAUSI land catalogue: ${names.join(', ')}.`;
	} catch (err) {
		log.warn('govdata_lot_use_failed', { error: String(err?.message || err) });
		return UNREACHABLE;
	}
}
