// Starter question chips for the assistant (hosted page + widget). Uses the
// operator's configured questions when set; otherwise derives grounded prompts
// from their real tour catalogue so the chips are never empty or off-topic.

// Recognisable East-African / safari destinations. Tour titles are often long and
// messy ("12-Day Safari & Beach… | Goldfinch Adventures"), so we pull a clean
// place name out of them rather than echoing the whole title into a chip.
const DESTINATIONS = [
	'Serengeti', 'Ngorongoro', 'Tarangire', 'Zanzibar', 'Kilimanjaro', 'Manyara', 'Mikumi',
	'Selous', 'Nyerere', 'Ruaha', 'Mafia', 'Meru', 'Masai Mara', 'Maasai Mara',
	'Amboseli', 'Bwindi', 'Okavango', 'Kruger', 'Victoria Falls', 'Sahara'
];

/** Most-mentioned destinations across the catalogue, most frequent first. */
function topDestinations(tours, n = 2) {
	const counts = new Map();
	for (const t of tours ?? []) {
		const hay = `${t.title ?? ''} ${t.destination ?? ''}`;
		for (const d of DESTINATIONS) {
			if (new RegExp(`\\b${d}\\b`, 'i').test(hay)) counts.set(d, (counts.get(d) ?? 0) + 1);
		}
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([d]) => d);
}

/**
 * @param {string[]|null} configured - clients.suggested_questions
 * @param {{title:string, destination?:string|null}[]} tours
 * @returns {string[]} up to 4 chip labels (never empty)
 */
export function suggestionChips(configured, tours) {
	const set = (Array.isArray(configured) ? configured : []).map((s) => String(s ?? '').trim()).filter(Boolean);
	if (set.length) return set.slice(0, 6);

	const list = (tours ?? []).filter((t) => t && t.title);
	if (!list.length) return ['What do you offer?', 'How can you help me?', 'How do I book?'];

	const dests = topDestinations(list);
	const out = ['What tours do you offer?'];
	if (dests[0]) out.push(`Tell me about ${dests[0]}`);
	if (dests[1]) out.push(`Best time to visit ${dests[1]}?`);
	else out.push('When’s the best time to travel?');
	out.push('How do I book?');
	return [...new Set(out)].slice(0, 4);
}
