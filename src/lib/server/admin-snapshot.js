// One honest, real-data snapshot of the whole platform, shared by every
// super-admin screen (dashboard summary + Revenue / Clients / Settings pages)
// so they never diverge. Everything derives from existing tables (no fabricated
// bookings, GMV, geography, or historical snapshots) via pure helpers in
// server/admin.js. Small data set (a handful of tenants), so re-running the full
// snapshot per page load is cheap and keeps each page's loader a one-liner.
import { supabase } from '$lib/server/supabase.js';
import { monthStartISO } from '$lib/server/tenant.js';
import { scoreLead, leadTier } from '$lib/server/dashboard.js';
import { AVG_COST_PER_CONVERSATION } from '$lib/server/credits.js';
import { env } from '$env/dynamic/private';
import {
	revenue,
	clientHealth,
	lastActiveAt,
	attention,
	opportunities,
	activity,
	leaderboard,
	aiSpend,
	dailySeries,
	growthSeries,
	platformInsight
} from '$lib/server/admin.js';
import { industryRollups, execSummary, platformInsights } from '$lib/server/admin-intelligence.js';

const DAY = 86400000;

/** Per-client total + this-month counts, plus the newest timestamp seen. */
function tally(rows, since) {
	const total = {};
	const month = {};
	const last = {};
	for (const r of rows ?? []) {
		total[r.client_id] = (total[r.client_id] ?? 0) + 1;
		if (since && r.created_at && r.created_at >= since) month[r.client_id] = (month[r.client_id] ?? 0) + 1;
		if (r.created_at && (!last[r.client_id] || r.created_at > last[r.client_id])) last[r.client_id] = r.created_at;
	}
	return { total, month, last };
}

const dayBounds = () => {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	return { todayISO: start.toISOString(), yestISO: new Date(start.getTime() - DAY).toISOString() };
};

/**
 * Full platform snapshot. Returns `{ loadError }` (with empty clients) if the
 * clients query fails or the database is unreachable, so pages can show a notice.
 */
export async function adminSnapshot({ locals }) {
	const since = monthStartISO();
	const { todayISO, yestISO } = dayBounds();
	try {
		const [clientsRes, convRes, leadRes, itemRes, usageRes, usersRes, payAttRes, payEvtRes] = await Promise.all([
			supabase
				.from('clients')
				.select('*')
				.order('created_at', { ascending: false }),
			supabase.from('conversations').select('client_id, created_at'),
			supabase.from('leads').select('client_id, name, whatsapp, email, interest, transcript, created_at').order('created_at', { ascending: false }).limit(500),
			supabase.from('knowledge_items').select('client_id, updated_at'),
			supabase.from('usage_records').select('*').gte('created_at', since),
			supabase.from('users').select('name, role, client_id, last_login_at'),
			supabase.from('payment_attempts').select('*').order('created_at', { ascending: false }).limit(50),
			supabase.from('payment_events').select('event_type, created_at').order('created_at', { ascending: false }).limit(50)
		]);

		if (clientsRes.error) return { clients: [], loadError: clientsRes.error.message };

		const plansRes = await supabase.from('plans').select('*').order('sort');
		const plans = plansRes.data ?? [];
		// Real per-plan capacity ≈ conversations from the AI budget (the basis the
		// billing + plan screens use), falling back to the legacy hard cap. Used
		// for the client cards' "% of cap" and the near-limit / upgrade signals.
		const capByPlan = new Map(
			plans.map((p) => {
				const budget = Number(p.included_ai_budget) || 0;
				return [p.key, budget > 0 ? Math.round(budget / AVG_COST_PER_CONVERSATION) : Number(p.monthly_conversation_cap) || 0];
			})
		);

		const conv = tally(convRes.data, since);
		const leadsT = tally(leadRes.data, since);
		const items = tally(itemRes.data);
		// knowledge freshness: newest updated_at per client
		const kFresh = {};
		for (const r of itemRes.data ?? []) if (r.updated_at && (!kFresh[r.client_id] || r.updated_at > kFresh[r.client_id])) kFresh[r.client_id] = r.updated_at;
		// last login per client (operator accounts)
		const login = {};
		for (const u of usersRes.data ?? []) if (u.client_id && u.last_login_at && (!login[u.client_id] || u.last_login_at > login[u.client_id])) login[u.client_id] = u.last_login_at;

		// Enrich each tenant with real per-client aggregates + a health score.
		const clients = (clientsRes.data ?? []).map((c) => {
			const enriched = {
				...c,
				conversations: conv.total[c.id] ?? 0,
				conversationsMonth: conv.month[c.id] ?? 0,
				leads: leadsT.total[c.id] ?? 0,
				leadsMonth: leadsT.month[c.id] ?? 0,
				items: items.total[c.id] ?? 0,
				lastConversationAt: conv.last[c.id] ?? null,
				lastLeadAt: leadsT.last[c.id] ?? null,
				knowledgeUpdatedAt: kFresh[c.id] ?? null,
				// Budget-derived capacity (falls back to the client's own cap).
				aiCapacity: capByPlan.get(c.plan) ?? Number(c.monthly_conversation_cap) ?? 0,
				last_login_at: login[c.id] ?? null
			};
			enriched.health = clientHealth(enriched);
			enriched.lastActive = lastActiveAt(enriched);
			return enriched;
		});

		// Qualified leads (hot/warm) across the fleet, from the real scorer.
		let qualified = 0;
		for (const l of leadRes.data ?? []) {
			const cls = leadTier(scoreLead(l)).cls;
			if (cls === 'hot' || cls === 'warm') qualified += 1;
		}

		const rev = revenue(clients, plans);
		const nameById = Object.fromEntries(clients.map((c) => [c.id, c.name]));
		const spend = aiSpend(usageRes.error ? [] : usageRes.data, nameById);

		// Real day-over-day deltas (we have timestamps; no fabrication).
		const countAtLeast = (rows, iso) => (rows ?? []).filter((r) => r.created_at >= iso).length;
		const convToday = countAtLeast(convRes.data, todayISO);
		const convYest = countAtLeast(convRes.data, yestISO) - convToday;
		const leadsToday = countAtLeast(leadRes.data, todayISO);
		const leadsYest = countAtLeast(leadRes.data, yestISO) - leadsToday;

		// Mean client-health score (0–100), so KPI tiles need not re-derive it.
		const avgHealth = clients.length ? Math.round(clients.reduce((s, c) => s + (c.health?.score ?? 0), 0) / clients.length) : 0;

		const totals = {
			clients: clients.length,
			active: clients.filter((c) => c.is_active).length,
			newThisMonth: clients.filter((c) => c.created_at >= since).length,
			conversations: convRes.data?.length ?? 0,
			conversationsMonth: Object.values(conv.month).reduce((a, b) => a + b, 0),
			convToday,
			convYest,
			leads: leadRes.data?.length ?? 0,
			leadsMonth: Object.values(leadsT.month).reduce((a, b) => a + b, 0),
			leadsToday,
			leadsYest,
			qualified,
			items: itemRes.data?.length ?? 0,
			avgConv: clients.length ? Math.round((convRes.data?.length ?? 0) / clients.length) : 0,
			avgLeads: clients.length ? +((leadRes.data?.length ?? 0) / clients.length).toFixed(1) : 0,
			avgHealth
		};

		// Billing snapshot (real where the payment tables have data).
		const failedPayments = (payAttRes.data ?? []).filter((p) => /fail|declin|error/i.test(p.status ?? '')).length;
		const upcomingRenewals = clients.filter((c) => c.plan_renews_at && new Date(c.plan_renews_at).getTime() - Date.now() < 7 * DAY && new Date(c.plan_renews_at).getTime() > Date.now()).length;
		const trialing = clients.filter((c) => c.subscription_status === 'trialing').length;
		const pastDue = clients.filter((c) => c.subscription_status === 'past_due').length;
		const canceled = clients.filter((c) => c.subscription_status === 'canceled').length;

		// LIVE platform health — point-in-time checks (not historical uptime).
		const has = (k) => !!(env[k] && String(env[k]).trim());
		const health = {
			ok: true,
			checks: [
				{ name: 'Database', status: 'operational', note: 'Reachable' },
				{ name: 'AI models', status: has('ANTHROPIC_API_KEY') ? 'operational' : 'unconfigured', note: has('ANTHROPIC_API_KEY') ? 'Claude connected' : 'No API key' },
				{ name: 'Embeddings', status: has('VOYAGE_API_KEY') ? 'operational' : 'unconfigured', note: has('VOYAGE_API_KEY') ? 'Voyage connected' : 'No API key' },
				{ name: 'Payments', status: has('SNIPPE_API_KEY') && has('SNIPPE_WEBHOOK_SECRET') ? 'operational' : 'unconfigured', note: has('SNIPPE_API_KEY') ? 'Snippe connected' : 'Not set up' },
				{ name: 'Email alerts', status: has('RESEND_API_KEY') ? 'operational' : 'unconfigured', note: has('RESEND_API_KEY') ? 'Resend connected' : 'No API key' }
			],
			paymentEventsToday: (payEvtRes.data ?? []).filter((e) => e.created_at >= todayISO).length
		};
		health.ok = health.checks.every((c) => c.status === 'operational');

		const superName = (usersRes.data ?? []).find((u) => u.role === 'super_admin')?.name || locals.user?.name || null;

		// Command-center intelligence — per-industry rollups, executive summary,
		// and a deterministic platform-insight feed. All real, all derived here.
		const billing = { failedPayments, upcomingRenewals, trialing, pastDue, canceled, mrr: rev.mrr, arr: rev.arr, currency: rev.currency };
		const industries = industryRollups(clients, plans, spend.costByClient);

		return {
			superName,
			totals,
			revenue: rev,
			spend,
			health,
			billing,
			industries,
			execSummary: execSummary({ totals, revenue: rev, spend, billing }),
			platformInsights: platformInsights({ clients, revenue: rev, spend, industries, totals, billing }),
			attention: attention(clients),
			opportunities: opportunities(clients, plans),
			activity: activity(convRes.data, leadRes.data, clients),
			leaders: {
				conversations: leaderboard(clients, 'conversations'),
				leads: leaderboard(clients, 'leads')
			},
			insight: platformInsight(clients),
			trends: {
				conversations: dailySeries(convRes.data, 14),
				leads: dailySeries(leadRes.data, 14),
				growth: growthSeries(clients, 30)
			},
			clients
		};
	} catch (err) {
		return { clients: [], loadError: err?.message ?? 'Could not reach the database.' };
	}
}
