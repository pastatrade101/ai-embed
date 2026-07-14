// Structured tour helpers. Tours are knowledge_items of category ~ "tour";
// tour_departures adds date-level pricing/availability. These power the
// search_tours / get_tour_price agent tools (qualification + planning).
import { supabase } from './supabase.js';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Normalise a month input ("Sep", "september", 9, "09") → 0-based index or null. */
export function monthIndex(input) {
	if (input == null || input === '') return null;
	const s = String(input).trim().toLowerCase();
	const n = Number(s);
	if (Number.isInteger(n) && n >= 1 && n <= 12) return n - 1;
	let i = MONTHS.indexOf(s);
	if (i >= 0) return i;
	i = MONTH_ABBR.indexOf(s.slice(0, 3));
	return i >= 0 ? i : null;
}

const meta = (item, ...keys) => {
	const md = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
	for (const k of Object.keys(md)) {
		if (keys.some((want) => k.toLowerCase().includes(want))) return String(md[k]);
	}
	return null;
};

/** All published tours for a client. */
export async function listTours(clientId) {
	const { data } = await supabase
		.from('knowledge_items')
		.select('id, title, body, category, price_amount, price_currency, metadata')
		.eq('client_id', clientId)
		.ilike('category', '%tour%')
		.eq('is_published', true);
	return data ?? [];
}

/** Upcoming departures grouped by tour item_id. Resilient if the table is absent. */
export async function departuresByItem(clientId, itemIds) {
	if (!itemIds?.length) return {};
	const { data, error } = await supabase
		.from('tour_departures')
		.select('item_id, start_date, end_date, price_amount, currency, seats_available, status')
		.eq('client_id', clientId)
		.in('item_id', itemIds)
		.order('start_date', { ascending: true });
	if (error || !data) return {};
	const map = {};
	for (const d of data) (map[d.item_id] ??= []).push(d);
	return map;
}

/** A compact, AI-readable summary line for one tour. */
export function tourSummary(item, deps = []) {
	const parts = [item.title];
	const duration = meta(item, 'duration');
	if (duration) parts.push(duration);
	if (item.price_amount != null) parts.push(`from ${item.price_currency ?? 'USD'} ${item.price_amount} pp`);
	const season = meta(item, 'season', 'month');
	if (season) parts.push(`best: ${season}`);
	const dest = meta(item, 'destination', 'route', 'park');
	if (dest) parts.push(`covers: ${dest}`);
	const upcoming = deps.slice(0, 3).map((d) => `${d.start_date}${d.price_amount != null ? ` (${d.currency ?? 'USD'} ${d.price_amount})` : ''}${d.status && d.status !== 'open' ? ` [${d.status}]` : ''}`);
	if (upcoming.length) parts.push(`next departures: ${upcoming.join('; ')}`);
	return parts.join(' · ');
}

function seasonMatchesMonth(item, mIdx) {
	if (mIdx == null) return true;
	const season = (meta(item, 'season', 'month') ?? '').toLowerCase();
	if (!season) return true; // unknown season → don't exclude
	return season.includes(MONTHS[mIdx]) || season.includes(MONTH_ABBR[mIdx]);
}

/**
 * Search tours by optional free text, month, budget and group size.
 * @returns {Promise<string>} AI-readable result.
 */
export async function searchTours(clientId, { query, month, max_price, group_size } = {}) {
	const tours = await listTours(clientId);
	if (!tours.length) return 'No tours are published in the catalogue yet.';

	const deps = await departuresByItem(clientId, tours.map((t) => t.id));
	const mIdx = monthIndex(month);
	const q = String(query ?? '').trim().toLowerCase();
	const group = Number(group_size) || 1;

	let matches = tours.filter((t) => {
		if (q) {
			const hay = `${t.title} ${t.body ?? ''} ${JSON.stringify(t.metadata ?? {})}`.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		// month: keep if season matches OR there's a departure that month
		if (mIdx != null) {
			const hasDep = (deps[t.id] ?? []).some((d) => new Date(d.start_date).getMonth() === mIdx);
			if (!hasDep && !seasonMatchesMonth(t, mIdx)) return false;
		}
		if (max_price != null && t.price_amount != null && Number(t.price_amount) * group > Number(max_price)) return false;
		return true;
	});

	if (!matches.length) matches = tours; // fall back to the full list rather than nothing
	return matches.slice(0, 6).map((t, i) => `${i + 1}. ${tourSummary(t, deps[t.id] ?? [])}`).join('\n');
}

/**
 * Exact price + departures + estimate for a named tour.
 * @returns {Promise<string>}
 */
export async function getTourPrice(clientId, { tour, group_size, month } = {}) {
	const tours = await listTours(clientId);
	const q = String(tour ?? '').trim().toLowerCase();
	const match = tours.find((t) => t.title.toLowerCase() === q) || tours.find((t) => q && t.title.toLowerCase().includes(q)) || tours.find((t) => q && q.includes(t.title.toLowerCase()));
	if (!match) return `No tour found matching "${tour}". Use search_tours to list available tours.`;

	const deps = (await departuresByItem(clientId, [match.id]))[match.id] ?? [];
	const group = Number(group_size) || null;
	const cur = match.price_currency ?? 'USD';
	const lines = [`${match.title}`];
	if (match.price_amount != null) lines.push(`Base price: ${cur} ${match.price_amount} per person.`);

	const mIdx = monthIndex(month);
	const relevant = mIdx != null ? deps.filter((d) => new Date(d.start_date).getMonth() === mIdx) : deps;
	if (relevant.length) {
		lines.push('Departures: ' + relevant.slice(0, 6).map((d) => `${d.start_date}${d.price_amount != null ? ` — ${d.currency ?? cur} ${d.price_amount}pp` : ''}${d.seats_available != null ? `, ${d.seats_available} seats` : ''}${d.status && d.status !== 'open' ? ` [${d.status}]` : ''}`).join('; '));
	} else if (mIdx != null) {
		lines.push('No scheduled departures found for that month — offer to check with the team.');
	}

	if (group && match.price_amount != null) {
		lines.push(`Estimated total for ${group} ${group === 1 ? 'person' : 'people'}: ~${cur} ${(Number(match.price_amount) * group).toLocaleString()} (per-person basis; confirm exact quote with the team).`);
	}
	return lines.join('\n');
}
