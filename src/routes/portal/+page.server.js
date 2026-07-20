import { loadWorkspace, monthStartISO } from '$lib/server/tenant.js';
import { supabase } from '$lib/server/supabase.js';
import { listTours } from '$lib/server/tours.js';
import { scoreLead, leadTier, topInterests, pipeline, activityFeed, aiTasks } from '$lib/server/dashboard.js';
import { usageSummary } from '$lib/server/credits.js';
import { growthAdvisor } from '$lib/server/growth-advisor.js';
import { gatingOn } from '$lib/server/gating.js';
import { isModuleEnabled } from '$lib/server/modules.js';
import { orderStats } from '$lib/server/orders.js';

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

export async function load({ locals, parent }) {
	const clientId = locals.user.client_id;
	const { client } = await parent();
	const ws = await loadWorkspace(clientId);

	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const dayISO = start.toISOString();

	const [{ count: convToday }, { count: leadsToday }, tourItems, plansRes, credits] = await Promise.all([
		supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', dayISO),
		supabase.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', dayISO),
		listTours(clientId),
		supabase.from('plans').select('*').eq('is_active', true).order('sort'),
		usageSummary(clientId, client.plan)
	]);

	// Structured tours (existing data) for topic + pipeline derivation.
	const tours = tourItems.map((t) => ({
		title: t.title,
		price: t.price_amount ?? null,
		currency: t.price_currency ?? 'USD',
		destination: metaGet(t.metadata, 'destination', 'route', 'park', 'location'),
		season: metaGet(t.metadata, 'season', 'month')
	}));

	// Score leads and derive the AI-employee views.
	const scoredLeads = ws.leads.map((l) => {
		const score = scoreLead(l);
		return { ...l, score, tier: leadTier(score) };
	});

	// AI Growth Advisor — a subtle upgrade nudge, only when there's real reason to.
	const monthStart = monthStartISO();
	const monthLeads = scoredLeads.filter((l) => l.created_at >= monthStart);
	const qualifiedMonth = monthLeads.filter((l) => l.tier?.cls === 'hot' || l.tier?.cls === 'warm').length;
	const activePlans = plansRes.data ?? [];
	let currentPlan = activePlans.find((p) => p.key === client.plan) ?? null;
	if (!currentPlan) {
		const { data: cp } = await supabase.from('plans').select('*').eq('key', client.plan).maybeSingle();
		currentPlan = cp ?? null;
	}
	const advisor = growthAdvisor({
		client,
		plans: activePlans,
		currentPlan,
		credits,
		convMonth: ws.stats?.conversationsMonth ?? 0,
		leadsMonth: monthLeads.length,
		qualified: qualifiedMonth,
		itemsCount: ws.stats?.items ?? 0,
		gatingOn: gatingOn()
	});

	const dash = {
		convToday: convToday ?? 0,
		leadsToday: leadsToday ?? 0,
		lastConversationAt: ws.conversations[0]?.created_at ?? null,
		lastLeadAt: ws.leads[0]?.created_at ?? null,
		knowledgeUpdatedAt: ws.items[0]?.updated_at ?? null,
		interests: topInterests(ws.conversations, tours),
		pipeline: pipeline(scoredLeads, tours),
		activity: activityFeed(ws.conversations, ws.leads),
		tasks: aiTasks({ client, stats: ws.stats, leads: ws.leads, items: ws.items }),
		advisor:
			advisor.nudge && advisor.recommended
				? { headline: advisor.headline, topReason: advisor.reasons[0] ?? null, plan: { key: advisor.recommended.key, name: advisor.recommended.name }, strong: advisor.strong }
				: null
	};

	// Orders module widgets (only when enabled; fails open if migration 023 not run).
	const orders = isModuleEnabled(client, 'orders') ? await orderStats(clientId) : null;

	return { ...ws, leads: scoredLeads, dash, orders: orders && !orders.tableMissing ? orders : null };
}
