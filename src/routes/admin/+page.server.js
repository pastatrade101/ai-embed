// Admin dashboard: workspace overview + per-client stats.
import { supabase } from '$lib/server/supabase.js';
import { monthStartISO } from '$lib/server/tenant.js';

function tally(rows, since) {
	const total = {};
	const month = {};
	for (const r of rows ?? []) {
		total[r.client_id] = (total[r.client_id] ?? 0) + 1;
		if (since && r.created_at && r.created_at >= since) month[r.client_id] = (month[r.client_id] ?? 0) + 1;
	}
	return { total, month };
}

export async function load() {
	const since = monthStartISO();
	try {
		const [clientsRes, convRes, leadRes, itemRes] = await Promise.all([
			supabase
				.from('clients')
				.select('id, slug, name, business_type, plan, subscription_status, is_active, brand_color, monthly_conversation_cap, created_at')
				.order('created_at', { ascending: false }),
			supabase.from('conversations').select('client_id, created_at'),
			supabase.from('leads').select('client_id, created_at'),
			supabase.from('knowledge_items').select('client_id')
		]);

		if (clientsRes.error) return { clients: [], totals: null, loadError: clientsRes.error.message };

		// Fleet AI cost this month — resilient if usage_records isn't present yet.
		let aiCostMonth = 0;
		const usageRes = await supabase.from('usage_records').select('estimated_cost').gte('created_at', since);
		if (!usageRes.error && usageRes.data) {
			aiCostMonth = usageRes.data.reduce((a, r) => a + Number(r.estimated_cost || 0), 0);
		}

		const conv = tally(convRes.data, since);
		const leads = tally(leadRes.data, since);
		const items = tally(itemRes.data);

		const clients = (clientsRes.data ?? []).map((c) => ({
			...c,
			conversations: conv.total[c.id] ?? 0,
			conversationsMonth: conv.month[c.id] ?? 0,
			leads: leads.total[c.id] ?? 0,
			items: items.total[c.id] ?? 0
		}));

		const totals = {
			clients: clients.length,
			active: clients.filter((c) => c.is_active).length,
			conversations: convRes.data?.length ?? 0,
			conversationsMonth: Object.values(conv.month).reduce((a, b) => a + b, 0),
			leads: leadRes.data?.length ?? 0,
			leadsMonth: Object.values(leads.month).reduce((a, b) => a + b, 0),
			items: itemRes.data?.length ?? 0,
			aiCostMonth
		};

		return { clients, totals };
	} catch (err) {
		return { clients: [], totals: null, loadError: err?.message ?? 'Could not reach the database.' };
	}
}
