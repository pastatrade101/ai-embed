// Featured cards for the hosted assistant welcome screen — client-safe model
// shared by the admin editor (Svelte) and the server resolver. No framework or
// server imports.
//
// A card config is a small object: { type, title, subtitle, icon, projectId }.
// `text` cards are fully admin-authored; the live types (plots_available,
// councils_with_land, preview_countdown) resolve their NUMBERS server-side from
// TAUSI at render time — the admin only authors the label + (for the countdown)
// picks a project id.

export const MAX_CARDS = 6;

// type → definition. `gov: true` = only offered to the government tenant.
// `live: true` = the value is resolved server-side (never authored by hand).
export const CARD_TYPES = {
	text: { label: 'Custom text', gov: false, live: false, hint: 'A fixed title and subtitle you write.' },
	plots_available: { label: 'Plots available', gov: true, live: true, hint: 'Live total of plots in open land projects, nationally.' },
	councils_with_land: { label: 'Councils with land', gov: true, live: true, hint: 'Live count of councils that currently have land on sale.' },
	preview_countdown: { label: 'On-preview countdown', gov: true, live: true, needsProject: true, hint: 'A project’s “buying opens on …” with a live countdown. Needs the project id.' }
};

export const isLiveType = (type) => !!CARD_TYPES[type]?.live;

// Minimal, safe text cleaner: strip tags/angle brackets, collapse whitespace, cap.
// Admin-authored text still passes through here so no markup reaches the public page.
function clean(s, max) {
	const t = String(s ?? '')
		.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ') // drop script/style + their content
		.replace(/<[^>]*>/g, ' ')
		.replace(/[<>]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return t.length > max ? t.slice(0, max).trimEnd() : t;
}

// Icon is a short allow-listed keyword (the UI maps it to an inline SVG); never
// free-form markup.
export const CARD_ICONS = ['map', 'clock', 'building', 'layers', 'flag', 'info'];
const safeIcon = (v) => (CARD_ICONS.includes(v) ? v : 'info');

/**
 * Validate + sanitise a raw featured_cards value (from the DB or a form) into a
 * clean, bounded, safe array. Drops unknown types and malformed entries; caps the
 * count and every string length. Pure — safe on client and server.
 */
export function normalizeFeatured(raw, opts = {}) {
	const allowGov = opts.allowGov !== false; // gov-only (live TAUSI) types kept only when true
	let list = raw;
	if (typeof list === 'string') { try { list = JSON.parse(list); } catch { return []; } }
	if (!Array.isArray(list)) return [];
	const out = [];
	for (const c of list) {
		const def = c && CARD_TYPES[c.type];
		if (!c || typeof c !== 'object' || !def) continue;
		if (def.gov && !allowGov) continue; // reject live gov cards for non-government tenants
		const card = { type: c.type, title: clean(c.title, 48), subtitle: clean(c.subtitle, 90), icon: safeIcon(c.icon) };
		if (c.type === 'preview_countdown') {
			card.projectId = String(c.projectId ?? '').trim().replace(/[^\w-]/g, '').slice(0, 40);
			if (!card.projectId) continue; // a countdown with no project is meaningless
		}
		// A text card with no title carries no information — drop it.
		if (card.type === 'text' && !card.title) continue;
		out.push(card);
		if (out.length >= MAX_CARDS) break;
	}
	return out;
}
