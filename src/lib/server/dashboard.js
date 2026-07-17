// Turn the raw workspace (conversations, leads, knowledge, tours) into an
// "AI employee" dashboard — everything derived from EXISTING data, no schema
// changes. Pure functions so they're easy to reason about and test.
import { serverIndustry } from './industries.js';

const STOP = new Set([
	'day', 'days', 'tour', 'tours', 'the', 'and', 'national', 'park', 'trip',
	'package', 'experience', 'adventure', 'route', 'from', 'with', 'your',
	'round', 'year', 'best', 'private', 'luxury', 'classic', 'group', 'offers'
]);

/** Build a keyword → representative-tour map from tour titles + destinations
    (not seasons, which add month/“year-round” noise). */
function tourKeywords(tours) {
	const map = new Map();
	for (const t of tours) {
		const bag = `${t.title ?? ''} ${t.destination ?? ''}`;
		for (const w of bag.split(/[^A-Za-z]+/)) {
			const k = w.toLowerCase();
			if (w.length > 3 && !STOP.has(k) && !map.has(k)) map.set(k, t);
		}
	}
	return map;
}

const convText = (c) =>
	(
		(Array.isArray(c.messages) ? c.messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ') : '') +
		' ' +
		(c.summary ?? '')
	).toLowerCase();

/** Top topics customers ask about, matched against the operator's real tours. */
export function topInterests(conversations, tours, limit = 4) {
	const kw = tourKeywords(tours);
	if (!kw.size) return [];
	const counts = new Map();
	for (const c of conversations) {
		const text = convText(c);
		const seen = new Set();
		for (const [k] of kw) {
			if (!seen.has(k) && text.includes(k)) {
				counts.set(k, (counts.get(k) ?? 0) + 1);
				seen.add(k);
			}
		}
	}
	return [...counts.entries()]
		.filter(([, n]) => n > 0)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([k, n]) => ({ term: k.charAt(0).toUpperCase() + k.slice(1), count: n }));
}

/**
 * Opportunities: experiences customers ASK about that the catalogue doesn't cover.
 * Pure keyword match against tour titles/destinations vs conversation text. The
 * demand-signal themes come from the tenant's Industry Registry entry (tourism's
 * safari list by default; industries without themes return no gaps).
 */
export function catalogueGaps(conversations, tours, limit = 3, themes = serverIndustry(null).gapThemes) {
	const cat = (tours ?? []).map((t) => `${t.title ?? ''} ${t.destination ?? ''} ${t.season ?? ''}`).join(' ');
	const out = [];
	for (const th of themes ?? []) {
		if (th.re.test(cat)) continue; // already offered
		let count = 0;
		for (const c of conversations ?? []) if (th.re.test(convText(c))) count++;
		if (count > 0) out.push({ label: th.label, count });
	}
	return out.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Parse a rough group size from free text ("5 people", "group of 4", "for 2"). */
function groupSize(text) {
	const s = String(text ?? '').toLowerCase();
	let m = s.match(/(\d{1,2})\s*(?:people|pax|adults?|guests?|travellers?|persons?)/);
	if (m) return Math.min(20, Number(m[1]));
	m = s.match(/(?:group of|party of|for)\s*(\d{1,2})/);
	if (m) return Math.min(20, Number(m[1]));
	return null;
}

/** Number of children, if the customer mentioned any ("2 kids", "1 child"). */
function childCount(text) {
	const s = String(text ?? '').toLowerCase();
	const m = s.match(/(\d{1,2})\s*(?:children|child|kids?|infants?|toddlers?)\b/);
	if (m) return Math.min(15, Number(m[1]));
	if (/\b(no children|no kids|without children|adults only)\b/.test(s)) return 0;
	return null;
}

// Common source-market nationalities → the operator sees "Country". Demonyms plus
// "from <country>". Best-effort; unknown → null (never guess).
const NATIONALITIES = {
	british: 'United Kingdom', english: 'United Kingdom', scottish: 'United Kingdom', uk: 'United Kingdom',
	american: 'United States', usa: 'United States', canadian: 'Canada', australian: 'Australia', australia: 'Australia',
	german: 'Germany', french: 'France', italian: 'Italy', spanish: 'Spain', dutch: 'Netherlands', belgian: 'Belgium',
	swiss: 'Switzerland', austrian: 'Austria', irish: 'Ireland', portuguese: 'Portugal', swedish: 'Sweden',
	norwegian: 'Norway', danish: 'Denmark', polish: 'Poland', russian: 'Russia', indian: 'India', chinese: 'China',
	japanese: 'Japan', korean: 'South Korea', kenyan: 'Kenya', tanzanian: 'Tanzania', ugandan: 'Uganda',
	nigerian: 'Nigeria', 'south african': 'South Africa', brazilian: 'Brazil', mexican: 'Mexico', emirati: 'UAE'
};
const COUNTRIES = ['united kingdom', 'united states', 'germany', 'france', 'italy', 'spain', 'netherlands', 'belgium', 'switzerland', 'austria', 'ireland', 'canada', 'australia', 'sweden', 'norway', 'denmark', 'poland', 'india', 'china', 'japan', 'kenya', 'tanzania', 'uganda', 'nigeria', 'south africa', 'brazil', 'mexico', 'uae', 'usa', 'uk'];
const TITLE = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const CODES = { uk: 'United Kingdom', usa: 'United States', us: 'United States', uae: 'UAE' };
function resolveCountry(cand) {
	if (NATIONALITIES[cand]) return NATIONALITIES[cand];
	if (COUNTRIES.includes(cand) || CODES[cand]) return CODES[cand] || TITLE(cand);
	return null;
}
function nationality(text) {
	const s = String(text ?? '').toLowerCase();
	// "from <country>" — try a two-word then one-word candidate (so "from Kenya
	// with our kids" resolves to Kenya, not "kenya with"; and "from the UK" works).
	const from = s.match(/\bfrom\s+(?:the\s+)?([a-z]{2,}(?:\s+[a-z]{3,})?)/);
	if (from) {
		const words = from[1].trim().split(/\s+/);
		for (const cand of [words.slice(0, 2).join(' '), words[0]]) {
			const c = resolveCountry(cand);
			if (c) return c;
		}
	}
	// Demonyms only in an explicit personal context, so "Indian Ocean" or
	// "English-speaking guide" are never misread as the customer's Country.
	for (const [demonym, country] of Object.entries(NATIONALITIES)) {
		const d = demonym.replace(/ /g, '\\s+');
		if (new RegExp(`\\b(?:we(?:'re| are)|i(?:'m| am)|we'?re a|as an?|group of)\\s+(?:an?\\s+)?${d}\\b`).test(s)) return country;
		if (new RegExp(`\\b${d}\\s+(?:couple|family|tourists?|travellers?|traveler|guests?|clients?|nationals?|citizens?|passport|holder)`).test(s)) return country;
	}
	return null;
}

/** Accommodation preference / band ("luxury", "mid-range lodge", "budget camping"). */
function accommodation(text) {
	const s = String(text ?? '').toLowerCase();
	const type = s.match(/\b(luxury lodge|tented camp|luxury camp|mobile camp|lodge|tented|hotel|guesthouse|camping|glamping|resort|villa)\b/)?.[1];
	let band = null;
	if (/\b(luxury|high[- ]?end|premium|5[- ]?star|five[- ]?star|exclusive)\b/.test(s)) band = 'Luxury';
	else if (/\b(mid[- ]?range|standard|comfortable|3[- ]?star|4[- ]?star)\b/.test(s)) band = 'Mid-range';
	// "budget" only as an accommodation tier, not the money sense ("budget is $8000").
	else if (/\bbudget\b(?!\s*(?:is|of|:|around|about|approx\.?|~|usd|eur|gbp|tzs|tsh|\$|€|£|\d))/.test(s) || /\b(basic|affordable|backpack)\b/.test(s)) band = 'Budget';
	if (band && type) return type.includes(band.toLowerCase()) ? TITLE(type) : `${band} · ${TITLE(type)}`;
	if (type) return TITLE(type);
	// A band with no lodging type only counts if there's a stay/lodging cue nearby.
	if (band && /\b(stay|staying|accommodation|lodging|lodge|camp|hotel|room|nights?|resort|suite|board|safari|tour|trip)\b/.test(s)) return band;
	return null;
}

const MONTHS_RE = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec';
/** A concrete date/range if given ("15 July", "July 15-22", "2nd of August"). */
function travelDates(text) {
	const s = String(text ?? '');
	// `(?!\d)` after each day stops a 4-digit year ("July 2024") reading as a day.
	let m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|to|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)\\s*(?:of\\s+)?(${MONTHS_RE})`, 'i'));
	if (m) return `${m[1]}–${m[2]} ${TITLE(m[3])}`;
	m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)\\s*(?:of\\s+)?(${MONTHS_RE})`, 'i'));
	if (m) return `${m[1]} ${TITLE(m[2])}`;
	m = s.match(new RegExp(`\\b(${MONTHS_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)`, 'i'));
	if (m) return `${TITLE(m[1])} ${m[2]}`;
	return null;
}

/**
 * Score a lead 0–100 from real signals (contact details, detail of interest,
 * conversation depth). Honest heuristic — no fabricated CRM data.
 */
export function scoreLead(lead) {
	let s = 0;
	if (lead.whatsapp) s += 30;
	if (lead.email) s += 22;
	const interest = String(lead.interest ?? '').toLowerCase();
	if (interest.length > 6) s += 8;
	if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|month|202\d|next (week|month)|\d{1,2}(st|nd|rd|th))/.test(interest)) s += 12; // dates
	if (groupSize(interest) || /\bgroup|family|couple|honeymoon\b/.test(interest)) s += 10; // party
	if (/\$|budget|usd|tzs|\d{3,}/.test(interest)) s += 8; // budget signal
	const turns = Array.isArray(lead.transcript) ? lead.transcript.length : 0;
	if (turns >= 6) s += 20;
	else if (turns >= 3) s += 12;
	else if (turns >= 1) s += 5;
	return Math.min(100, s);
}

export function leadTier(score) {
	if (score >= 78) return { label: 'Ready to book', cls: 'hot' };
	if (score >= 55) return { label: 'High interest', cls: 'warm' };
	if (score >= 35) return { label: 'Needs follow-up', cls: 'cool' };
	return { label: 'Just browsing', cls: 'cold' };
}

// Sales pipeline stages, in order. The first three are AI-derived from real
// signals (no operator action needed); the rest are operator-set (persisted in
// leads.status once the pipeline migration is applied).
export const STAGES = ['new', 'qualifying', 'qualified', 'contacted', 'quoted', 'won', 'lost'];
const AUTO_STAGES = new Set(['new', 'qualifying', 'qualified']);

/** AI-derived stage from real signals — used until the operator sets one. */
export function autoStage(lead, detail, score) {
	const hasContact = !!(lead.whatsapp || lead.email);
	const hasDetail = !!(detail.tour || detail.destination || detail.month || detail.dates || detail.budget || detail.group);
	if (hasContact && score >= 55 && hasDetail) return 'qualified';
	if (hasDetail || score >= 35) return 'qualifying';
	return 'new';
}

/** Effective stage: an operator's saved status wins; otherwise the AI's guess. */
export function leadStage(lead, detail, score) {
	const s = lead.status;
	if (s && STAGES.includes(s) && !AUTO_STAGES.has(s)) return s; // operator-set wins
	return autoStage(lead, detail, score);
}

/** A soft pipeline estimate grounded in the operator's real tour prices. */
export function pipeline(scoredLeads, tours) {
	const kw = tourKeywords(tours);
	const tiers = { hot: 0, warm: 0, cool: 0, cold: 0 };
	let value = 0;
	let matched = 0;
	for (const l of scoredLeads) {
		tiers[l.tier.cls] += 1;
		const text = `${l.interest ?? ''}`.toLowerCase();
		let tour = null;
		for (const [k, t] of kw) {
			if (text.includes(k)) {
				tour = t;
				break;
			}
		}
		if (tour && tour.price != null) {
			const g = groupSize(text) ?? 2;
			value += Number(tour.price) * g;
			matched += 1;
		}
	}
	const currency = tours.find((t) => t.price != null)?.currency ?? 'USD';
	return { tiers, value: Math.round(value), matched, currency };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseMonth(text) {
	// Whole-word match on the month or its 3-letter abbreviation, so "may" no
	// longer fires on "maybe" and "mar" no longer fires on "market".
	for (const m of MONTHS) {
		// "may" is also the modal verb — only accept it with a date cue nearby,
		// so "I may travel in September" isn't mistagged as May.
		if (m === 'may') {
			if (/\b(?:in|by|of|during|early|mid|late|around|for)\s+may\b/i.test(text) || /\bmay\s+(?:\d|next|this|202\d)/i.test(text)) return 'May';
			continue;
		}
		if (new RegExp(`\\b(${m}|${m.slice(0, 3)})\\b`, 'i').test(text)) return m.charAt(0).toUpperCase() + m.slice(1);
	}
	return null;
}
function parseBudget(text) {
	let m = text.match(/(?:\$|usd\s*|budget[^0-9]{0,14})([0-9][0-9,.\s]{2,})/i);
	if (!m) m = text.match(/\b([0-9]{4,})\b/);
	if (!m) return null;
	const n = Number(String(m[1]).replace(/[^0-9]/g, ''));
	return Number.isFinite(n) && n >= 300 && n <= 500000 ? n : null;
}

/** Pull structured details out of a lead's interest + transcript (real text only). */
export function extractLead(lead, tours) {
	const userText = Array.isArray(lead.transcript) ? lead.transcript.filter((m) => m.role === 'user').map((m) => m.content).join(' ') : '';
	const text = `${lead.interest ?? ''} ${userText}`;
	const low = text.toLowerCase();
	const kw = tourKeywords(tours);
	let destination = null;
	let tour = null;
	for (const [k, t] of kw) {
		if (low.includes(k)) {
			destination = k.charAt(0).toUpperCase() + k.slice(1);
			tour = t;
			break;
		}
	}
	const month = parseMonth(low);
	const group = groupSize(low);
	const children = childCount(text);
	const dates = travelDates(text);
	const country = nationality(text);
	const stay = accommodation(text);
	const budget = parseBudget(low);
	const firstMessage =
		(Array.isArray(lead.transcript) ? lead.transcript.find((m) => m.role === 'user')?.content : null) || lead.interest || '';
	const estValue = tour && tour.price != null ? Math.round(Number(tour.price) * (group ?? 2)) : null;
	return { destination, tour: tour?.title ?? null, month, dates, group, children, country, accommodation: stay, budget, firstMessage, estValue };
}

/** Merge recent conversations + leads into a single reverse-chronological feed. */
export function activityFeed(conversations, leads, limit = 8) {
	const events = [];
	for (const c of conversations.slice(0, 15)) {
		const q = Array.isArray(c.messages) ? c.messages.find((m) => m.role === 'user')?.content ?? '' : '';
		const summarized = typeof c.summary === 'string' && c.summary.trim();
		events.push({
			type: summarized ? 'summary' : 'conversation',
			at: c.created_at,
			title: summarized ? 'Summarized a chat for you' : 'Answered a customer',
			detail: (q || '').slice(0, 80)
		});
	}
	for (const l of leads.slice(0, 15)) {
		events.push({
			type: 'lead',
			at: l.created_at,
			title: `Captured a lead${l.name ? ` · ${l.name}` : ''}`,
			detail: (l.interest ?? '').slice(0, 80)
		});
	}
	return events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

/** The questions customers actually asked (deduped), for the Knowledge page. */
const GREETING = /^(hi+|hey+|hello+|hellow+|yo|habari|mambo|jambo|hola|thanks?|thank you|ok(ay)?|yes|no|test|good (morning|afternoon|evening))[\s!.?]*$/i;

export function customerQuestions(conversations, limit = 6) {
	const seen = new Map();
	for (const c of conversations) {
		const raw = Array.isArray(c.messages) ? (c.messages.find((m) => m.role === 'user')?.content ?? '').trim() : '';
		if (raw.length < 6 || GREETING.test(raw)) continue; // skip bare greetings / noise
		const key = raw.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 45);
		if (!key) continue;
		if (seen.has(key)) seen.get(key).count += 1;
		else seen.set(key, { q: raw.length > 90 ? raw.slice(0, 90) + '…' : raw, count: 1 });
	}
	return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Actionable items the operator should review — all derived from real state. */
export function aiTasks({ client, stats, leads, items }) {
	const ind = serverIndustry(client);
	const tasks = [];
	if (!client.is_active) {
		tasks.push({ icon: 'pause', text: 'Your assistant is paused — reactivate it to start answering customers.', cta: 'Reactivate', href: '/portal/settings', level: 'danger' });
	}
	if ((stats.items ?? 0) === 0) {
		tasks.push({ icon: 'book', text: ind.emptyKnowledgeTask.text, cta: ind.emptyKnowledgeTask.cta, href: '/portal/knowledge', level: 'warn' });
	}
	if (!client.whatsapp_number) {
		tasks.push({ icon: 'phone', text: 'Add a WhatsApp number so the assistant can hand you leads.', cta: 'Add number', href: '/portal/settings', level: 'warn' });
	}
	const uncontacted = (leads ?? []).length;
	if (uncontacted > 0) {
		tasks.push({ icon: 'user', text: `${uncontacted} lead${uncontacted === 1 ? '' : 's'} captured — follow up while they're warm.`, cta: 'View leads', href: '/portal/leads', level: 'info' });
	}
	const cap = client.monthly_conversation_cap ?? 0;
	if (cap > 0 && (stats.conversationsMonth ?? 0) / cap >= 0.8) {
		tasks.push({ icon: 'gauge', text: `You've used ${Math.round(((stats.conversationsMonth ?? 0) / cap) * 100)}% of this month's conversations.`, cta: 'See plans', href: '/portal/billing', level: 'warn' });
	}
	return tasks;
}
