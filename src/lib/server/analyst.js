// AI Data Analyst — answers the operator's questions about their OWN business data.
// Safety by construction: the server assembles a tenant-scoped snapshot (aggregates
// + a small sample) and the model reasons only over what it's handed — there is no
// SQL, no query execution, and no way to reach another tenant's rows. Grounded like
// the rest of the product: it answers only from the snapshot and never invents.
import { supabase } from '$lib/server/supabase.js';
import { monthStartISO } from '$lib/server/tenant.js';
import { listTours, departuresByItem } from '$lib/server/tours.js';
import { scoreLead, leadTier, leadStage, extractLead, pipeline, catalogueGaps, customerQuestions } from '$lib/server/dashboard.js';
import { askText, AI, SONNET } from '$lib/server/ai.js';

// Aggregate over the most-recent N leads (plenty for the target market). Exact
// totals still come from head-count queries so reported numbers are never capped.
const LEAD_SAMPLE = 500;
const CONV_SAMPLE = 300;

const metaGet = (md, ...keys) => {
	if (!md || typeof md !== 'object') return null;
	for (const k of Object.keys(md)) {
		if (keys.some((w) => k.toLowerCase().includes(w))) {
			const v = md[k];
			if (v != null && String(v).trim()) return String(v).trim();
		}
	}
	return null;
};

const tally = (arr) => {
	const m = new Map();
	for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
	return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/** Compile a compact, PII-light snapshot of one operator's business. Counts are
 *  EXACT (head-count queries); aggregates are computed over the most-recent
 *  LEAD_SAMPLE / CONV_SAMPLE rows, with the basis surfaced so the model can caveat. */
export async function analystSnapshot(clientId) {
	const monthStart = monthStartISO();
	const [tourItems, rawLeadsRes, leadTotalRes, leadMonthRes, convRes, convTotalRes, convMonthRes] = await Promise.all([
		listTours(clientId).then((t) => t ?? []),
		supabase.from('leads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(LEAD_SAMPLE),
		supabase.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
		supabase.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', monthStart),
		supabase.from('conversations').select('messages, summary, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(CONV_SAMPLE),
		supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
		supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', monthStart)
	]);
	const rawLeads = rawLeadsRes.data ?? [];
	const convRows = convRes.data ?? [];
	const leadsTotal = leadTotalRes.count ?? rawLeads.length;
	const leadsThisMonth = leadMonthRes.count ?? 0;
	const convTotal = convTotalRes.count ?? convRows.length;
	const convThisMonth = convMonthRes.count ?? 0;

	const deps = await departuresByItem(clientId, tourItems.map((t) => t.id)).catch(() => ({}));
	const tours = tourItems.map((t) => ({
		title: t.title,
		price: t.price_amount ?? null,
		currency: t.price_currency ?? 'USD',
		destination: metaGet(t.metadata, 'destination', 'route', 'park', 'location'),
		season: metaGet(t.metadata, 'season', 'month'),
		duration: metaGet(t.metadata, 'duration'),
		upcomingDepartures: (deps[t.id] ?? []).slice(0, 4).map((d) => ({ date: d.start_date, seats: d.seats_available ?? null, status: d.status ?? 'open' }))
	}));
	const currency = tours.find((t) => t.price != null)?.currency ?? 'USD';

	const leads = rawLeads.map((l) => {
		const score = scoreLead(l);
		const detail = extractLead(l, tours);
		return { ...l, score, tier: leadTier(score), stage: leadStage(l, detail, score), detail };
	});
	const pipe = pipeline(leads, tours);
	const stageCounts = {};
	for (const l of leads) stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1;
	const tierCounts = {};
	for (const l of leads) tierCounts[l.tier.cls] = (tierCounts[l.tier.cls] ?? 0) + 1;
	const won = leads.filter((l) => l.stage === 'won');
	const decided = leads.filter((l) => l.stage === 'won' || l.stage === 'lost').length;

	// True if aggregates below cover only a recent slice of a larger history.
	const leadsSampled = leads.length;
	const leadAggregatesCapped = leadsTotal > leadsSampled;

	return {
		currency,
		tours,
		catalogue: { count: tours.length, priced: tours.filter((t) => t.price != null).length },
		leads: {
			total: leadsTotal,
			thisMonth: leadsThisMonth,
			// Aggregates below are computed over the most recent `analysedLeads` leads.
			analysedLeads: leadsSampled,
			aggregatesCoverRecentOnly: leadAggregatesCapped,
			byTier: tierCounts,
			byStage: stageCounts,
			potentialValue: pipe.value,
			bookedValue: won.reduce((s, l) => s + (l.detail.estValue ?? 0), 0),
			bookedCount: won.length,
			conversionPct: decided ? Math.round((won.length / decided) * 100) : null,
			topDestinations: tally(leads.map((l) => l.detail.destination)).slice(0, 6),
			topMonths: tally(leads.map((l) => l.detail.month)).slice(0, 6),
			topCountries: tally(leads.map((l) => l.detail.country)).slice(0, 6),
			// Small sample — first name only, no phone/email.
			sample: leads.slice(0, 20).map((l) => ({
				name: (l.name || 'Anonymous').split(/\s+/)[0],
				tier: l.tier.label,
				stage: l.stage,
				destination: l.detail.destination,
				month: l.detail.month,
				budget: l.detail.budget,
				adults: l.detail.group,
				children: l.detail.children,
				estValue: l.detail.estValue
			}))
		},
		conversations: { total: convTotal, thisMonth: convThisMonth, analysedConversations: convRows.length, topQuestions: customerQuestions(convRows, 8) },
		opportunities: catalogueGaps(convRows, tours)
	};
}

const SYSTEM = `You are the data analyst for a tour operator, embedded in their dashboard. You answer questions about THEIR business using only the JSON snapshot provided.

Rules:
- Answer ONLY from the DATA below. Never invent numbers, tours, or trends that aren't in it.
- "leads.total", "leads.thisMonth", "conversations.total" and "conversations.thisMonth" are EXACT counts. Use them for any "how many" question.
- Breakdowns (byTier, byStage, values, topDestinations/Months/Countries) are computed over the most recent "analysedLeads" leads. If "aggregatesCoverRecentOnly" is true, say these reflect recent leads, not the full history.
- If the data doesn't cover the question, say so plainly and suggest what to track.
- Amounts are in the operator's currency (see "currency"). Format money with that currency.
- Be concise and practical — a busy operator wants the answer and the "so what", not a lecture.
- When useful, point to a concrete next action grounded in the numbers.
- Prefer short paragraphs or tight bullet lists. No preamble like "Based on the data".`;

/** Answer one analyst question. Gated + metered via ai.js. */
export async function askAnalyst(clientId, planKey, question) {
	const snapshot = await analystSnapshot(clientId);
	const res = await askText({
		clientId,
		planKey,
		feature: AI.DATA_ANALYST,
		model: SONNET,
		maxTokens: 1500,
		system: SYSTEM,
		messages: [{ role: 'user', content: `DATA (this operator only):\n${JSON.stringify(snapshot)}\n\nQUESTION: ${question}` }]
	});
	return res;
}
