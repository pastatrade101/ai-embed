// Super-admin "CEO dashboard" aggregations. Every number here is REAL or
// honestly derivable from existing tables — no fabricated bookings, GMV,
// geography, or historical snapshots. Pure functions over already-fetched rows
// so they're easy to reason about and resilient when a table is empty.

const DAY = 86400000;

/* ------------------------------------------------------------------ money -- */

/** key -> plan row, for pricing lookups. */
export function planMap(plans) {
	const m = new Map();
	for (const p of plans ?? []) m.set(p.key, p);
	return m;
}

/**
 * Monthly recurring revenue = sum of each PAYING client's plan price.
 * Paying = active tenant on a paid plan with an active subscription. Trials and
 * canceled/past_due are excluded from MRR but surfaced separately.
 */
export function revenue(clients, plans) {
	const pm = planMap(plans);
	const currency = (plans ?? []).find((p) => Number(p.price_amount) > 0)?.price_currency ?? 'USD';
	let mrr = 0;
	let payingCount = 0;
	let newMrrMonth = 0;
	const monthAgo = Date.now() - 30 * DAY;
	const byPlan = new Map();
	for (const p of plans ?? []) byPlan.set(p.key, { key: p.key, name: p.name, price: Number(p.price_amount) || 0, count: 0, mrr: 0 });

	for (const c of clients ?? []) {
		const plan = pm.get(c.plan);
		const price = Number(plan?.price_amount) || 0;
		const bucket = byPlan.get(c.plan);
		if (bucket) bucket.count += 1;
		const paying = c.is_active && c.subscription_status === 'active' && price > 0;
		if (paying) {
			mrr += price;
			payingCount += 1;
			if (bucket) bucket.mrr += price;
			if (c.created_at && new Date(c.created_at).getTime() >= monthAgo) newMrrMonth += price;
		}
	}
	const activeCount = (clients ?? []).filter((c) => c.is_active).length;
	return {
		currency,
		mrr,
		arr: mrr * 12,
		arpu: payingCount ? Math.round(mrr / payingCount) : 0,
		payingCount,
		activeCount,
		newMrrMonth,
		byPlan: [...byPlan.values()].sort((a, b) => b.price - a.price)
	};
}

/* ---------------------------------------------------------------- health -- */

/**
 * A 0–100 tenant health score from real engagement + billing signals.
 * Heuristic (transparent), mirroring how we score leads.
 */
export function clientHealth(c) {
	let s = 0;
	// Billing standing
	if (c.subscription_status === 'active') s += 22;
	else if (c.subscription_status === 'trialing') s += 12;
	else if (c.subscription_status === 'past_due') s += 4;
	if (!c.is_active) s -= 25; // paused
	// Content readiness
	if ((c.items ?? 0) > 0) s += 14;
	if ((c.items ?? 0) >= 10) s += 6;
	// Demand
	if ((c.conversations ?? 0) > 0) s += 10;
	if ((c.conversationsMonth ?? 0) > 0) s += 10;
	if ((c.leads ?? 0) > 0) s += 12;
	// Recency of a human logging in or a customer chatting
	const last = lastActiveAt(c);
	if (last) {
		const age = Date.now() - new Date(last).getTime();
		if (age < 7 * DAY) s += 14;
		else if (age < 30 * DAY) s += 7;
	}
	s = Math.max(0, Math.min(100, s));
	let label = 'At risk';
	let cls = 'cold';
	if (s >= 80) [label, cls] = ['Excellent', 'hot'];
	else if (s >= 60) [label, cls] = ['Healthy', 'warm'];
	else if (s >= 40) [label, cls] = ['Watch', 'cool'];
	return { score: s, label, cls };
}

/** Most recent signal we have of life on a tenant. */
export function lastActiveAt(c) {
	const times = [c.lastConversationAt, c.lastLeadAt, c.last_login_at].filter(Boolean).map((t) => new Date(t).getTime());
	return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/* ------------------------------------------------------------- attention -- */

/** Tenants that need the operator's attention, most-urgent first. */
export function attention(clients) {
	const out = [];
	for (const c of clients ?? []) {
		const flags = [];
		if (!c.is_active) flags.push({ sev: 3, text: 'Assistant is paused', action: 'Reactivate' });
		if (c.subscription_status === 'past_due') flags.push({ sev: 3, text: 'Payment past due', action: 'Review billing' });
		if (c.subscription_status === 'canceled') flags.push({ sev: 2, text: 'Subscription canceled', action: 'Win back' });
		const cap = c.monthly_conversation_cap ?? 0;
		if (cap > 0 && (c.conversationsMonth ?? 0) / cap >= 0.9) flags.push({ sev: 2, text: `At ${Math.round(((c.conversationsMonth ?? 0) / cap) * 100)}% of conversation cap`, action: 'Suggest upgrade' });
		if ((c.items ?? 0) === 0) flags.push({ sev: 2, text: 'No knowledge added yet', action: 'Help onboard' });
		else if (c.knowledgeUpdatedAt && Date.now() - new Date(c.knowledgeUpdatedAt).getTime() > 180 * DAY) flags.push({ sev: 1, text: 'Catalogue not updated in 6+ months', action: 'Nudge review' });
		if ((c.conversations ?? 0) > 5 && (c.leads ?? 0) === 0) flags.push({ sev: 1, text: 'Chats but no leads captured', action: 'Check setup' });
		const last = lastActiveAt(c);
		if (last && Date.now() - new Date(last).getTime() > 14 * DAY) flags.push({ sev: 1, text: `No activity in ${Math.floor((Date.now() - new Date(last).getTime()) / DAY)} days`, action: 'Re-engage' });
		if (flags.length) {
			flags.sort((a, b) => b.sev - a.sev);
			out.push({ client: c, top: flags[0], flags });
		}
	}
	return out.sort((a, b) => b.top.sev - a.top.sev || (b.flags.length - a.flags.length));
}

/* ----------------------------------------------------------- opportunities -- */

/** Upsell / activation opportunities, grouped by type. */
export function opportunities(clients, plans) {
	const pm = planMap(plans);
	const freeNearCap = [];
	const thinCatalogue = [];
	const notLive = [];
	for (const c of clients ?? []) {
		const plan = pm.get(c.plan);
		const isFree = !plan || Number(plan.price_amount) === 0;
		const cap = c.monthly_conversation_cap ?? 0;
		if (isFree && cap > 0 && (c.conversationsMonth ?? 0) / cap >= 0.6) freeNearCap.push(c);
		if ((c.items ?? 0) > 0 && (c.items ?? 0) < 5) thinCatalogue.push(c);
		if (c.is_active && (c.conversations ?? 0) === 0) notLive.push(c);
	}
	const list = [];
	if (freeNearCap.length) list.push({ kind: 'upsell', title: `${freeNearCap.length} free ${plural(freeNearCap.length, 'tenant')} near the conversation cap`, detail: 'Strong upgrade candidates — reach out with a paid plan.', clients: freeNearCap });
	if (thinCatalogue.length) list.push({ kind: 'activate', title: `${thinCatalogue.length} ${plural(thinCatalogue.length, 'tenant')} with a thin catalogue`, detail: 'Fewer than 5 knowledge items — help them add tours to convert more.', clients: thinCatalogue });
	if (notLive.length) list.push({ kind: 'activate', title: `${notLive.length} active ${plural(notLive.length, 'tenant')} with zero conversations`, detail: 'Live but not sharing their assistant — nudge them to post the link/QR.', clients: notLive });
	return list;
}

/* -------------------------------------------------------------- activity -- */

/** Reverse-chronological platform activity from real timestamps. */
export function activity(conversations, leads, clients, limit = 12) {
	const byId = new Map((clients ?? []).map((c) => [c.id, c]));
	const nameOf = (id) => byId.get(id)?.name ?? 'A tenant';
	const events = [];
	for (const c of (clients ?? []).slice(0, 20)) {
		if (c.created_at) events.push({ type: 'signup', at: c.created_at, title: `${c.name} joined the platform`, meta: c.plan });
	}
	for (const cv of (conversations ?? []).slice(0, 40)) {
		events.push({ type: 'conversation', at: cv.created_at, title: `${nameOf(cv.client_id)} — customer conversation`, meta: null });
	}
	for (const l of (leads ?? []).slice(0, 40)) {
		events.push({ type: 'lead', at: l.created_at, title: `${nameOf(l.client_id)} captured a lead${l.name ? ` · ${l.name}` : ''}`, meta: (l.interest ?? '').slice(0, 42) || null });
	}
	return events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

/* ------------------------------------------------------------ leaderboard -- */

export function leaderboard(clients, key, limit = 5) {
	return [...(clients ?? [])].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).filter((c) => (c[key] ?? 0) > 0).slice(0, limit);
}

/* ------------------------------------------------------------- AI spend --- */

/** Real AI cost + tokens from usage_records (empty-safe). */
const VOYAGE_MODELS = new Set(['voyage-3']);

export function aiSpend(usageRows, nameById = {}) {
	const rows = usageRows ?? [];
	let cost = 0;
	let claude = 0;
	let voyage = 0;
	let inTok = 0;
	let outTok = 0;
	let cachedTok = 0;
	const byModel = new Map();
	const byTenant = new Map();
	const byFeature = new Map();
	for (const r of rows) {
		const c = Number(r.estimated_cost) || 0;
		cost += c;
		if (VOYAGE_MODELS.has(r.model)) voyage += c;
		else claude += c;
		inTok += Number(r.input_tokens) || 0;
		outTok += Number(r.output_tokens) || 0;
		cachedTok += Number(r.cached_tokens) || 0;
		const m = byModel.get(r.model) ?? { model: r.model || 'unknown', cost: 0, calls: 0 };
		m.cost += c;
		m.calls += 1;
		byModel.set(r.model, m);
		byTenant.set(r.client_id, (byTenant.get(r.client_id) ?? 0) + c);
		// Feature attribution (widget / hosted / embedding / knowledge_index /
		// website_sync / summary / translate / data_analyst / research / …). The
		// column is optional (migration 014) — untagged rows group under 'other'.
		const feat = r.feature || 'other';
		const fb = byFeature.get(feat) ?? { feature: feat, cost: 0, calls: 0 };
		fb.cost += c;
		fb.calls += 1;
		byFeature.set(feat, fb);
	}
	// Straight-line projection of this month's spend to the full month.
	const now = new Date();
	const dayOfMonth = now.getDate();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
	const projected = dayOfMonth > 0 ? (cost / dayOfMonth) * daysInMonth : cost;
	const topSpenders = [...byTenant.entries()]
		.map(([id, c]) => ({ id, name: nameById[id] ?? 'Unknown', cost: c }))
		.sort((a, b) => b.cost - a.cost)
		.slice(0, 6);
	// Cache hit rate: cached input tokens as a share of all input read. High is
	// good — it means prompt caching is saving money on the stable persona block.
	const totalInput = inTok + cachedTok;
	const cacheHitRate = totalInput > 0 ? Math.round((cachedTok / totalInput) * 100) : 0;
	return {
		tracked: rows.length > 0,
		cost,
		claudeCost: claude,
		voyageCost: voyage,
		projected,
		turns: rows.length,
		inputTokens: inTok,
		outputTokens: outTok,
		cachedTokens: cachedTok,
		cacheHitRate,
		// Avg over non-cached input only, so it stays consistent with `inputTokens`
		// (avg × turns ≈ inputTokens). Cache volume is surfaced separately.
		avgInputTokens: rows.length ? Math.round(inTok / rows.length) : 0,
		avgOutputTokens: rows.length ? Math.round(outTok / rows.length) : 0,
		byModel: [...byModel.values()].sort((a, b) => b.cost - a.cost),
		byFeature: [...byFeature.values()].sort((a, b) => b.cost - a.cost),
		// Per-tenant AI cost this month (for industry rollups + client cards).
		costByClient: Object.fromEntries(byTenant),
		topSpenders
	};
}

/* -------------------------------------------------------------- trends ---- */

/** Daily counts for the last `days` days from any rows with created_at. */
export function dailySeries(rows, days = 14) {
	const buckets = new Array(days).fill(0);
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const startMs = start.getTime() - (days - 1) * DAY;
	for (const r of rows ?? []) {
		if (!r.created_at) continue;
		const idx = Math.floor((new Date(r.created_at).getTime() - startMs) / DAY);
		if (idx >= 0 && idx < days) buckets[idx] += 1;
	}
	return buckets;
}

/** Cumulative tenant count per day over `days`, for a growth curve. */
export function growthSeries(clients, days = 30) {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const startMs = start.getTime() - (days - 1) * DAY;
	const before = (clients ?? []).filter((c) => c.created_at && new Date(c.created_at).getTime() < startMs).length;
	const daily = dailySeries((clients ?? []).map((c) => ({ created_at: c.created_at })), days);
	const cumulative = [];
	let run = before;
	for (const d of daily) {
		run += d;
		cumulative.push(run);
	}
	return cumulative;
}

/* -------------------------------------------------------------- insight --- */

/**
 * One honestly-computed comparative insight from the actual tenant set — only
 * returned when there are enough tenants for it to mean anything.
 */
export function platformInsight(clients) {
	const list = clients ?? [];
	if (list.length < 6) return null; // too few tenants to claim a pattern
	const rich = list.filter((c) => (c.items ?? 0) >= 10);
	const lean = list.filter((c) => (c.items ?? 0) < 10);
	if (rich.length >= 2 && lean.length >= 2) {
		const avg = (arr, k) => arr.reduce((s, c) => s + (c[k] ?? 0), 0) / arr.length;
		const rl = avg(rich, 'leads');
		const ll = avg(lean, 'leads');
		if (ll > 0 && rl > ll) {
			const pct = Math.round(((rl - ll) / ll) * 100);
			if (pct >= 10) return `Tenants with 10+ knowledge items capture ${pct}% more leads on average (${rl.toFixed(1)} vs ${ll.toFixed(1)}). Nudge thin catalogues to add tours.`;
		}
	}
	return null;
}

/* -------------------------------------------------------------- helpers --- */

function plural(n, word) {
	return n === 1 ? word : word + 's';
}
