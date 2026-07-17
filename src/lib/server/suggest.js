// Starter question chips for the assistant (hosted page + widget). Uses the
// operator's configured questions when set; otherwise derives grounded prompts
// from their real catalogue so the chips are never empty or off-topic. All
// industry copy (fallbacks, place names) comes from the Industry Registry —
// tourism reproduces the original chips verbatim.
import { serverIndustry } from './industries.js';

/** Most-mentioned notable places across the catalogue, most frequent first.
 *  (Item titles are often long and messy, so we pull a clean place name out of
 *  them rather than echoing the whole title into a chip.) */
function topPlaces(tours, places, n = 2) {
	const counts = new Map();
	for (const t of tours ?? []) {
		const hay = `${t.title ?? ''} ${t.destination ?? ''}`;
		for (const d of places ?? []) {
			if (new RegExp(`\\b${d}\\b`, 'i').test(hay)) counts.set(d, (counts.get(d) ?? 0) + 1);
		}
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([d]) => d);
}

/**
 * @param {string[]|null} configured - clients.suggested_questions
 * @param {{title:string, destination?:string|null}[]} tours
 * @param {object} ind - the tenant's industry config (defaults to tourism)
 * @returns {string[]} up to 4 chip labels (never empty)
 */
export function suggestionChips(configured, tours, ind = serverIndustry(null)) {
	const set = (Array.isArray(configured) ? configured : []).map((s) => String(s ?? '').trim()).filter(Boolean);
	if (set.length) return set.slice(0, 6);

	const list = (tours ?? []).filter((t) => t && t.title);
	if (!list.length) return ind.fallbackChips;

	const dests = topPlaces(list, ind.chipPlaces);
	const out = [ind.catalogueChip];
	if (dests[0]) out.push(`Tell me about ${dests[0]}`);
	if (dests[1]) out.push(`Best time to visit ${dests[1]}?`);
	else if (ind.chipTiming) out.push(ind.chipTiming);
	out.push(ind.chipBook);
	return [...new Set(out)].slice(0, 4);
}
