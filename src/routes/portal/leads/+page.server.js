import { supabase } from '$lib/server/supabase.js';
import { listTours } from '$lib/server/tours.js';
import { scoreLead, leadTier, extractLead } from '$lib/server/dashboard.js';

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

/** Recommend a next step from real signals — no fabricated CRM state. */
function nextAction(lead, detail, score) {
	const hasPhone = !!lead.whatsapp;
	if (score >= 78) return detail.tour ? `Send a quote for ${detail.tour}` : 'Send a quote today';
	if (score >= 55) return hasPhone ? 'Reply on WhatsApp while warm' : detail.email ? 'Reply by email while warm' : 'Reach out while warm';
	if (!detail.month) return 'Ask when they’d like to travel';
	if (!detail.tour) return 'Suggest tours that fit their trip';
	return 'Follow up with options';
}

export async function load({ locals, parent }) {
	const clientId = locals.user.client_id;
	const { client } = await parent();

	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - 7);

	const [{ data: rawLeads }, tourItems] = await Promise.all([
		supabase.from('leads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(200),
		listTours(clientId)
	]);

	const tours = (tourItems ?? []).map((t) => ({
		title: t.title,
		price: t.price_amount ?? null,
		currency: t.price_currency ?? 'USD',
		destination: metaGet(t.metadata, 'destination', 'route', 'park', 'location'),
		season: metaGet(t.metadata, 'season', 'month')
	}));

	const leads = (rawLeads ?? []).map((l) => {
		const score = scoreLead(l);
		const detail = extractLead(l, tours);
		return { ...l, score, tier: leadTier(score), detail, action: nextAction(l, detail, score) };
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

	// "Contact first": the strongest warm/hot lead that arrived recently.
	const priority = [...leads].filter((l) => isWeek(l.created_at) && l.score >= 55).sort((a, b) => b.score - a.score)[0] ?? null;

	const summary = {
		todayCount: todays.length,
		weekCount: leads.filter((l) => isWeek(l.created_at)).length,
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

	const stats = {
		today: todays.length,
		hot: hot.length,
		warmPlus: hot.length + warm.length,
		total: leads.length,
		pipelineValue,
		avgScore,
		currency,
		matched: leads.filter((l) => l.detail.estValue != null).length
	};

	const insights = {
		topDestination: destTally[0]?.[0] ?? null,
		topMonth: monthTally[0]?.[0] ?? null,
		hotCount: hot.length
	};

	return { leads, stats, summary, insights, client };
}
