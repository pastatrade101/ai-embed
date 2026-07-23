// Industry Registry — server layer. AI personas, qualification scripts, tool
// definitions, extraction schemas and analytics themes per industry. The engine
// (rag/tools/lead-ai/analyst/research/dashboard) reads whatever entry the
// tenant's `industry` points at and NEVER branches on an industry name.
//
// The tourism entry reproduces the original hardcoded strings byte-for-byte, so
// existing tenants (and any row created before migration 016) behave exactly as
// before. Adding an industry = adding an entry here + in $lib/industries.js.
import { INDUSTRIES, industryKeyOf } from '$lib/industries.js';

// ---- Shared, industry-neutral tool defs (identical to the originals) --------

const SEARCH_KNOWLEDGE_TOURISM = {
	name: 'search_knowledge',
	description:
		"Search the business's verified catalogue (tours, prices, inclusions, FAQs, policies) for details to answer the customer. Initial results for the latest question are already in CONTEXT — call this only when you need additional or more specific information.",
	input_schema: {
		type: 'object',
		properties: { query: { type: 'string', description: 'What to look up, in natural language' } },
		required: ['query']
	}
};

const CREATE_LEAD_TOURISM = {
	name: 'create_lead',
	description:
		'Save a sales lead once the customer shows clear buying intent and has shared at least a WhatsApp number or email (plus a name if given). Ask for both a WhatsApp number and email when you can, and capture whatever details you have so the operator can follow up.',
	input_schema: {
		type: 'object',
		properties: {
			name: { type: 'string' },
			whatsapp: { type: 'string', description: 'WhatsApp number with country code' },
			email: { type: 'string' },
			interest: {
				type: 'string',
				description:
					'Everything learned about the trip in one line: tour/destination, travel month or exact dates, number of adults and children, budget, accommodation preference, and nationality (where they travel from) — whatever was mentioned.'
			}
		}
	}
};

const searchKnowledgeGeneric = (catalogue) => ({
	name: 'search_knowledge',
	description: `Search the business's verified knowledge base (${catalogue}, FAQs, policies) for details to answer the customer. Initial results for the latest question are already in CONTEXT — call this only when you need additional or more specific information.`,
	input_schema: {
		type: 'object',
		properties: { query: { type: 'string', description: 'What to look up, in natural language' } },
		required: ['query']
	}
});

const createLeadGeneric = (interestDesc) => ({
	name: 'create_lead',
	description:
		'Save a lead once the customer shows clear interest and has shared at least a WhatsApp number or email (plus a name if given). Ask for both a WhatsApp number and email when you can, and capture whatever details you have so the team can follow up.',
	input_schema: {
		type: 'object',
		properties: {
			name: { type: 'string' },
			whatsapp: { type: 'string', description: 'WhatsApp number with country code' },
			email: { type: 'string' },
			interest: { type: 'string', description: interestDesc }
		}
	}
});

// ---- Live government-data tools (TAUSI land sales) --------------------------

// Public, no-token TAUSI lookups (land, house rent, by-laws, taxpayer, auctions).
// Backed by govdata.js, which fetches the live citizen catalogue at request time
// so the assistant answers with CURRENT data instead of guessing. Attached only
// to the `government` industry (see SERVER.government below).
const TAUSI_PUBLIC_TOOLS = [
	{
		name: 'land_national_summary',
		description:
			'Get CURRENT per-council totals of government land projects and plots from the live TAUSI portal. Use for "how much land is available/sold", national or regional overviews, or to discover which councils have land (each row includes its administrative area code). Returns live data — never guess these numbers.',
		input_schema: {
			type: 'object',
			properties: { status: { type: 'string', enum: ['open', 'sold'], description: "'open' = available for sale, 'sold' = already sold" } },
			required: ['status']
		}
	},
	{
		name: 'land_council_projects',
		description:
			'List the CURRENT government land projects in one council/area from the live TAUSI portal. Use when the customer names an area (e.g. "Dodoma", "Arusha"). Accepts the council name OR its administrative area code.',
		input_schema: {
			type: 'object',
			properties: {
				council: { type: 'string', description: 'Council/area name (e.g. "Dodoma") or its administrative area code' },
				status: { type: 'string', enum: ['open', 'sold'], description: "'open' = available, 'sold' = sold" }
			},
			required: ['council', 'status']
		}
	},
	{
		name: 'land_area_codes',
		description: 'List councils that currently have land in the TAUSI portal, each with its administrative area code. Use to resolve or confirm a council the customer mentioned.',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'land_lot_use',
		description: 'List the lot-use categories (residential, commercial, etc.) used in TAUSI land projects.',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'project_plots',
		description: 'CURRENT plot-by-plot detail for ONE land project from the live TAUSI portal: size, price, application fee, first installment, lot use and status per plot (with a price/size summary). These are official live figures you MAY share. Needs a project id (from land_council_projects).',
		input_schema: { type: 'object', properties: { project_id: { type: 'string', description: 'The project id shown by land_council_projects' } }, required: ['project_id'] }
	},
	{
		name: 'house_rent_summary',
		description: 'CURRENT government rental-housing (House Rent) projects per council from the live TAUSI portal — counts and region. Use when a citizen asks about renting a government house/property.',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'published_laws',
		description: 'CURRENT published council by-laws / revenue legislation from TAUSI (description, revenue source, GFS code). Use for questions about local laws, fees legislation, or revenue rules. Use bylaw_detail for the full text of one.',
		input_schema: {
			type: 'object',
			properties: { page_no: { type: 'integer', description: 'page number, default 0' }, page_size: { type: 'integer', description: 'default 100' } }
		}
	},
	{
		name: 'councils_with_bylaws',
		description: 'List councils that have published by-laws, each with its areaId. Use to find which council to query, then call council_bylaws with that areaId.',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'bylaw_detail',
		description: 'Full detail of one published by-law by its id (get ids from published_laws or council_bylaws).',
		input_schema: { type: 'object', properties: { law_id: { type: 'string' } }, required: ['law_id'] }
	},
	{
		name: 'council_bylaws',
		description: 'List the by-laws published by a specific council. Needs the council areaId (from councils_with_bylaws).',
		input_schema: { type: 'object', properties: { area_id: { type: 'string' } }, required: ['area_id'] }
	},
	{
		name: 'taxpayer_categories',
		description: 'Reference list of taxpayer categories used in the TAUSI system.',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'auction_listings',
		description: 'CURRENT public e-auction items on TAUSI. An empty result means none are active right now.',
		input_schema: {
			type: 'object',
			properties: { page_no: { type: 'integer', description: 'page number, default 0' }, page_size: { type: 'integer', description: 'default 50' } }
		}
	}
];

// Appended to the government qualify script so the model knows WHEN to reach for
// the live TAUSI tools and to never fabricate data.
const TAUSI_PUBLIC_QUALIFY =
	'You have LIVE TAUSI tools for public government data — use them instead of guessing, and report ONLY what they return. Never invent projects, plots, laws, numbers, locations, sizes or prices; but you MAY state any figure a tool actually returned. ' +
	'Land: land_national_summary (open/sold) for which councils have land and how much; land_council_projects with a council name once the citizen names an area (it lists each project with its id); project_plots with a project id for per-plot size, price, fees and status; land_area_codes to resolve a council; land_lot_use for lot-use categories. ' +
	'House rent: house_rent_summary. By-laws / local legislation: published_laws, then councils_with_bylaws + council_bylaws for a specific council, and bylaw_detail for the full text. Taxpayer categories: taxpayer_categories. E-auctions: auction_listings. ' +
	'Per-plot sizes and prices from project_plots are official live figures you may share. Applications, tax bills and payments still need the citizen’s own TAUSI login, so point them to the portal for those. When you send a citizen to the portal or app, share it as a clickable Markdown link (e.g. [TAUSI portal](https://tausi.tamisemi.go.tz)) — the tools already include this link. If a tool says the service is unreachable, do not guess — tell the citizen to try again shortly or use the TAUSI portal directly. Do not ask for or collect their personal contact details.';

// ---- Lead extraction schemas ------------------------------------------------

// Tourism — the original schema verbatim (lead-ai.js).
const LEAD_SCHEMA_TOURISM = {
	type: 'object',
	additionalProperties: false,
	required: ['destination', 'tour', 'travel', 'adults', 'children', 'budget', 'currency', 'country', 'accommodation', 'specialRequests', 'intent'],
	properties: {
		destination: { type: ['string', 'null'], description: 'Where they want to go (park, region, country)' },
		tour: { type: ['string', 'null'], description: 'A specific tour/package name if they named one' },
		travel: { type: ['string', 'null'], description: 'Travel month or exact dates, as stated' },
		adults: { type: ['integer', 'null'] },
		children: { type: ['integer', 'null'] },
		budget: { type: ['integer', 'null'], description: 'Numeric budget if stated' },
		currency: { type: ['string', 'null'], description: 'Currency of the budget, e.g. USD' },
		country: { type: ['string', 'null'], description: 'Nationality / where they travel from' },
		accommodation: { type: ['string', 'null'], description: 'Accommodation preference, e.g. Luxury lodge' },
		specialRequests: { type: ['string', 'null'] },
		intent: { type: 'string', enum: ['ready_to_book', 'high', 'medium', 'low'] }
	}
};

// Generic industries keep the SAME keys (so every downstream consumer — leads
// UI, scoring, analyst — works unchanged) with industry-appropriate meanings.
const leadSchemaGeneric = (itemNoun) => ({
	type: 'object',
	additionalProperties: false,
	required: ['destination', 'tour', 'travel', 'adults', 'children', 'budget', 'currency', 'country', 'accommodation', 'specialRequests', 'intent'],
	properties: {
		destination: { type: ['string', 'null'], description: 'What they are looking for, in a few words' },
		tour: { type: ['string', 'null'], description: `A specific ${itemNoun} they named, if any` },
		travel: { type: ['string', 'null'], description: 'Preferred date, month or timeframe, as stated' },
		adults: { type: ['integer', 'null'], description: 'Number of people involved, if stated' },
		children: { type: ['integer', 'null'], description: 'Number of children involved, if stated' },
		budget: { type: ['integer', 'null'], description: 'Numeric budget if stated' },
		currency: { type: ['string', 'null'], description: 'Currency of the budget, e.g. USD' },
		country: { type: ['string', 'null'], description: 'Where they are from / located, if stated' },
		accommodation: { type: ['string', 'null'], description: 'Any stated preference (type, level, option)' },
		specialRequests: { type: ['string', 'null'] },
		intent: { type: 'string', enum: ['ready_to_book', 'high', 'medium', 'low'] }
	}
});

// ---- Catalogue-gap themes (tourism verbatim; others opt in per entry) -------

const GAP_THEMES_TOURISM = [
	{ label: 'Hot-air balloon safari', re: /balloon/i },
	{ label: 'Honeymoon / romantic package', re: /honeymoon|romantic|anniversary/i },
	{ label: 'Gorilla trekking', re: /gorilla/i },
	{ label: 'Chimpanzee trekking', re: /chimpanzee|chimp\b/i },
	{ label: 'Kilimanjaro climb', re: /kilimanjaro|mount meru|mountain climb/i },
	{ label: 'Diving / snorkelling', re: /scuba|diving|snorkel/i },
	{ label: 'Walking safari', re: /walking safari|bush walk|guided walk/i },
	{ label: 'Night game drive', re: /night (drive|safari|game)/i },
	{ label: 'Cultural / village tour', re: /cultural|maasai(?!\s+mara)|village tour|boma|tribe/i },
	{ label: 'Family safari', re: /family safari|kid[- ]friendly|child[- ]friendly/i },
	{ label: 'Birdwatching', re: /bird ?watch|birding/i },
	{ label: 'Photographic safari', re: /photographic|photography safari/i },
	{ label: 'Budget / camping safari', re: /budget safari|camping safari|backpack/i }
];

// ---- Per-industry server config --------------------------------------------

// Every string in this entry is the ORIGINAL hardcoded string, verbatim.
const TOURISM = {
	// rag.js buildPersona
	langKeep: 'Keep tour names, place names and exact prices as given.',
	qualify:
		"QUALIFY trip enquiries like a real sales consultant. Over the conversation, naturally gather: travel month or exact dates, number of adults and children, budget, accommodation preference (luxury / mid-range / budget), and where they're travelling from (nationality). Ask only for what's still missing, one or two questions at a time — never fire a checklist. Then call search_tours to recommend fitting options, get_tour_price for the exact price and a group estimate, and search_knowledge for other details. Once you have interest + a name or WhatsApp number, call create_lead — and pass everything you learned (dates, adults, children, budget, nationality, accommodation) in the interest field so the operator gets a complete picture. Never state a price you didn't get from get_tour_price.",
	// rag.js summarizeConversation
	summarySystem:
		'Summarize this customer chat for the sales team in 3-5 sentences. Capture: what the customer wants, any dates/group size/budget/nationality given, tours or prices discussed, contact details shared, and the next step. Be factual and concise.',
	// rag.js translateToEnglish
	translateSystem:
		'You are a translator for a tour operator reading their chat inbox. Translate each input message into natural English. If a message is already English, return it unchanged. Preserve meaning, names, places, dates and numbers exactly. Return ONLY a JSON array of strings — one per input, in the same order — and nothing else.',
	// tools.js — the original four defs (tour tools verbatim)
	tools: [
		{
			name: 'search_tours',
			description:
				'Find matching tours/itineraries by interest, month, budget and group size. Use this for trip enquiries to recommend options before answering. Returns tours with duration, per-person price, best season and upcoming departures.',
			input_schema: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'What they want, e.g. "wildlife safari", "Kilimanjaro climb"' },
					month: { type: 'string', description: 'Travel month, e.g. "September"' },
					max_price: { type: 'number', description: 'Total budget in the tour currency (for the whole group)' },
					group_size: { type: 'number', description: 'Number of travellers' }
				}
			}
		},
		{
			name: 'get_tour_price',
			description:
				'Get the exact base price, scheduled departures and a group estimate for a specific named tour. Prices come straight from the catalogue — never estimate a price without calling this.',
			input_schema: {
				type: 'object',
				properties: {
					tour: { type: 'string', description: 'The tour name (as shown by search_tours)' },
					group_size: { type: 'number' },
					month: { type: 'string', description: 'Travel month to filter departures' }
				},
				required: ['tour']
			}
		},
		SEARCH_KNOWLEDGE_TOURISM,
		CREATE_LEAD_TOURISM
	],
	// lead-ai.js
	leadSystem: `Extract the trip details a customer actually stated, for a tour operator's lead record. Use null for anything not clearly stated — never guess or infer beyond what they said. "intent" is how ready to book they sound. Return the structured object only.`,
	leadSchema: LEAD_SCHEMA_TOURISM,
	// analyst.js
	analystSystem: `You are the data analyst for a tour operator, embedded in their dashboard. You answer questions about THEIR business using only the JSON snapshot provided.

Rules:
- Answer ONLY from the DATA below. Never invent numbers, tours, or trends that aren't in it.
- "leads.total", "leads.thisMonth", "conversations.total" and "conversations.thisMonth" are EXACT counts. Use them for any "how many" question.
- Breakdowns (byTier, byStage, values, topDestinations/Months/Countries) are computed over the most recent "analysedLeads" leads. If "aggregatesCoverRecentOnly" is true, say these reflect recent leads, not the full history.
- If the data doesn't cover the question, say so plainly and suggest what to track.
- Amounts are in the operator's currency (see "currency"). Format money with that currency.
- Be concise and practical — a busy operator wants the answer and the "so what", not a lecture.
- When useful, point to a concrete next action grounded in the numbers.
- Prefer short paragraphs or tight bullet lists. No preamble like "Based on the data".`,
	// research.js
	researchSystem: `You are a travel-content researcher for a tour operator. They want a knowledge-base entry on a topic so their AI assistant can answer customer questions about it.

Use web search (up to a few queries) to gather accurate, current facts. Then STOP searching and write the entry.

Your FINAL message must be ONLY the entry — nothing else:
- First line, exactly: "# <Title>"
- Then 150–350 words: clear prose plus a few short, useful bullet points a customer would care about.
- Do NOT narrate your process, do not say "here is" or "now I'll write", do not include citation markers or a source list.
- Do NOT invent prices, dates, or this operator's own tour details — those belong to the operator.
- For facts that change (visa fees, seasonal prices, park fees, health rules), write "confirm current details" rather than guessing.`,
	// dashboard.js
	gapThemes: GAP_THEMES_TOURISM,
	// tours.js catalogue selector
	catalogueMatch: '%tour%',
	// dashboard.js aiTasks — original copy verbatim
	emptyKnowledgeTask: { text: "Your assistant has no tours or info yet — it can only greet visitors.", cta: 'Add tours' },
	// suggest.js starter chips — all strings verbatim from the original module.
	fallbackChips: ['What do you offer?', 'How can you help me?', 'How do I book?'],
	catalogueChip: 'What tours do you offer?',
	chipTiming: 'When’s the best time to travel?',
	chipBook: 'How do I book?',
	// Recognisable East-African / safari destinations (original list verbatim).
	chipPlaces: [
		'Serengeti', 'Ngorongoro', 'Tarangire', 'Zanzibar', 'Kilimanjaro', 'Manyara', 'Mikumi',
		'Selous', 'Nyerere', 'Ruaha', 'Mafia', 'Meru', 'Masai Mara', 'Maasai Mara',
		'Amboseli', 'Bwindi', 'Okavango', 'Kruger', 'Victoria Falls', 'Sahara'
	],
	// leads/+page.server.js nextAction copy
	nextActions: {
		quoteNamed: (name) => `Send a quote for ${name}`,
		quote: 'Send a quote today',
		askTiming: 'Ask when they’d like to travel',
		suggestItems: 'Suggest tours that fit their trip'
	},
	// insights page — analyst starter prompts, verbatim.
	analystSuggestions: ['Which tours convert best into leads?', 'Where are my leads dropping off?', 'What’s my potential booking value this month?', 'Which travel month is most in demand?']
};

/** Build a generic server entry from the client-safe industry definition.
 *  `extraTools` are appended to the industry's toolset; `extraQualify` is
 *  appended to the qualification script (e.g. live-data tool guidance). */
function genericServer(ui, { persona, qualifyFields, researchDomain, extraTools = [], extraQualify = '', noLeads = false }) {
	const t = ui.terms;
	const roleNoun = ui.businessType; // e.g. "hotel", "healthcare provider"
	// Lead-free industries (e.g. government citizen services) never harvest
	// contacts — they help and point to official channels instead.
	const leadClause = noLeads
		? 'Do not ask for or collect personal contact details, and do not capture leads. If the person needs a human or something you cannot resolve, direct them to the official channels (the portal/app or the responsible office).'
		: 'Once you have interest + a name or WhatsApp number, call create_lead — and pass everything you learned in the interest field so the team gets a complete picture.';
	return {
		langKeep: `Keep ${t.item} names, place names and exact prices as given.`,
		qualify:
			`QUALIFY enquiries like ${persona}. Over the conversation, naturally gather: ${qualifyFields}. Ask only for what's still missing, one or two questions at a time — never fire a checklist. Use search_knowledge to find the details you need before answering. ${leadClause} Never state a price you didn't find in the knowledge base.` +
			(extraQualify ? ` ${extraQualify}` : ''),
		summarySystem: `Summarize this customer chat for the team in 3-5 sentences. Capture: what the ${t.customer} wants, any dates/numbers/budget given, ${t.items} or prices discussed, contact details shared, and the next step. Be factual and concise.`,
		translateSystem: `You are a translator for a ${roleNoun} reading their chat inbox. Translate each input message into natural English. If a message is already English, return it unchanged. Preserve meaning, names, places, dates and numbers exactly. Return ONLY a JSON array of strings — one per input, in the same order — and nothing else.`,
		tools: [searchKnowledgeGeneric(t.catalogue), ...(noLeads ? [] : [createLeadGeneric(`Everything learned about the enquiry in one line: the ${t.item} or need, preferred dates or timing, number of people, budget, and any preferences — whatever was mentioned.`)]), ...extraTools],
		leadSystem: `Extract the details a ${t.customer} actually stated, for a ${roleNoun}'s lead record. Use null for anything not clearly stated — never guess or infer beyond what they said. "intent" is how ready to proceed they sound. Return the structured object only.`,
		leadSchema: leadSchemaGeneric(t.item),
		analystSystem: `You are the data analyst for a ${roleNoun}, embedded in their dashboard. You answer questions about THEIR business using only the JSON snapshot provided.

Rules:
- Answer ONLY from the DATA below. Never invent numbers, ${t.items}, or trends that aren't in it.
- "leads.total", "leads.thisMonth", "conversations.total" and "conversations.thisMonth" are EXACT counts. Use them for any "how many" question.
- Breakdowns (byTier, byStage, values, top lists) are computed over the most recent "analysedLeads" leads. If "aggregatesCoverRecentOnly" is true, say these reflect recent leads, not the full history.
- If the data doesn't cover the question, say so plainly and suggest what to track.
- Amounts are in the business's currency (see "currency"). Format money with that currency.
- Be concise and practical — a busy team wants the answer and the "so what", not a lecture.
- When useful, point to a concrete next action grounded in the numbers.
- Prefer short paragraphs or tight bullet lists. No preamble like "Based on the data".`,
		researchSystem: `You are a content researcher for a ${roleNoun}. They want a knowledge-base entry on a topic so their AI assistant can answer ${t.customer} questions about it.

Use web search (up to a few queries) to gather accurate, current facts. Then STOP searching and write the entry.

Your FINAL message must be ONLY the entry — nothing else:
- First line, exactly: "# <Title>"
- Then 150–350 words: clear prose plus a few short, useful bullet points a ${t.customer} would care about.
- Do NOT narrate your process, do not say "here is" or "now I'll write", do not include citation markers or a source list.
- Do NOT invent prices, dates, or this business's own ${t.item} details — those belong to the business.
- For facts that change (${researchDomain}), write "confirm current details" rather than guessing.`,
		gapThemes: [],
		catalogueMatch: null, // no structured schedulable catalogue by default
		emptyKnowledgeTask: { text: `Your assistant has no ${t.items} or info yet — it can only greet visitors.`, cta: `Add ${t.items}` },
		fallbackChips: ['What do you offer?', 'How can you help me?', 'How do I get in touch?'],
		catalogueChip: `What ${t.items} do you offer?`,
		chipTiming: 'What are your prices?',
		chipBook: 'How do I get in touch?',
		chipPlaces: [],
		nextActions: {
			quoteNamed: (name) => `Follow up about ${name}`,
			quote: 'Follow up today',
			askTiming: 'Ask what timing works for them',
			suggestItems: `Suggest ${t.items} that fit their needs`
		},
		analystSuggestions: noLeads
			? [`Which ${t.items} do ${t.customer}s ask about most?`, 'What are the most common questions?', 'How many conversations came in this month?', 'What topics are missing from my knowledge?']
			: [`Which ${t.items} generate the most leads?`, 'Where are my leads dropping off?', 'What are customers asking about most?', 'How many leads came in this month?']
	};
}

const SERVER = {
	tourism: TOURISM,
	hotel: genericServer(INDUSTRIES.hotel, {
		persona: 'an experienced reservations agent',
		qualifyFields: 'check-in and check-out dates, number of adults and children, room or package preference, and budget',
		researchDomain: 'seasonal rates, local events, transport options'
	}),
	healthcare: genericServer(INDUSTRIES.healthcare, {
		persona: 'a helpful, calm front-desk assistant (never give medical advice or a diagnosis — share service information only)',
		qualifyFields: 'the service or department they need, preferred date or timing, who the visit is for, and any insurance they hold',
		researchDomain: 'clinic hours, insurance coverage, preparation guidelines'
	}),
	education: genericServer(INDUSTRIES.education, {
		persona: 'a friendly admissions advisor',
		qualifyFields: 'the programme they are interested in, their qualifications or level, preferred intake, and any questions about fees',
		researchDomain: 'admission requirements, fee schedules, intake dates'
	}),
	government: genericServer(INDUSTRIES.government, {
		persona: 'a patient public-service assistant helping citizens understand services, procedures and requirements',
		qualifyFields: 'the service they need, what stage they are at, and any documents they already have',
		researchDomain: 'fees, processing times, required documents',
		extraTools: TAUSI_PUBLIC_TOOLS,
		extraQualify: TAUSI_PUBLIC_QUALIFY,
		noLeads: true // citizen services don't harvest sales leads
	}),
	retail: genericServer(INDUSTRIES.retail, {
		persona: 'a helpful shopping advisor',
		qualifyFields: 'what they are looking for, size or specification, quantity, budget, and delivery location',
		researchDomain: 'prices, stock, delivery options'
	}),
	realestate: genericServer(INDUSTRIES.realestate, {
		persona: 'a knowledgeable property consultant',
		qualifyFields: 'whether they are buying or renting, the area they prefer, property type and size, budget, and their timeline',
		researchDomain: 'market prices, financing options, legal requirements'
	}),
	restaurant: genericServer(INDUSTRIES.restaurant, {
		persona: 'a warm host',
		qualifyFields: 'what they would like to order or book, date and time, number of guests, and any dietary preferences',
		researchDomain: 'menus, prices, opening hours'
	}),
	ictagency: genericServer(INDUSTRIES.ictagency, {
		persona: 'a knowledgeable solutions consultant',
		qualifyFields: 'what they want to build or fix, their timeline, their budget, and any existing systems or requirements',
		researchDomain: 'technologies, pricing, project timelines'
	}),
	services: genericServer(INDUSTRIES.services, {
		persona: 'a professional, helpful assistant',
		qualifyFields: 'what they need, their timeline, and any relevant details about their situation',
		researchDomain: 'prices, regulations, timelines'
	})
};

/**
 * Full (client-safe + server) industry config for a tenant. Unknown/missing
 * industry — including every row created before migration 016 — resolves to
 * tourism, reproducing the original behaviour exactly.
 */
export function serverIndustry(clientOrKey) {
	const key = industryKeyOf(clientOrKey);
	return { ...INDUSTRIES[key], ...(SERVER[key] ?? SERVER.tourism) };
}
