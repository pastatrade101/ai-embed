// AI Growth Advisor — turns a tenant's REAL usage into honest, non-pushy upgrade
// guidance. Every reason and number comes from actual activity; nothing is
// fabricated. Pure function (no I/O) so it's trivial to test and reuse across the
// billing page, the dashboard nudge, and locked-feature blocks.
//
// It deliberately only reasons about signals the platform truly measures:
// AI-budget usage, conversation volume vs cap, qualified-lead counts, knowledge
// volume, and website connection. It does NOT invent WhatsApp-AI volume, website
// traffic, multilingual demand, or team/seat needs — none of which are tracked.
import { FEATURE_VALUE } from '$lib/feature-value.js';

const DEFAULT_CPC = 0.004; // USD per conversation, matches AVG_COST_PER_CONVERSATION

const nextTier = (plans, currentPlan) => {
	const cur = currentPlan?.sort ?? -1;
	return (plans ?? [])
		.filter((p) => p.is_active !== false && Number(p.sort) > cur)
		.sort((a, b) => a.sort - b.sort)[0] ?? null;
};

/**
 * @param {object} ctx
 *  client      clients row: { plan, monthly_conversation_cap, website_url, ... }
 *  plans       active plans [{ key, name, price_amount, price_currency, sort, features, included_ai_budget, monthly_conversation_cap, is_active }]
 *  credits     usageSummary() object ({ pct, status, forecast, ... })
 *  convMonth   conversations this month
 *  leadsMonth  leads this month
 *  qualified   hot+warm leads this month
 *  itemsCount  knowledge items
 *  cpc         cost per conversation (optional; defaults to 0.004)
 */
export function growthAdvisor(ctx) {
	const { client, plans = [], credits, convMonth = 0, qualified = 0, itemsCount = 0, cpc = DEFAULT_CPC, gatingOn = false } = ctx || {};
	const conv = (budget) => Math.round((Number(budget) || 0) / (cpc || DEFAULT_CPC));

	// The tenant's REAL current plan. Callers should resolve it without the
	// is_active filter (a tenant can be grandfathered on a deactivated plan) and
	// pass it as ctx.currentPlan; we fall back to the active list only if absent.
	const currentPlan = ctx.currentPlan ?? plans.find((p) => p.key === client?.plan) ?? null;

	const cap = Number(client?.monthly_conversation_cap) || Number(currentPlan?.monthly_conversation_cap) || 0;
	const status = credits?.status ?? 'healthy';
	const pct = Math.max(0, Math.round(Number(credits?.pct) || 0));
	const willExceed = !!credits?.forecast?.willExceed;
	const usagePressure = ['approaching', 'critical', 'grace', 'exhausted'].includes(status) || willExceed;
	const capPctRaw = cap > 0 ? Math.round((convMonth / cap) * 100) : null; // unclamped — real figure for prose
	const capPct = capPctRaw == null ? null : Math.min(100, capPctRaw); // clamped — for meter bars
	const capPressure = capPctRaw != null && capPctRaw >= 80;
	const strong = usagePressure || capPressure;
	const suggestPacks = status === 'critical' || status === 'grace' || status === 'exhausted';

	// Limit meters — only real, bounded limits (AI allowance always; conversations if a cap exists).
	const limits = [
		{ key: 'ai', label: 'AI allowance used', display: `${pct}%`, pct: Math.min(100, pct), cls: pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'green' }
	];
	if (cap > 0) {
		limits.push({ key: 'conv', label: 'Conversations this month', display: `${convMonth.toLocaleString()} / ${cap.toLocaleString()}`, pct: capPct, cls: capPctRaw >= 100 ? 'red' : capPctRaw >= 80 ? 'amber' : 'green' });
	}

	const base = { currentPlan, recommended: null, onTopPlan: false, strong, hasRecommendation: false, nudge: false, headline: null, reasons: [], unlocks: [], impact: [], limits, suggestPacks };

	// Unknown plan key → never recommend anything (avoids a bogus downgrade + fabricated unlocks).
	if (!currentPlan) return base;
	const recommended = nextTier(plans, currentPlan);
	if (!recommended) return { ...base, onTopPlan: plans.length > 0 };

	// What the recommended tier ACTUALLY makes newly available. Feature gating is the
	// source of truth: when it's OFF, no feature is plan-differentiated (restrictive
	// features are open to everyone, additive ones locked for everyone), so we claim
	// none — the recommendation then rests purely on real capacity pressure.
	const curFeats = new Set(currentPlan.features ?? []);
	const unlocks = gatingOn
		? (recommended.features ?? []).filter((f) => !curFeats.has(f)).map((f) => ({ feature: f, why: FEATURE_VALUE[f] ?? null }))
		: [];
	const adds = (label) => unlocks.some((u) => u.feature === label);

	// Honest reasons — every number is real activity.
	const reasons = [];
	if (status === 'grace' || status === 'exhausted') reasons.push(`You've used your full monthly AI allowance (${pct}%) — a bigger plan restores full capacity.`);
	else if (status === 'critical') reasons.push(`You've used ${pct}% of this month's AI allowance.`);
	else if (willExceed) reasons.push(`At your current pace you're projected to reach ~${credits.forecast.projectedPct}% of your allowance this month${credits.forecast.exhaustsOnDay ? ` — around day ${credits.forecast.exhaustsOnDay}` : ''}.`);
	else if (status === 'approaching') reasons.push(`You've used ${pct}% of this month's AI allowance.`);
	if (capPressure) reasons.push(`You've handled ${convMonth.toLocaleString()} of your ${cap.toLocaleString()} monthly conversations (${capPctRaw}%).`);
	if (qualified >= 5 && adds('AI data analyst')) reasons.push(`You've qualified ${qualified} lead${qualified === 1 ? '' : 's'} this month — the AI data analyst can score and prioritise them for you.`);
	if (itemsCount >= 8 && adds('Bulk knowledge import (CSV/JSON)')) reasons.push(`You're managing ${itemsCount} knowledge items — bulk import lets you update them in one go.`);
	if (client?.website_url && adds('Website chat widget')) reasons.push(`You've connected a website — add the chat widget so it answers visitors there too.`);

	// Conservative, real impact — capacity headroom + capability count only (no invented revenue/hours).
	const impact = [];
	const curCap = conv(currentPlan.included_ai_budget) || cap || 0;
	const nextCap = conv(recommended.included_ai_budget) || Number(recommended.monthly_conversation_cap) || 0;
	if (nextCap > 0) impact.push({ label: 'Monthly capacity', value: `≈ ${nextCap.toLocaleString()} conversations`, sub: curCap > 0 ? `up from ≈ ${curCap.toLocaleString()}` : null });
	if (curCap > 0 && nextCap > curCap) impact.push({ label: 'Headroom', value: `${(nextCap / curCap).toFixed(1)}×`, sub: 'more room before a limit' });
	if (unlocks.length) impact.push({ label: 'New capabilities', value: `${unlocks.length}`, sub: `unlocked on ${recommended.name}` });

	let headline;
	if (strong) headline = `You're reaching the limits of ${currentPlan.name ?? 'your plan'}. ${recommended.name} gives you more room to grow.`;
	else if (reasons.length) headline = `As your bookings grow, ${recommended.name} unlocks tools that would help.`;
	else if (unlocks.length) headline = `${recommended.name} adds ${unlocks.length} capabilit${unlocks.length === 1 ? 'y' : 'ies'} when you're ready.`;
	else headline = `${recommended.name} gives you more monthly capacity when you're ready.`;

	return {
		currentPlan,
		recommended,
		onTopPlan: false,
		strong,
		hasRecommendation: true,
		// Worth actively nudging on the dashboard: real pressure, or at least one concrete reason.
		nudge: strong || reasons.length > 0,
		headline,
		reasons,
		unlocks,
		impact,
		limits,
		suggestPacks
	};
}
