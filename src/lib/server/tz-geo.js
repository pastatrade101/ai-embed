// Static Tanzania (mainland) geography, used to attribute citizen conversations to
// a REGION at read time. No council/region is stored per conversation, so the
// government dashboard matches place names in the conversation text against this
// list. Aggregate + non-identifying: a region is a coarse, mandate-relevant unit,
// never a person. TAMISEMI/TAUSI is mainland local government, so this is the 26
// mainland regions only.
//
// Matching is deliberately conservative — a name is attributed only when it is
// reasonably unambiguous, so demand numbers are honest rather than inflated.

export const TZ_REGIONS = [
	'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi',
	'Kigoma', 'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro',
	'Mtwara', 'Mwanza', 'Njombe', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga',
	'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Tanga'
];
export const TZ_REGION_COUNT = TZ_REGIONS.length;

// Region names that collide with common Swahili/English words — only counted when a
// geographic cue ("mkoa"/"region"/"wilaya"/"halmashauri") sits right before them, so
// e.g. "mara tatu" (three times) or "pwani" (coast) is not misread as a region.
const AMBIGUOUS = new Set(['mara', 'pwani']);

// Council / district / city names → region. Lets "wilaya ya Kishapu" or "Kinondoni"
// resolve to a region even when the region name is absent. Curated from the TAUSI
// council catalogue; unknown names simply aren't attributed (honest under-count, not
// a false one). Extend freely.
const COUNCIL_REGION = {
	// Shinyanga
	kishapu: 'Shinyanga', kahama: 'Shinyanga', ushetu: 'Shinyanga', msalala: 'Shinyanga',
	// Dar es Salaam
	kinondoni: 'Dar es Salaam', ilala: 'Dar es Salaam', temeke: 'Dar es Salaam', kigamboni: 'Dar es Salaam', ubungo: 'Dar es Salaam',
	// Dodoma
	bahi: 'Dodoma', chemba: 'Dodoma', kongwa: 'Dodoma', mpwapwa: 'Dodoma', chamwino: 'Dodoma', kondoa: 'Dodoma', itigi: 'Singida',
	// Arusha
	arumeru: 'Arusha', meru: 'Arusha', monduli: 'Arusha', ngorongoro: 'Arusha', karatu: 'Arusha', longido: 'Arusha',
	// Mwanza
	ilemela: 'Mwanza', misungwi: 'Mwanza', kwimba: 'Mwanza', magu: 'Mwanza', sengerema: 'Mwanza', ukerewe: 'Mwanza',
	// Mbeya / Songwe
	mbarali: 'Mbeya', chunya: 'Mbeya', rungwe: 'Mbeya', kyela: 'Mbeya', mbozi: 'Songwe', ileje: 'Songwe', momba: 'Songwe',
	// Kagera
	bukoba: 'Kagera', biharamulo: 'Kagera', karagwe: 'Kagera', muleba: 'Kagera', ngara: 'Kagera', missenyi: 'Kagera',
	// Geita
	bukombe: 'Geita', nyanghwale: 'Geita', mbogwe: 'Geita', chato: 'Geita',
	// Tabora
	igunga: 'Tabora', nzega: 'Tabora', urambo: 'Tabora', sikonge: 'Tabora', uyui: 'Tabora',
	// Morogoro
	kilosa: 'Morogoro', kilombero: 'Morogoro', ulanga: 'Morogoro', mvomero: 'Morogoro', gairo: 'Morogoro', ifakara: 'Morogoro', malinyi: 'Morogoro', madaba: 'Ruvuma',
	// Kigoma
	kibondo: 'Kigoma', kasulu: 'Kigoma', kakonko: 'Kigoma', buhigwe: 'Kigoma', uvinza: 'Kigoma',
	// Iringa / Njombe
	mafinga: 'Iringa', kilolo: 'Iringa', mufindi: 'Iringa', makete: 'Njombe', ludewa: 'Njombe', wanging: 'Njombe',
	// Manyara
	babati: 'Manyara', hanang: 'Manyara', kiteto: 'Manyara', mbulu: 'Manyara', simanjiro: 'Manyara',
	// Pwani (coast) — 'mafia' (Mafia Island) omitted: collides with the English word.
	bagamoyo: 'Pwani', kibaha: 'Pwani', kisarawe: 'Pwani', mkuranga: 'Pwani', rufiji: 'Pwani',
	// Lindi / Mtwara
	nachingwea: 'Lindi', ruangwa: 'Lindi', kilwa: 'Lindi', liwale: 'Lindi', masasi: 'Mtwara', nanyamba: 'Mtwara', tandahimba: 'Mtwara', newala: 'Mtwara', nanyumbu: 'Mtwara',
	// Ruvuma
	mbinga: 'Ruvuma', tunduru: 'Ruvuma', songea: 'Ruvuma', nyasa: 'Ruvuma',
	// Simiyu / Mara
	bariadi: 'Simiyu', busega: 'Simiyu', maswa: 'Simiyu', meatu: 'Simiyu', itilima: 'Simiyu', tarime: 'Mara', rorya: 'Mara', musoma: 'Mara', bunda: 'Mara', butiama: 'Mara', serengeti: 'Mara',
	// Kilimanjaro — 'hai' (active) and 'same' omitted: both collide with common words.
	moshi: 'Kilimanjaro', rombo: 'Kilimanjaro', siha: 'Kilimanjaro', mwanga: 'Kilimanjaro',
	// Tanga
	handeni: 'Tanga', korogwe: 'Tanga', muheza: 'Tanga', pangani: 'Tanga', lushoto: 'Tanga', mkinga: 'Tanga', kilindi: 'Tanga',
	// Katavi / Rukwa / Singida
	mpanda: 'Katavi', mlele: 'Katavi', nsimbo: 'Katavi', sumbawanga: 'Rukwa', nkasi: 'Rukwa', kalambo: 'Rukwa', manyoni: 'Singida', ikungi: 'Singida', iramba: 'Singida'
};

// Escape a name for use in a word-boundary regex.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Detect the set of Tanzania regions referenced in a block of (lowercased) text.
 *  Council/district names resolve to their region; region names match directly,
 *  except ambiguous ones which need a geographic cue right before them. */
export function detectRegions(text) {
	const t = ` ${String(text || '').toLowerCase()} `;
	const found = new Set();
	// Council / district / city → region.
	for (const [name, region] of Object.entries(COUNCIL_REGION)) {
		if (new RegExp(`(?<![a-z])${esc(name)}(?![a-z])`).test(t)) found.add(region);
	}
	// Region names directly.
	for (const region of TZ_REGIONS) {
		const low = region.toLowerCase();
		if (AMBIGUOUS.has(low)) {
			// Need a geographic cue: either before the name ("mkoa wa Mara", "region Mara")
			// or after it in English word order ("Mara region", "Pwani Region").
			const cueBefore = new RegExp(`(?:mkoa(?:\\s+wa)?|region|wilaya|halmashauri)\\s+(?:ya\\s+)?${esc(low)}(?![a-z])`);
			const cueAfter = new RegExp(`(?<![a-z])${esc(low)}\\s+(?:region|mkoa)(?![a-z])`);
			if (cueBefore.test(t) || cueAfter.test(t)) found.add(region);
		} else if (new RegExp(`(?<![a-z])${esc(low)}(?![a-z])`).test(t)) {
			found.add(region);
		}
	}
	return found;
}
