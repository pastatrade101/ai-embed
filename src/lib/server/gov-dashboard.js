// Government leadership dashboard — DERIVED, not instrumented.
//
// The government Overview answers "what are citizens telling us, and what should we
// do about it?". Every figure here is computed at read time from the conversations
// we already store (the same approach dashboard.js uses for topic ranking) — no
// schema change, no per-conversation metadata.
//
// PRIVACY IS ENFORCED HERE, in the service layer, so it can't be bypassed by the UI,
// a CSV export, or a direct call:
//   • k-anonymity — no figure derived from fewer than K (10) conversations is ever
//     returned; the cell is suppressed (null / dropped row), never rounded.
//   • representative phrasings are TEMPLATED from a fixed taxonomy, never verbatim
//     citizen text, so no identifying detail can ride along.
//   • redact() strips any stray identifier (phone, NIN/TIN, plate, control/plot
//     number) as defence-in-depth for anything textual that does leave this module.
// Aggregate only: nothing here exposes a single conversation or citizen.

import { detectRegions, TZ_REGIONS, TZ_REGION_COUNT } from './tz-geo.js';

export const K_ANON = 10; // never surface a figure derived from fewer conversations

// ---- text extraction (messages are [{role, content}]) ----------------------
const userMsgs = (c) => (Array.isArray(c?.messages) ? c.messages.filter((m) => m && m.role === 'user') : []);
const asstMsgs = (c) => (Array.isArray(c?.messages) ? c.messages.filter((m) => m && m.role === 'assistant') : []);
const userText = (c) => userMsgs(c).map((m) => String(m.content || '')).join(' ').toLowerCase();
const asstText = (c) => asstMsgs(c).map((m) => String(m.content || '')).join(' ').toLowerCase();
// Region attribution reads the WHOLE transcript (a council named in an assistant
// answer still tells us where the citizen's interest is), user text for topic/lang.
const allText = (c) => `${userText(c)} ${asstText(c)} ${String(c?.summary || '')}`.toLowerCase();

// ---- PII redaction (defence-in-depth) --------------------------------------
/** Strip identifiers from free text before it could leave this module. Templated
 *  phrasings never contain citizen text, so this is a safety net, not the primary
 *  guarantee. */
export function redact(s) {
	return String(s || '')
		.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]') // emails
		.replace(/\bT\s?\d{3}\s?[A-Z]{3}\b/gi, '[plate]') // TZ vehicle plate T123 ABC
		.replace(/(?:\+?255|0)\s?7\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, '[phone]') // TZ mobile
		.replace(/\b\d[\d\s-]{4,}\d\b/g, '[number]') // any long digit run: NIN/TIN/control/plot/bill
		.trim();
}

// ---- language detection (heuristic, first enquiry) -------------------------
const SW_MARKERS = new Set([
	'na', 'ya', 'wa', 'kwa', 'ni', 'katika', 'kwenye', 'nataka', 'naomba', 'tafadhali',
	'habari', 'samahani', 'wapi', 'gani', 'nini', 'kuna', 'bado', 'asante', 'karibu',
	'halmashauri', 'wilaya', 'mkoa', 'kiwanja', 'viwanja', 'ardhi', 'malipo', 'lipa',
	'leseni', 'maegesho', 'kodi', 'majengo', 'ninaomba', 'nisaidie', 'ningependa'
]);
const EN_MARKERS = new Set([
	'the', 'want', 'how', 'where', 'please', 'need', 'can', 'pay', 'plot', 'land',
	'my', 'is', 'are', 'what', 'which', 'this', 'about', 'looking', 'help', 'you',
	'licence', 'license', 'parking', 'tax', 'account', 'available', 'price'
]);
/** 'sw' | 'en' | null (undetermined) for one conversation's opening enquiry. */
function detectLang(c) {
	const first = (userMsgs(c)[0]?.content || '').toLowerCase();
	const words = first.split(/[^a-z']+/).filter(Boolean);
	if (words.length < 2) return null;
	let sw = 0, en = 0;
	for (const w of words) {
		if (SW_MARKERS.has(w)) sw++;
		else if (EN_MARKERS.has(w)) en++;
	}
	if (sw === en) return null; // tie / no markers → don't guess
	return sw > en ? 'sw' : 'en';
}

// ---- government service topic taxonomy -------------------------------------
// key → templated label (leadership-facing, service-not-person) + matcher. A
// conversation may match several topics; each is counted once per conversation.
const TOPICS = [
	{ key: 'land', label: 'Finding or buying a plot', re: /kiwanja|viwanja|\bplots?\b|\bland\b|ardhi|\bmradi\b|dulisi|makazi|biashara plot/i },
	{ key: 'preview', label: 'On Preview timing', re: /on preview|preview|countdown|ununuzi utafungul|muda wa kununua|lini nitanunua/i },
	{ key: 'location', label: 'Plot location and surroundings', re: /\bwapi\b|\bnearby\b|\bkaribu\b|umbali|distance|barabara|\blocation\b|iko wapi/i },
	{ key: 'parking', label: 'Parking bills or subscription', re: /parking|maegesho|\begesho\b/i },
	{ key: 'licence', label: 'Business licence', re: /leseni|business licen|licen[cs]e/i },
	{ key: 'propertytax', label: 'Property tax', re: /property tax|kodi ya majengo|\bmajengo\b/i },
	{ key: 'payment', label: 'Payments and control numbers', re: /control number|namba ya (kudhibiti|malipo)|\bmalipo\b|\blipa\b|\bgepg\b|m-?pesa|tigo pesa|mixx|airtel money|halopesa/i },
	{ key: 'account', label: 'Accounts and sign-in', re: /\bnida\b|\bnin\b|\btin\b|akaunti|\baccount\b|log ?in|sign ?in|\bingia\b|password|nywila/i }
];
const topicsOf = (text) => TOPICS.filter((t) => t.re.test(text));

// ---- "could not help" signal (drives the stuck panel) ----------------------
// The assistant's OWN fallback / refusal wording — an unsolicited service-gap report.
const UNREACHABLE_RE = /could not be reached|try again shortly|temporarily unavailable|couldn.t pull the current data|imeshindik|jaribu tena baadaye/i;
const CANT_RE = /\bi can.?t\b|\bi cannot\b|i.?m not able|i am not able|i (do|does) ?n.?t have|\bsiwezi\b|sina taarifa|siwezi kukusaidia|i couldn.?t find/i;
// "Stuck" = the assistant's OWN fallback/refusal wording. Turn count is deliberately
// NOT used: a citizen asking four DISTINCT questions that are all answered is a
// healthy conversation, not friction, and counting it as unresolved would tank both
// the resolution rate and the "where citizens get stuck" panel.
const stuckKind = (c) => {
	const a = asstText(c);
	if (UNREACHABLE_RE.test(a)) return 'unreachable';
	if (CANT_RE.test(a)) return 'cant';
	return null;
};
const CAUSE = {
	unreachable: 'Live government data was unavailable — the service asked citizens to try again later.',
	cant: 'Outside what the service can currently answer.'
};

// ---- fraud / off-channel-payment signal ------------------------------------
const FRAUD_RE = /namba (ya simu )?binafsi|personal (phone )?number|lipa kwa namba ya simu|nilipe kwa namba|tuma pesa kwa namba|send (the )?money to|weka pesa kwa namba/i;

// ---- period helpers --------------------------------------------------------
const ts = (c) => new Date(c?.created_at || 0).getTime();
const inWindow = (c, from, to) => { const t = ts(c); return t >= from && t < to; };

// ---- k-anonymity -----------------------------------------------------------
/** The value, or null when it is derived from fewer than K conversations. */
const kSafe = (n) => (Number.isFinite(n) && n >= K_ANON ? n : null);
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);

// ---- panels ----------------------------------------------------------------

/** 1. Summary row. Percentages are null (→ "insufficient data") when their base is
 *  below K; counts of categories (regions) are safe aggregates. */
function summaryRow(cur, prior) {
	const served = cur.length;
	const servedPrior = prior.length;

	// resolved without escalation/fallback/unanswered
	const resolved = cur.filter((c) => stuckKind(c) === null).length;

	// language mix over conversations we could classify
	let sw = 0, classified = 0;
	for (const c of cur) { const l = detectLang(c); if (l) { classified++; if (l === 'sw') sw++; } }

	// distinct regions referenced this period
	const regions = new Set();
	for (const c of cur) for (const r of detectRegions(allText(c))) regions.add(r);

	return {
		citizensServed: {
			value: served,
			// A delta reveals the prior total (prior = value / (1 + delta/100)), so it is
			// shown ONLY when the prior period itself clears K — otherwise it would leak a
			// sub-K figure.
			deltaPct: servedPrior >= K_ANON ? Math.round(((served - servedPrior) / servedPrior) * 100) : null,
			direction: served > servedPrior ? 'up' : served < servedPrior ? 'down' : 'flat'
		},
		resolvedShare: served >= K_ANON ? pct(resolved, served) : null,
		regionsReached: { value: regions.size, of: TZ_REGION_COUNT },
		swahiliShare: classified >= K_ANON ? pct(sw, classified) : null
	};
}

/** 2. What citizens are asking about — ranked topics with period-on-period change.
 *  Rows below K are suppressed. */
function topicsAsked(cur, prior) {
	const count = (convs) => {
		const m = new Map();
		for (const c of convs) { const text = userText(c); for (const t of topicsOf(text)) m.set(t.key, (m.get(t.key) || 0) + 1); }
		return m;
	};
	const now = count(cur), was = count(prior);
	return TOPICS
		.map((t) => {
			const n = now.get(t.key) || 0, p = was.get(t.key) || 0;
			return {
				key: t.key, label: t.label, count: n,
				// prior count must itself clear K — a delta otherwise discloses a sub-K
				// prior-period cell (prior ≈ count / (1 + delta/100)).
				deltaPct: p >= K_ANON ? Math.round(((n - p) / p) * 100) : null,
				direction: n > p ? 'up' : n < p ? 'down' : 'flat'
			};
		})
		.filter((r) => r.count >= K_ANON) // k-anon: only topics with real volume
		.sort((a, b) => b.count - a.count)
		.slice(0, 6);
}

/** 3. Where citizens get stuck — clusters the service could not resolve, ranked by
 *  volume. Representative phrasing is the topic's TEMPLATED label (never citizen
 *  text). Rows below K are suppressed. */
function stuckClusters(cur) {
	const byTopic = new Map(); // key → { label, count, regions:Map, kinds:Map }
	for (const c of cur) {
		const kind = stuckKind(c);
		if (!kind) continue;
		const topics = topicsOf(userText(c));
		const primary = topics[0] || { key: 'other', label: 'General enquiries' };
		let e = byTopic.get(primary.key);
		if (!e) { e = { label: primary.label, count: 0, regions: new Map(), kinds: new Map() }; byTopic.set(primary.key, e); }
		e.count++;
		e.kinds.set(kind, (e.kinds.get(kind) || 0) + 1);
		for (const r of detectRegions(allText(c))) e.regions.set(r, (e.regions.get(r) || 0) + 1);
	}
	return [...byTopic.values()]
		.filter((e) => e.count >= K_ANON) // k-anon
		.sort((a, b) => b.count - a.count)
		.slice(0, 6)
		.map((e) => {
			const topRegion = [...e.regions.entries()].sort((a, b) => b[1] - a[1])[0];
			const topKind = [...e.kinds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
			return {
				label: e.label,
				count: e.count,
				// only name a region if it too clears K (else it could identify)
				region: topRegion && topRegion[1] >= K_ANON ? topRegion[0] : null,
				cause: CAUSE[topKind] ?? null
			};
		});
}

/** 4. Demand by region — top regions by volume, plus the coverage gap (regions with
 *  no activity), which is a mandate-relevant finding, not an omission. */
function demandByRegion(cur) {
	const counts = new Map();
	for (const c of cur) for (const r of detectRegions(allText(c))) counts.set(r, (counts.get(r) || 0) + 1);
	const ranked = [...counts.entries()]
		.map(([region, count]) => ({ region, count }))
		.filter((r) => r.count >= K_ANON) // k-anon
		.sort((a, b) => b.count - a.count);
	const active = new Set(ranked.map((r) => r.region));
	// A region with 1–9 conversations is neither "active" (would breach k-anon to
	// list) nor cleanly "no activity"; treat only genuinely-zero regions as gaps.
	const noActivity = TZ_REGIONS.filter((r) => !counts.has(r));
	return { top: ranked.slice(0, 8), noActivity, noActivityCount: noActivity.length };
}

/** 5. Signals to review — automatically surfaced changes worth a decision. Each is
 *  emitted only when its supporting count clears K (except region-coverage, which is
 *  a safe category count). */
function signals(cur, prior, topics) {
	const out = [];

	// unusual rise in a topic (already k-safe: topics are ≥K) — flag ≥50% growth
	for (const t of topics) {
		if (t.deltaPct != null && t.deltaPct >= 50) out.push({ severity: 'warn', text: `Sharp rise in “${t.label}” enquiries`, count: t.count });
	}

	// fraud / off-channel payment mentions
	const fraud = cur.filter((c) => FRAUD_RE.test(userText(c))).length;
	if (fraud >= K_ANON) out.push({ severity: 'danger', text: 'Citizens mentioning payments requested to personal numbers', count: fraud });

	// resolution-rate drop vs prior period
	if (cur.length >= K_ANON && prior.length >= K_ANON) {
		const rNow = pct(cur.filter((c) => stuckKind(c) === null).length, cur.length);
		const rWas = pct(prior.filter((c) => stuckKind(c) === null).length, prior.length);
		if (rNow != null && rWas != null && rWas - rNow >= 10) out.push({ severity: 'danger', text: `Resolution rate fell from ${rWas}% to ${rNow}%`, count: cur.length });
	}

	// coverage gap: regions with no citizen enquiries (safe category count)
	if (cur.length >= K_ANON) {
		const covered = new Set();
		for (const c of cur) for (const r of detectRegions(allText(c))) covered.add(r);
		const gaps = TZ_REGIONS.length - covered.size;
		if (gaps > 0) out.push({ severity: 'neutral', text: `${gaps} of ${TZ_REGION_COUNT} regions had no citizen enquiries this period`, count: gaps });
	}

	return out.slice(0, 6);
}

// ---- orchestrator ----------------------------------------------------------
/**
 * Build the whole leadership dashboard from a window of conversations.
 * @param conversations rows [{ id, messages, summary, created_at }] covering AT LEAST
 *        the current + prior period (2 × periodDays back from `now`).
 * @param opts { now?: number (ms), periodDays?: number }
 */
export function buildGovDashboard(conversations, opts = {}) {
	const now = Number.isFinite(opts.now) ? opts.now : Date.now();
	const periodDays = opts.periodDays || 30;
	const day = 86400000;
	const curFrom = now - periodDays * day;
	const priorFrom = now - 2 * periodDays * day;

	// Only conversations carrying a real citizen enquiry count. An empty/abandoned
	// session row is not a citizen served — and, having no assistant text to trip a
	// fallback marker, would otherwise be miscounted as "resolved".
	const list = (Array.isArray(conversations) ? conversations : []).filter((c) => userMsgs(c).length >= 1);
	const cur = list.filter((c) => inWindow(c, curFrom, now));
	const prior = list.filter((c) => inWindow(c, priorFrom, curFrom));

	const lowData = cur.length < K_ANON;
	const meta = {
		periodDays,
		generatedAt: new Date(now).toISOString(),
		totalInPeriod: lowData ? null : cur.length, // never emit a sub-K count in the payload
		kAnon: K_ANON,
		lowData
	};

	// Below the k-anon floor for the whole period → NO figure leaves the service
	// (suppression here, not in the template, so the hydration payload / any export
	// can't be mined). Only the honest low-data state remains.
	if (lowData) {
		return {
			meta,
			summary: { citizensServed: null, resolvedShare: null, regionsReached: null, swahiliShare: null },
			topics: [], stuck: [], region: { top: [], noActivity: [], noActivityCount: 0 }, signals: []
		};
	}

	const topics = topicsAsked(cur, prior);
	return {
		meta,
		summary: summaryRow(cur, prior),
		topics,
		stuck: stuckClusters(cur),
		region: demandByRegion(cur),
		signals: signals(cur, prior, topics)
	};
}
