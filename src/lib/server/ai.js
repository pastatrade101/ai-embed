// AI control layer — the metered, tier-gated substrate the premium AI agents run
// on. Two independent controls:
//   • ACCESS  (planAllows/planUnlocks, gating.js) — can this plan use the feature
//     at all? Inert unless FEATURE_GATING=on.
//   • QUOTA   (this file) — how many times per month? ALWAYS enforced (cost cap),
//     independent of gating. Counted from usage_records.feature.
// Every call logs tokens + estimated cost to usage_records so spend is visible and
// billable. All calls are tenant-scoped by the caller (clientId).
//
// Metering uses a RESERVE → settle pattern: a usage row is inserted BEFORE the API
// call so a concurrent request's usedThisMonth() already counts this in-flight
// call — the monthly cap therefore holds under bursts, not just sequentially.
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { supabase } from './supabase.js';
import { estimateCost } from './pricing.js';

export const HAIKU = 'claude-haiku-4-5';
export const SONNET = 'claude-sonnet-5';

// Metered feature keys (stored in usage_records.feature).
export const AI = { DATA_ANALYST: 'data_analyst', RESEARCH: 'research', LEAD_EXTRACT: 'lead_extract', PROPOSAL: 'proposal', ORDER: 'order' };

// Monthly per-tier limits. Cheap Haiku lead-enrichment is available from starter up;
// the Sonnet agents (analyst, research) are growth+ premium features — their quotas
// here MUST match the plan gating in db/013 (growth + pro get the feature labels), so
// ACCESS and QUOTA agree: a tier with 0 quota also lacks the feature, and vice-versa.
// AI proposal drafting is available on every tier (a small free trial allowance) —
// operators can always write proposals by hand; the AI draft is the convenience.
const QUOTAS = {
	free: { data_analyst: 0, research: 0, lead_extract: 0, proposal: 10, order: 30 },
	starter: { data_analyst: 0, research: 0, lead_extract: 300, proposal: 60, order: 300 },
	growth: { data_analyst: 150, research: 12, lead_extract: 2000, proposal: 300, order: 2000 },
	pro: { data_analyst: 600, research: 50, lead_extract: 10000, proposal: 1500, order: 10000 }
};
// Unknown / custom (admin-created) plans are cost-safe by default: no paid Sonnet
// agents until the plan is explicitly mapped above. Cheap Haiku lead enrichment
// stays modestly available so lead capture still enriches. Order extraction (like
// proposals) is available on every tier — it's core to running the business.
const DEFAULT_QUOTA = { data_analyst: 0, research: 0, lead_extract: 500, proposal: 30, order: 200 };

export function quotaLimit(planKey, feature) {
	const q = QUOTAS[planKey] ?? DEFAULT_QUOTA;
	return q[feature] ?? DEFAULT_QUOTA[feature] ?? 0;
}

let _client;
function client() {
	if (_client) return _client;
	if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
	_client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	return _client;
}

function monthStartISO() {
	const n = new Date();
	return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
}

const extractText = (r) => (r?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

const zeroUsage = () => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
const addUsage = (a, u = {}) => {
	a.input_tokens += u.input_tokens ?? 0;
	a.output_tokens += u.output_tokens ?? 0;
	a.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
	a.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
	return a;
};
export { addUsage, zeroUsage };

/** Times this client used a metered feature this month. Resilient to the
 *  usage_records.feature column not existing yet (returns 0 → quota fails open). */
export async function usedThisMonth(clientId, feature) {
	const { count, error } = await supabase
		.from('usage_records')
		.select('*', { count: 'exact', head: true })
		.eq('client_id', clientId)
		.eq('feature', feature)
		.gte('created_at', monthStartISO());
	if (error) return 0;
	return count ?? 0;
}

/** { limit, used, remaining, ok } for a metered feature. */
export async function quota(clientId, planKey, feature) {
	const limit = quotaLimit(planKey, feature);
	const used = await usedThisMonth(clientId, feature);
	return { limit, used, remaining: Math.max(0, limit - used), ok: used < limit };
}

// --- Metering: reserve → settle (or release on total failure) --------------
const usageRow = (clientId, feature, model, usage = {}) => ({
	client_id: clientId,
	model,
	input_tokens: usage.input_tokens ?? 0,
	cached_tokens: usage.cache_read_input_tokens ?? 0,
	output_tokens: usage.output_tokens ?? 0,
	tool_calls: 0,
	estimated_cost: estimateCost(model, usage),
	feature
});

/** Reserve a usage slot BEFORE the API call so concurrent requests already count
 *  it (closes the check-then-insert race). Returns { id, created_at }, or null if
 *  the row couldn't be created (e.g. pre-migration: no feature column) — callers
 *  then fall back to logUsage() after the call. */
async function reserve(clientId, feature, model) {
	const { data, error } = await supabase
		.from('usage_records')
		.insert({ client_id: clientId, model, feature, input_tokens: 0, cached_tokens: 0, output_tokens: 0, tool_calls: 0, estimated_cost: 0 })
		.select('id, created_at')
		.single();
	if (error || !data) return null;
	return data;
}

/** After reserving, this counts rows that landed strictly before mine this month —
 *  my 0-based position in the queue. If it's >= limit I'm over the cap (a
 *  concurrent burst slipped past the pre-check) and should be rejected. Ordering by
 *  created_at makes at most `limit` reservations win under normal spacing. */
async function positionOverLimit(clientId, feature, createdAt, limit) {
	const { count, error } = await supabase
		.from('usage_records')
		.select('*', { count: 'exact', head: true })
		.eq('client_id', clientId)
		.eq('feature', feature)
		.gte('created_at', monthStartISO())
		.lt('created_at', createdAt);
	if (error) return false; // can't tell → don't wrongly block
	return (count ?? 0) >= limit;
}

/** Fill a reserved row with the real usage once the call returns. */
async function settle(rowId, model, usage) {
	const { input_tokens, cached_tokens, output_tokens, estimated_cost } = usageRow(null, null, model, usage);
	await supabase.from('usage_records').update({ input_tokens, cached_tokens, output_tokens, estimated_cost }).eq('id', rowId);
}

/** Drop a reservation for a call that produced nothing (total failure) so a failed
 *  request doesn't burn a quota unit. */
async function release(rowId) {
	await supabase.from('usage_records').delete().eq('id', rowId);
}

/** Insert a usage row after the fact (fallback when reservation is unavailable,
 *  e.g. pre-migration). Resilient to the feature column being absent. */
export async function logUsage(clientId, feature, model, usage = {}) {
	const row = usageRow(clientId, feature, model, usage);
	const { error } = await supabase.from('usage_records').insert(row);
	if (error) {
		delete row.feature;
		await supabase.from('usage_records').insert(row);
	}
}

/** Record the outcome of a metered call against its reservation. When some cost was
 *  incurred it settles (or logs, pre-migration); on a total failure it releases so
 *  the tenant isn't charged a quota unit for nothing. */
async function record(rowId, clientId, feature, model, usage, hadCost) {
	if (!hadCost) {
		if (rowId) await release(rowId);
		return;
	}
	if (rowId) await settle(rowId, model, usage);
	else await logUsage(clientId, feature, model, usage);
}

/** One logical completion. Drains up to `hops` server-tool `pause_turn`
 *  continuations (web search etc.). No quota/logging — a building block for the
 *  metered wrappers below. Returns the final response, the FULL conversation
 *  (so callers can continue it), summed usage, and any thrown error. */
export async function converse({ model = SONNET, system, messages, tools, maxTokens = 4096, hops = 6 }) {
	let convo = messages.slice();
	let resp;
	let error = null;
	const usage = zeroUsage();
	for (let i = 0; i < hops; i++) {
		try {
			resp = await client().messages.create({ model, max_tokens: maxTokens, system, messages: convo, ...(tools ? { tools } : {}) });
		} catch (e) {
			error = e;
			break;
		}
		addUsage(usage, resp.usage ?? {});
		convo = [...convo, { role: 'assistant', content: resp.content }];
		if (resp.stop_reason !== 'pause_turn') break;
	}
	return { resp, text: extractText(resp), messages: convo, usage, error };
}

const hasCost = (u) => (u.input_tokens || 0) + (u.output_tokens || 0) > 0;

/** Structured JSON call. Enforces quota, meters usage, handles API errors.
 *  Returns { data, quota } | { error:'quota', quota } | { error:'ai_error', quota }. */
export async function askJSON({ clientId, planKey, feature, model = HAIKU, system, schema, messages, maxTokens = 1024 }) {
	const q = await quota(clientId, planKey, feature);
	if (!q.ok) return { error: 'quota', quota: q };
	const slot = await reserve(clientId, feature, model);
	const rowId = slot?.id ?? null;
	if (slot && (await positionOverLimit(clientId, feature, slot.created_at, q.limit))) {
		await release(rowId);
		return { error: 'quota', quota: { ...q, used: q.limit, remaining: 0, ok: false } };
	}
	let resp;
	try {
		resp = await client().messages.create({ model, max_tokens: maxTokens, system, output_config: { format: { type: 'json_schema', schema } }, messages });
	} catch (e) {
		if (rowId) await release(rowId);
		return { error: 'ai_error', message: String(e?.message ?? e), quota: q };
	}
	await record(rowId, clientId, feature, model, resp.usage ?? {}, true);
	let data = null;
	try {
		data = JSON.parse(extractText(resp));
	} catch {
		/* leave null */
	}
	return { data, quota: after(q) };
}

/** Text call, optionally with server tools (e.g. web search). Enforces quota,
 *  meters usage, drains `pause_turn` continuations, and surfaces API failures.
 *  Returns { text, raw, quota } | { error:'quota', quota } | { error:'ai_error', quota }. */
export async function askText({ clientId, planKey, feature, model = SONNET, system, messages, tools, maxTokens = 4096, hops = 6 }) {
	const q = await quota(clientId, planKey, feature);
	if (!q.ok) return { error: 'quota', quota: q };
	const slot = await reserve(clientId, feature, model);
	const rowId = slot?.id ?? null;
	if (slot && (await positionOverLimit(clientId, feature, slot.created_at, q.limit))) {
		await release(rowId);
		return { error: 'quota', quota: { ...q, used: q.limit, remaining: 0, ok: false } };
	}
	const { resp, text, usage, error } = await converse({ model, system, messages, tools, maxTokens, hops });
	const cost = hasCost(usage);
	await record(rowId, clientId, feature, model, usage, cost);
	// Total failure before any tokens: nothing charged, surface the error.
	if (error && !text && !cost) return { error: 'ai_error', message: String(error?.message ?? error), quota: q };
	// Partial failure that still incurred cost (e.g. tool loop died mid-way).
	if (error && !text) return { error: 'ai_error', message: String(error?.message ?? error), quota: after(q) };
	return { text, raw: resp, quota: after(q) };
}

const after = (q) => ({ ...q, used: q.used + 1, remaining: Math.max(0, q.remaining - 1), ok: q.used + 1 < q.limit });
