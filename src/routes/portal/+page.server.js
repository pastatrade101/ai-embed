import { loadWorkspace } from '$lib/server/tenant.js';
import { supabase } from '$lib/server/supabase.js';
import { listTours } from '$lib/server/tours.js';
import { scoreLead, leadTier, topInterests, pipeline, activityFeed, aiTasks } from '$lib/server/dashboard.js';

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

	const [{ count: convToday }, { count: leadsToday }, tourItems] = await Promise.all([
		supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', dayISO),
		supabase.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', dayISO),
		listTours(clientId)
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

	const dash = {
		convToday: convToday ?? 0,
		leadsToday: leadsToday ?? 0,
		lastConversationAt: ws.conversations[0]?.created_at ?? null,
		lastLeadAt: ws.leads[0]?.created_at ?? null,
		knowledgeUpdatedAt: ws.items[0]?.updated_at ?? null,
		interests: topInterests(ws.conversations, tours),
		pipeline: pipeline(scoredLeads, tours),
		activity: activityFeed(ws.conversations, ws.leads),
		tasks: aiTasks({ client, stats: ws.stats, leads: ws.leads, items: ws.items })
	};

	return { ...ws, leads: scoredLeads, dash };
}
