// AI Credits, cost protection & forecasting.
//
// One idea the customer sees: "AI Usage" (a % of their monthly allowance) and
// "≈ conversations remaining". Internally a credit is just real USD of Claude +
// Voyage cost, summed from usage_records — the plan's `included_ai_budget` is the
// monthly allowance and the real revenue-protection limit.
//
// Resilient by design: if migration 014 (the budget column + aggregate RPCs)
// hasn't run, every function fails OPEN — spend reads as 0, nothing is blocked —
// so billing/chat keep working exactly as before until the migration lands.
import { supabase } from './supabase.js';
import { monthStartISO } from './tenant.js';

// Capacity basis: the assumed average AI cost of one customer conversation, used
// ONLY to translate a dollar budget into a friendly "≈ conversations" number.
// Calibrated to the marketed allowances (Starter $6 ≈ 1,500). Tune as real data
// accrues — it never affects actual spend or enforcement, only the estimate shown.
export const AVG_COST_PER_CONVERSATION = 0.004;

// Grace: keep serving past 100% up to this much over budget before pausing NEW
// conversations. Live conversations are never cut off mid-chat.
export const GRACE_PCT = 0.15;

// Purchasable top-ups. `price`/`currency` are what the customer is charged and
// MUST be in the platform's billing currency (the same one the plans use — TZS
// here — and above Snippe's 500 minimum). `budget` is the AI cost value (USD) the
// pack adds to the allowance; it's currency-independent (AI cost is billed in USD).
// Retune prices if you change billing currency.
export const CREDIT_PACKS = [
	{ key: 'small', label: 'Small', price: 25000, currency: 'TZS', budget: 4 },
	{ key: 'medium', label: 'Medium', price: 60000, currency: 'TZS', budget: 11 },
	{ key: 'large', label: 'Large', price: 150000, currency: 'TZS', budget: 29 }
];

// Friendly labels for the usage-by-category breakdown, keyed by usage_records.feature.
const CATEGORY = {
	widget: 'Website Assistant',
	hosted: 'Hosted AI Page',
	whatsapp: 'WhatsApp AI',
	conversation: 'Conversations',
	summary: 'Conversation summaries',
	data_analyst: 'AI Analyst',
	research: 'AI Research',
	lead_extract: 'Lead extraction',
	translate: 'Translation',
	embedding: 'Knowledge search',
	knowledge_index: 'Knowledge generation',
	website_sync: 'Website Sync'
};
const categoryLabel = (f) => CATEGORY[f] ?? 'Other AI';
// Voyage-billed features (used to split Claude vs embedding cost in advanced view).
const VOYAGE_FEATURES = new Set(['embedding', 'knowledge_index', 'website_sync']);

// --- plan budget (cached 60s; plans change rarely) --------------------------
let _plans = { at: 0, map: null };
async function planMap() {
	if (_plans.map && Date.now() - _plans.at < 60000) return _plans.map;
	// Prefer the budget column; before migration 014 it doesn't exist, so fall back
	// to just the conversation cap (budget then derives from it in effectiveBudget).
	let rows = null;
	const full = await supabase.from('plans').select('key, included_ai_budget, monthly_conversation_cap');
	if (full.error) {
		const basic = await supabase.from('plans').select('key, monthly_conversation_cap');
		if (!basic.error) rows = basic.data ?? [];
	} else {
		rows = full.data ?? [];
	}
	// Only refresh the cache on a SUCCESSFUL read. On a transient error keep the
	// last-good map (and retry next call) so a blip can't poison every tenant's
	// budget to the floor and flip the system fail-CLOSED.
	if (rows) {
		const map = new Map();
		for (const p of rows) map.set(p.key, p);
		_plans = { at: Date.now(), map };
	}
	return _plans.map ?? new Map();
}

/** The effective monthly AI budget (USD) for a plan. Prefers the explicit
 *  included_ai_budget; falls back to deriving one from the conversation cap so
 *  custom/unconfigured plans still get a sane allowance. */
async function effectiveBudget(planKey) {
	let p = null;
	try {
		p = (await planMap()).get(planKey) ?? null;
	} catch {
		/* column missing (pre-migration) → treat as unset */
	}
	const explicit = Number(p?.included_ai_budget ?? 0);
	if (explicit > 0) return explicit;
	const cap = Number(p?.monthly_conversation_cap ?? 0);
	if (cap > 0) return cap * AVG_COST_PER_CONVERSATION;
	return 2; // last-resort floor so a misconfigured plan isn't "0 budget → always over"
}

/** This month's total AI spend (USD). Fails open to 0 if the RPC isn't present. */
export async function monthSpend(clientId) {
	try {
		const { data, error } = await supabase.rpc('tenant_ai_cost', { p_client_id: clientId, p_since: monthStartISO() });
		if (error) return 0;
		return Number(data ?? 0);
	} catch {
		return 0;
	}
}

/** AI budget (USD) added by credit packs bought this billing period. Fails to 0
 *  if migration 015 hasn't run (packs simply don't apply yet). */
export async function packsThisPeriod(clientId) {
	try {
		const { data, error } = await supabase.rpc('tenant_pack_budget', { p_client_id: clientId, p_since: monthStartISO() });
		if (error) return 0;
		return Number(data ?? 0);
	} catch {
		return 0;
	}
}

const level = (pct, over) => (over ? 'exhausted' : pct >= 100 ? 'grace' : pct >= 95 ? 'critical' : pct >= 80 ? 'approaching' : 'healthy');

/** Lean budget status — used by both the chat gate and the dashboard header. */
export async function budgetStatus(clientId, planKey) {
	const base = await effectiveBudget(planKey);
	const packCredits = await packsThisPeriod(clientId);
	const budget = base + packCredits;
	const spent = await monthSpend(clientId);
	const grace = budget * GRACE_PCT;
	const ratio = budget > 0 ? (spent / budget) * 100 : 0; // unrounded — drives status thresholds
	const pct = Math.round(ratio); // rounded — for display only
	const over = spent >= budget + grace;
	const remainingBudget = Math.max(0, budget - spent);
	return {
		budget,
		base,
		packCredits,
		spent,
		grace,
		pct,
		status: level(ratio, over),
		blocked: over, // pause NEW conversations only past budget + grace
		remainingBudget,
		estTotalConversations: Math.round(budget / AVG_COST_PER_CONVERSATION),
		estRemainingConversations: Math.max(0, Math.round(remainingBudget / AVG_COST_PER_CONVERSATION))
	};
}

function billingPeriod() {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	const daysInMonth = end.getDate();
	const dayOfMonth = now.getDate();
	return { start: start.toISOString(), end: end.toISOString(), daysInMonth, dayOfMonth, daysRemaining: Math.max(0, daysInMonth - dayOfMonth) };
}

/** Rich usage summary for the AI Usage dashboard: status + category breakdown +
 *  forecast + advanced token/cost detail. All amounts derived from usage_records. */
export async function usageSummary(clientId, planKey) {
	const status = await budgetStatus(clientId, planKey);
	const period = billingPeriod();

	let rows = [];
	try {
		const { data, error } = await supabase.rpc('tenant_ai_usage', { p_client_id: clientId, p_since: monthStartISO() });
		if (!error) rows = data ?? [];
	} catch {
		/* pre-migration → no breakdown */
	}

	const totalCost = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0) || status.spent;
	const categories = rows
		.map((r) => ({
			key: r.feature,
			label: categoryLabel(r.feature),
			cost: Number(r.cost ?? 0),
			calls: Number(r.calls ?? 0),
			pct: totalCost > 0 ? Math.round((Number(r.cost ?? 0) / totalCost) * 100) : 0,
			conversations: Math.round(Number(r.cost ?? 0) / AVG_COST_PER_CONVERSATION)
		}))
		.filter((c) => c.cost > 0)
		.sort((a, b) => b.cost - a.cost);

	const voyageCost = rows.filter((r) => VOYAGE_FEATURES.has(r.feature)).reduce((s, r) => s + Number(r.cost ?? 0), 0);
	const claudeRows = rows.filter((r) => !VOYAGE_FEATURES.has(r.feature));
	const advanced = {
		claudeCost: Math.max(0, totalCost - voyageCost),
		voyageCost,
		// Claude token tiles exclude Voyage rows so embedding tokens aren't double-counted.
		inputTokens: claudeRows.reduce((s, r) => s + Number(r.input_tokens ?? 0), 0),
		cachedTokens: claudeRows.reduce((s, r) => s + Number(r.cached_tokens ?? 0), 0),
		outputTokens: claudeRows.reduce((s, r) => s + Number(r.output_tokens ?? 0), 0),
		embeddingTokens: rows.filter((r) => VOYAGE_FEATURES.has(r.feature)).reduce((s, r) => s + Number(r.input_tokens ?? 0), 0),
		calls: rows.reduce((s, r) => s + Number(r.calls ?? 0), 0)
	};

	// Forecast: straight-line projection from spend-per-day-elapsed.
	const avgDaily = period.dayOfMonth > 0 ? status.spent / period.dayOfMonth : 0;
	const projected = avgDaily * period.daysInMonth;
	const projectedPct = status.budget > 0 ? Math.round((projected / status.budget) * 100) : 0;
	const forecast = {
		avgDaily,
		avgDailyConversations: Math.round(avgDaily / AVG_COST_PER_CONVERSATION),
		projected,
		projectedPct,
		willExceed: projected > status.budget,
		// Rough day-of-month the budget runs out, if the current pace continues.
		exhaustsOnDay: avgDaily > 0 && status.budget > 0 ? Math.ceil(status.budget / avgDaily) : null
	};

	return { ...status, period, categories, advanced, forecast };
}
