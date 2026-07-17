import { supabase } from '$lib/server/supabase.js';
import { fail } from '@sveltejs/kit';
import { listTours } from '$lib/server/tours.js';
import { scoreLead, leadTier, extractLead, leadStage, STAGES, catalogueGaps } from '$lib/server/dashboard.js';
import { serverIndustry } from '$lib/server/industries.js';

const OPERATOR_STAGES = ['contacted', 'quoted', 'won', 'lost'];

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

/** Recommend a next step from real signals — no fabricated CRM state. The
 *  action copy comes from the tenant's Industry Registry entry (tourism verbatim). */
function nextAction(lead, detail, score, acts) {
	const hasPhone = !!lead.whatsapp;
	if (score >= 78) return detail.tour ? acts.quoteNamed(detail.tour) : acts.quote;
	if (score >= 55) return hasPhone ? 'Reply on WhatsApp while warm' : detail.email ? 'Reply by email while warm' : 'Reach out while warm';
	if (!detail.month) return acts.askTiming;
	if (!detail.tour) return acts.suggestItems;
	return 'Follow up with options';
}

export async function load({ locals, parent }) {
	const clientId = locals.user.client_id;
	const { client } = await parent();
	const ind = serverIndustry(client);

	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - 7);

	const [{ data: rawLeads }, tourItems, { data: convs }] = await Promise.all([
		supabase.from('leads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(200),
		listTours(clientId),
		supabase.from('conversations').select('messages, summary, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(300)
	]);

	const tours = (tourItems ?? []).map((t) => ({
		title: t.title,
		price: t.price_amount ?? null,
		currency: t.price_currency ?? 'USD',
		destination: metaGet(t.metadata, 'destination', 'route', 'park', 'location'),
		season: metaGet(t.metadata, 'season', 'month')
	}));

	// Does the pipeline migration exist yet? (leads.status). Until it's applied,
	// stages are AI-derived only and the operator's stage control is inert.
	const pipelineReady = rawLeads?.length ? 'status' in rawLeads[0] : true;

	// Prefer the AI's structured extraction (leads.details) when present, keeping the
	// regex extractor as the baseline (and for the tour-price-based value estimate).
	const mergeDetail = (l) => {
		const base = extractLead(l, tours);
		const d = l.details && typeof l.details === 'object' ? l.details : null;
		if (!d) return base;
		return {
			...base,
			destination: d.destination || base.destination,
			tour: d.tour || base.tour,
			month: d.travel || base.dates || base.month,
			dates: null,
			group: d.adults ?? base.group,
			children: d.children ?? base.children,
			country: d.country || base.country,
			accommodation: d.accommodation || base.accommodation,
			budget: d.budget ?? base.budget
		};
	};

	const leads = (rawLeads ?? []).map((l) => {
		const score = scoreLead(l);
		const detail = mergeDetail(l);
		return { ...l, score, tier: leadTier(score), detail, stage: leadStage(l, detail, score), action: nextAction(l, detail, score, ind.nextActions) };
	});

	// --- CRM aggregates (all from real, scored data) ---
	const currency = tours.find((t) => t.price != null)?.currency ?? 'USD';
	const isToday = (d) => d && new Date(d) >= start;
	const isWeek = (d) => d && new Date(d) >= weekStart;

	const todays = leads.filter((l) => isToday(l.created_at));
	const hot = leads.filter((l) => l.tier.cls === 'hot');
	const warm = leads.filter((l) => l.tier.cls === 'warm');
	const pipelineValue = leads.reduce((s, l) => s + (l.detail.estValue ?? 0), 0);
	const avgScore = leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0;

	const tally = (arr) => {
		const m = new Map();
		for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
		return [...m.entries()].sort((a, b) => b[1] - a[1]);
	};
	const destTally = tally(leads.map((l) => l.detail.destination));
	const monthTally = tally(leads.map((l) => l.detail.month));
	const highBudget = leads.filter((l) => (l.detail.budget ?? 0) >= 5000);

	// Conversation volume (the AI's workload) + opportunities the catalogue misses.
	const conversations = convs ?? [];
	const convToday = conversations.filter((c) => isToday(c.created_at)).length;
	const gaps = catalogueGaps(conversations, tours, 3, ind.gapThemes);

	// "Contact first": the strongest warm/hot lead that arrived recently.
	const priority = [...leads].filter((l) => isWeek(l.created_at) && l.score >= 55).sort((a, b) => b.score - a.score)[0] ?? null;

	const summary = {
		convToday,
		todayCount: todays.length,
		weekCount: leads.filter((l) => isWeek(l.created_at)).length,
		qualifiedCount: leads.filter((l) => l.stage === 'qualified' || l.tier.cls === 'hot' || l.tier.cls === 'warm').length,
		pipelineValue,
		topMonth: monthTally[0] ?? null,
		topDestination: destTally[0] ?? null,
		highBudgetCount: highBudget.length,
		priority: priority
			? {
					name: priority.name || 'this customer',
					tour: priority.detail.tour,
					month: priority.detail.month,
					phone: !!priority.whatsapp,
					action: priority.action
			  }
			: null
	};

	// --- Sales pipeline + revenue ---
	const stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0]));
	for (const l of leads) stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1;
	const won = leads.filter((l) => l.stage === 'won');
	const wonValue = won.reduce((s, l) => s + (l.detail.estValue ?? 0), 0);
	// Conversion = booked ÷ (booked + everything closed or actioned), only meaningful
	// once the operator has been marking outcomes.
	const decided = leads.filter((l) => l.stage === 'won' || l.stage === 'lost').length;
	const conversion = decided ? Math.round((won.length / decided) * 100) : null;

	const stats = {
		today: todays.length,
		hot: hot.length,
		warmPlus: hot.length + warm.length,
		total: leads.length,
		pipelineValue,
		wonValue,
		wonCount: won.length,
		conversion,
		avgScore,
		currency,
		matched: leads.filter((l) => l.detail.estValue != null).length
	};

	const insights = {
		topDestination: destTally[0]?.[0] ?? null,
		topMonth: monthTally[0]?.[0] ?? null,
		hotCount: hot.length
	};

	return { leads, stats, summary, insights, stageCounts, gaps, pipelineReady, client };
}

export const actions = {
	// Move a lead through the pipeline. Requires the leads.status column (migration
	// 011); until then it returns a clear, non-fatal message.
	setStatus: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '');
		if (!id || !OPERATOR_STAGES.includes(status)) return fail(400, { error: 'Invalid stage.' });
		const { error } = await supabase.from('leads').update({ status }).eq('id', id).eq('client_id', locals.user.client_id);
		if (error) {
			const needsMigration = /status.* column|column .*status|schema cache/i.test(error.message);
			return fail(needsMigration ? 409 : 400, {
				error: needsMigration ? 'Pipeline stages need a quick database update — run db/011_leads_pipeline.sql in Supabase to enable them.' : error.message
			});
		}
		return { ok: true, id, status };
	},

	// Clear an operator stage → the lead falls back to its AI-derived stage.
	clearStatus: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing lead.' });
		const { error } = await supabase.from('leads').update({ status: null }).eq('id', id).eq('client_id', locals.user.client_id);
		if (error) return fail(400, { error: error.message });
		return { ok: true, id, status: null };
	}
};
