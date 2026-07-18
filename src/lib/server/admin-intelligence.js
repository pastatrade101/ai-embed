// Platform intelligence for the Super-Admin command center. Pure functions over
// the already-fetched admin snapshot — industry rollups, an executive summary,
// deterministic platform insights — plus the Platform Copilot (natural-language
// Q&A over a PII-light platform snapshot). Every number is REAL or honestly
// derivable; nothing here is fabricated.
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { INDUSTRIES, industryKeyOf } from '$lib/industries.js';
import { AVG_COST_PER_CONVERSATION } from '$lib/server/credits.js';
import { usdToLocal, USD_TO } from '$lib/fx.js';

const DAY = 86400000;
const money = (n, cur = 'USD') =>
	n == null ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
const num = (n) => new Intl.NumberFormat('en').format(Math.round(n ?? 0));
const pctCap = (c) => {
	const cap = Number(c.monthly_conversation_cap) || 0;
	return cap > 0 ? Math.round(((c.conversationsMonth ?? 0) / cap) * 100) : null;
};

/**
 * Per-industry rollups from the enriched clients. Uses real plan prices for MRR
 * and this-month AI cost per tenant. Industries with zero clients are omitted.
 */
export function industryRollups(clients, plans, costByClient = {}) {
	const price = new Map((plans ?? []).map((p) => [p.key, Number(p.price_amount) || 0]));
	const currency = (plans ?? []).find((p) => Number(p.price_amount) > 0)?.price_currency ?? 'USD';
	const monthAgo = Date.now() - 30 * DAY;
	const groups = new Map();

	for (const c of clients ?? []) {
		const key = industryKeyOf(c);
		if (!groups.has(key)) {
			const meta = INDUSTRIES[key] ?? INDUSTRIES.tourism;
			groups.set(key, {
				key,
				label: meta.label,
				icon: meta.icon,
				count: 0,
				active: 0,
				newThisMonth: 0,
				mrr: 0,
				paying: 0,
				convMonth: 0,
				healthSum: 0,
				aiCost: 0,
				items: 0,
				upgradeCandidates: 0,
				top: null,
				currency
			});
		}
		const g = groups.get(key);
		const p = price.get(c.plan) ?? 0;
		g.count += 1;
		if (c.is_active) g.active += 1;
		if (c.created_at && new Date(c.created_at).getTime() >= monthAgo) g.newThisMonth += 1;
		if (c.is_active && c.subscription_status === 'active' && p > 0) {
			g.mrr += p;
			g.paying += 1;
		}
		g.convMonth += c.conversationsMonth ?? 0;
		g.healthSum += c.health?.score ?? 0;
		g.aiCost += Number(costByClient[c.id]) || 0;
		g.items += c.items ?? 0;
		const cap = pctCap(c);
		if (cap != null && cap >= 80) g.upgradeCandidates += 1;
		// Top performer = highest health, tie-broken by conversation volume.
		const score = (c.health?.score ?? 0) * 1000 + (c.conversationsMonth ?? 0);
		if (!g.top || score > g.top._score) g.top = { name: c.name, slug: c.slug, health: c.health?.score ?? 0, convMonth: c.conversationsMonth ?? 0, _score: score };
	}

	return [...groups.values()]
		.map((g) => ({
			key: g.key,
			label: g.label,
			icon: g.icon,
			count: g.count,
			active: g.active,
			newThisMonth: g.newThisMonth,
			mrr: g.mrr,
			arr: g.mrr * 12,
			currency: g.currency,
			avgHealth: g.count ? Math.round(g.healthSum / g.count) : 0,
			totalConvMonth: g.convMonth,
			avgConvMonth: g.count ? Math.round(g.convMonth / g.count) : 0,
			totalAiCost: g.aiCost,
			avgAiCost: g.count ? g.aiCost / g.count : 0,
			totalItems: g.items,
			upgradeCandidates: g.upgradeCandidates,
			top: g.top ? { name: g.top.name, slug: g.top.slug, health: g.top.health, convMonth: g.top.convMonth } : null
		}))
		.sort((a, b) => b.mrr - a.mrr || b.count - a.count);
}

/**
 * Executive "today's summary" — a handful of real, tone-tagged bullets that
 * answer: is revenue growing, are customers active, is AI healthy, what's wrong.
 */
export function execSummary({ totals, revenue, spend, billing }) {
	const cur = revenue?.currency ?? 'USD';
	const out = [];

	// Revenue
	let rev = `Running ${money(revenue.mrr, cur)} MRR (${money(revenue.arr, cur)} ARR) across ${revenue.payingCount} paying ${revenue.payingCount === 1 ? 'client' : 'clients'}`;
	if (revenue.newMrrMonth > 0) rev += ` — ${money(revenue.newMrrMonth, cur)} added this month`;
	out.push({ tone: revenue.newMrrMonth > 0 ? 'good' : 'info', text: rev + '.' });

	// Activity today
	if (totals.convToday || totals.leadsToday) {
		const d = totals.convToday - totals.convYest;
		out.push({
			tone: 'info',
			text: `${totals.convToday} ${totals.convToday === 1 ? 'conversation' : 'conversations'} and ${totals.leadsToday} ${totals.leadsToday === 1 ? 'lead' : 'leads'} came in today${d !== 0 ? ` (${d > 0 ? '+' : ''}${d} vs yesterday)` : ''}.`
		});
	}

	// AI cost health — projected gross margin. AI spend is billed in USD; convert
	// to the platform (revenue) currency before comparing to MRR.
	if (spend?.tracked) {
		const projected = usdToLocal(spend.projected, cur);
		const margin = revenue.mrr > 0 ? Math.round(((revenue.mrr - projected) / revenue.mrr) * 100) : null;
		out.push({
			tone: margin == null ? 'info' : margin >= 60 ? 'good' : margin >= 30 ? 'info' : 'warn',
			text: `AI cost projected ${money(projected, cur)} this month${margin != null ? ` — ${margin}% gross margin` : ''}${spend.cacheHitRate ? `, ${spend.cacheHitRate}% prompt-cache hit rate` : ''}.`
		});
	}

	// Attention
	const failed = billing?.failedPayments ?? 0;
	if (failed > 0) out.push({ tone: 'warn', text: `${failed} failed ${failed === 1 ? 'payment' : 'payments'} need review.` });

	return out;
}

/**
 * Deterministic platform insights — real observations with real numbers, framed
 * as an executive intelligence feed. Each is only emitted when it has data.
 */
export function platformInsights({ clients = [], revenue, spend, industries = [], totals, billing }) {
	const cur = revenue?.currency ?? 'USD';
	const out = [];

	// Leading industry by revenue
	const withRev = industries.filter((i) => i.mrr > 0);
	if (withRev.length) {
		const lead = withRev[0];
		out.push({ icon: 'trophy', text: `${lead.label} leads revenue with ${money(lead.mrr, cur)} MRR across ${lead.count} ${lead.count === 1 ? 'client' : 'clients'}.` });
	}
	// Fastest-growing industry this month
	const growing = [...industries].filter((i) => i.newThisMonth > 0).sort((a, b) => b.newThisMonth - a.newThisMonth)[0];
	if (growing) out.push({ icon: 'trend', text: `${growing.label} is growing fastest — ${growing.newThisMonth} new ${growing.newThisMonth === 1 ? 'client' : 'clients'} this month.` });
	// Healthiest industry (min 2 clients)
	const healthy = [...industries].filter((i) => i.count >= 2).sort((a, b) => b.avgHealth - a.avgHealth)[0];
	if (healthy) out.push({ icon: 'heart', text: `${healthy.label} clients have the highest average health (${healthy.avgHealth}/100).` });

	// Prompt-cache savings estimate (honest lower bound: cached input tokens
	// billed at cache-read rate instead of full input; Haiku delta ≈ $0.90/M).
	if (spend?.tracked && spend.cachedTokens > 0) {
		const savedLocal = usdToLocal((spend.cachedTokens / 1e6) * 0.9, cur);
		if (savedLocal >= 1) out.push({ icon: 'zap', text: `Prompt caching saved ≈ ${money(savedLocal, cur)} this month (${spend.cacheHitRate}% cache-hit rate).` });
	}

	// Clients near their conversation cap → upgrade candidates
	const nearCap = clients.filter((c) => pctCap(c) != null && pctCap(c) >= 80).length;
	if (nearCap > 0) out.push({ icon: 'gauge', text: `${nearCap} ${nearCap === 1 ? 'client is' : 'clients are'} above 80% of their conversation cap — prime for an upgrade.` });

	// Clients with no knowledge yet
	const noKnowledge = clients.filter((c) => (c.items ?? 0) === 0 && c.is_active).length;
	if (noKnowledge > 0) out.push({ icon: 'book', text: `${noKnowledge} active ${noKnowledge === 1 ? 'client has' : 'clients have'} no knowledge uploaded — their AI can only greet visitors.` });

	// Qualified-lead rate across the fleet
	if ((totals?.leads ?? 0) > 0) {
		const rate = Math.round((totals.qualified / totals.leads) * 100);
		out.push({ icon: 'star', text: `${rate}% of captured leads are qualified (${totals.qualified} of ${totals.leads}).` });
	}

	return out;
}

// --------------------------------------------------------------- copilot ----

let _anthropic;
function anthropic() {
	if (_anthropic) return _anthropic;
	if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
	_anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	return _anthropic;
}

/** Compact, PII-light platform snapshot the Copilot reasons over. Aggregates +
 *  a first-name-only per-client sample; no phone/email/transcript leaves here. */
export function copilotSnapshot(full) {
	const cur = full.revenue?.currency ?? 'USD';
	const cost = full.spend?.costByClient ?? {};
	const clients = (full.clients ?? []).map((c) => ({
		name: c.name,
		industry: industryKeyOf(c),
		plan: c.plan,
		status: c.is_active ? c.subscription_status : 'paused',
		health: c.health?.score ?? 0,
		convMonth: c.conversationsMonth ?? 0,
		convTotal: c.conversations ?? 0,
		leads: c.leads ?? 0,
		knowledge: c.items ?? 0,
		capPct: pctCap(c),
		aiCostMonth: Math.round(((Number(cost[c.id]) || 0) + Number.EPSILON) * 100) / 100,
		lastActiveDays: c.lastActive ? Math.floor((Date.now() - new Date(c.lastActive).getTime()) / DAY) : null
	}));
	return {
		currency: cur,
		revenue: { mrr: full.revenue.mrr, arr: full.revenue.arr, arpu: full.revenue.arpu, payingClients: full.revenue.payingCount, newMrrThisMonth: full.revenue.newMrrMonth, byPlan: full.revenue.byPlan },
		totals: full.totals,
		aiCost: full.spend?.tracked ? { thisMonth: full.spend.cost, projected: full.spend.projected, claude: full.spend.claudeCost, voyage: full.spend.voyageCost, cacheHitRate: full.spend.cacheHitRate, byModel: full.spend.byModel, byFeature: full.spend.byFeature } : null,
		billing: full.billing,
		industries: (full.industries ?? []).map(({ key, label, count, mrr, avgHealth, avgConvMonth, avgAiCost, upgradeCandidates, newThisMonth }) => ({ key, label, count, mrr, avgHealth, avgConvMonth, avgAiCost: Math.round(avgAiCost * 100) / 100, upgradeCandidates, newThisMonth })),
		costPerConversation: AVG_COST_PER_CONVERSATION,
		// USD → platform-currency rate: multiply any USD (AI) cost by this before
		// comparing/combining it with revenue (which is already in "currency").
		usdToLocal: USD_TO[cur] ?? 1,
		clients
	};
}

const COPILOT_SYSTEM = `You are the platform analyst for Makutano AI — a multi-tenant, multi-industry AI-assistant SaaS. You answer the super-admin's questions about the WHOLE platform using only the JSON snapshot provided.

Rules:
- Answer ONLY from the DATA. Never invent clients, numbers, industries, or trends that aren't in it.
- Revenue amounts (mrr, arr, arpu, byPlan) are in the platform currency (see "currency"). AI costs (aiCost.*, aiCostMonth, avgAiCost, costPerConversation) are in USD — MULTIPLY them by "usdToLocal" before comparing to, subtracting from, or dividing against any revenue figure (e.g. gross margin = mrr − projected×usdToLocal). Never mix the two currencies unconverted.
- "capPct" is a client's share of their monthly conversation cap; ≥80 means near the limit (an upgrade candidate). "aiCost.byFeature" shows where AI spend goes.
- For "who should upgrade / churn risk / inactive", reason from real signals: capPct, health, lastActiveDays, plan, status, conversation trend. Be specific — name the clients.
- If the data doesn't cover the question, say so plainly and suggest what to track. Never guess.
- Be concise and executive: the answer, the "so what", and a recommended action. Short paragraphs or tight bullets. No preamble like "Based on the data".`;

/** Answer one super-admin platform question over the snapshot. Internal tool
 *  (no tenant), so it calls Claude directly and is not tenant-metered. */
export async function platformCopilot(question, full) {
	const q = String(question ?? '').trim();
	if (!q) return { error: 'empty' };
	const snapshot = copilotSnapshot(full);
	try {
		const resp = await anthropic().messages.create({
			model: 'claude-sonnet-5',
			max_tokens: 1200,
			system: COPILOT_SYSTEM,
			messages: [{ role: 'user', content: `PLATFORM DATA:\n${JSON.stringify(snapshot)}\n\nQUESTION: ${q}` }]
		});
		const text = (resp.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
		if (!text) return { error: 'empty' };
		return { text };
	} catch (e) {
		return { error: 'ai_error', message: String(e?.message ?? e) };
	}
}
