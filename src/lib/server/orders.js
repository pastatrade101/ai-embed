// Order Management engine (Phase 1 of the AI Business OS). One order per customer
// request, tenant-scoped by client_id. Items + money mirror the proposal engine
// (reuses computeTotals), so orders and quotations stay consistent and can convert
// into each other later. FAILS OPEN before migration 023 (reads return
// empty/null with tableMissing:true; the WhatsApp auto-draft silently no-ops).
import { supabase } from './supabase.js';
import { computeTotals } from './proposals.js';

const COLS =
	'id, client_id, lead_id, conversation_id, number, status, source, customer_name, customer_phone, customer_email, currency, items, subtotal, discount, tax, total, delivery_date, delivery_address, notes, internal_notes, confidence, assigned_to, meta, created_at, updated_at, confirmed_at, delivered_at, completed_at';

// The order lifecycle. `group` drives the Kanban columns; `terminal` statuses stop
// the flow. Keep this the single source of truth for statuses across the app.
export const ORDER_STATUSES = [
	{ key: 'new', label: 'New', group: 'intake', color: '#7c8b83' },
	{ key: 'ai_parsed', label: 'AI Parsed', group: 'intake', color: '#8b7fd6' },
	{ key: 'pending_confirmation', label: 'Pending Confirmation', group: 'intake', color: '#e0b24c' },
	{ key: 'confirmed', label: 'Confirmed', group: 'progress', color: '#2c9c6a' },
	{ key: 'preparing', label: 'Preparing', group: 'progress', color: '#3a9bd6' },
	{ key: 'packed', label: 'Packed', group: 'progress', color: '#3a9bd6' },
	{ key: 'ready', label: 'Ready', group: 'progress', color: '#3a9bd6' },
	{ key: 'out_for_delivery', label: 'Out For Delivery', group: 'fulfilment', color: '#d6873a' },
	{ key: 'delivered', label: 'Delivered', group: 'fulfilment', color: '#2c9c6a' },
	{ key: 'completed', label: 'Completed', group: 'done', color: '#16a34a', terminal: true },
	{ key: 'cancelled', label: 'Cancelled', group: 'cancelled', color: '#dc2626', terminal: true },
	{ key: 'returned', label: 'Returned', group: 'cancelled', color: '#dc2626', terminal: true }
];
export const ORDER_STATUS_KEYS = ORDER_STATUSES.map((s) => s.key);
const STATUS_BY_KEY = new Map(ORDER_STATUSES.map((s) => [s.key, s]));
export const statusMeta = (key) => STATUS_BY_KEY.get(key) || { key, label: key, group: 'intake', color: '#7c8b83' };

const n2 = (v) => {
	const x = Number(v);
	return Number.isFinite(x) ? x : 0;
};

/** True when the error is "orders table doesn't exist yet" (migration 023). */
export function isMissingOrders(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	return /42P01|PGRST205|PGRST20[0-9]|does not exist|schema cache|could not find the table/i.test(m);
}

/** Human reference, e.g. ORD-2026-0007. Best-effort per-client sequence. */
async function nextNumber(clientId) {
	const year = new Date().getFullYear();
	let seq = 1;
	try {
		const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('client_id', clientId);
		seq = (count ?? 0) + 1;
	} catch {
		/* fall back to 1 */
	}
	return `ORD-${year}-${String(seq).padStart(4, '0')}`;
}

/** Append a timeline event (non-fatal). */
export async function addOrderEvent(orderId, clientId, type, meta = {}) {
	try {
		await supabase.from('order_events').insert({ order_id: orderId, client_id: clientId, type, meta });
	} catch {
		/* timeline is best-effort */
	}
}

/** Create an order from a partial. Computes totals, assigns a number, records an event. */
export async function createOrder(clientId, data = {}) {
	const { items, subtotal, total } = computeTotals(data.items, data.discount, data.tax);
	const status = ORDER_STATUS_KEYS.includes(data.status) ? data.status : 'new';
	const row = {
		client_id: clientId,
		lead_id: data.lead_id || null,
		conversation_id: data.conversation_id || null,
		number: await nextNumber(clientId),
		status,
		source: data.source || 'manual',
		customer_name: (data.customer_name ?? '').trim() || null,
		customer_phone: (data.customer_phone ?? '').trim() || null,
		customer_email: (data.customer_email ?? '').trim().toLowerCase() || null,
		currency: (data.currency || 'USD').toUpperCase().slice(0, 8),
		items,
		subtotal,
		discount: n2(data.discount),
		tax: n2(data.tax),
		total,
		delivery_date: data.delivery_date || null,
		delivery_address: (data.delivery_address ?? '').trim() || null,
		notes: (data.notes ?? '').trim() || null,
		internal_notes: (data.internal_notes ?? '').trim() || null,
		confidence: data.confidence == null ? null : Math.max(0, Math.min(100, Math.round(Number(data.confidence) || 0))),
		meta: data.meta ?? {}
	};
	const { data: created, error } = await supabase.from('orders').insert(row).select(COLS).single();
	if (error) return { order: null, error, tableMissing: isMissingOrders(error) };
	await addOrderEvent(created.id, clientId, data.source === 'whatsapp' ? 'ai_parsed' : 'created', { source: row.source, confidence: row.confidence });
	return { order: created, error: null };
}

/** Patch an order (scoped). Recomputes totals when items/discount/tax change. */
export async function updateOrder(clientId, id, patch = {}) {
	const set = { updated_at: new Date().toISOString() };
	for (const k of ['customer_name', 'customer_phone', 'customer_email', 'currency', 'delivery_date', 'delivery_address', 'notes', 'internal_notes', 'assigned_to', 'source'])
		if (k in patch) set[k] = patch[k];
	if ('meta' in patch) set.meta = patch.meta;
	if ('currency' in set && set.currency) set.currency = String(set.currency).toUpperCase().slice(0, 8);
	if ('customer_email' in set && set.customer_email) set.customer_email = String(set.customer_email).trim().toLowerCase();
	if ('items' in patch || 'discount' in patch || 'tax' in patch) {
		// Recompute money, preserving any field NOT in this patch from the stored order —
		// so an items-only edit can't silently zero a discount/tax (and vice-versa).
		const needsCurrent = !('items' in patch) || !('discount' in patch) || !('tax' in patch);
		const { data: cur } = needsCurrent
			? await supabase.from('orders').select('items, discount, tax').eq('id', id).eq('client_id', clientId).maybeSingle()
			: { data: null };
		const items = 'items' in patch ? patch.items : cur?.items ?? [];
		const discount = 'discount' in patch ? patch.discount : cur?.discount ?? 0;
		const tax = 'tax' in patch ? patch.tax : cur?.tax ?? 0;
		const t = computeTotals(items, discount, tax);
		set.items = t.items;
		set.subtotal = t.subtotal;
		set.discount = n2(discount);
		set.tax = n2(tax);
		set.total = t.total;
	}
	const { data, error } = await supabase.from('orders').update(set).eq('id', id).eq('client_id', clientId).select(COLS).single();
	if (error) return { order: null, error };
	await addOrderEvent(id, clientId, 'edited', {});
	return { order: data, error: null };
}

/** Move an order to a new status, stamping the lifecycle timestamps + a timeline event. */
export async function setOrderStatus(clientId, id, status) {
	if (!ORDER_STATUS_KEYS.includes(status)) return { ok: false, error: 'bad_status' };
	const now = new Date().toISOString();
	const set = { status, updated_at: now };
	if (status === 'confirmed') set.confirmed_at = now;
	if (status === 'delivered') set.delivered_at = now;
	if (status === 'completed') set.completed_at = now;
	const { data, error } = await supabase.from('orders').update(set).eq('id', id).eq('client_id', clientId).select('id, status').single();
	if (!error) await addOrderEvent(id, clientId, `status_${status}`, {});
	return { ok: !error, error, order: data };
}

/** Single order, scoped to the client. */
export async function getOrder(clientId, id) {
	const { data, error } = await supabase.from('orders').select(COLS).eq('id', id).eq('client_id', clientId).maybeSingle();
	if (error && isMissingOrders(error)) return { order: null, tableMissing: true };
	return { order: data ?? null };
}

/** List orders for a client (optionally by status or lead). */
export async function listOrders(clientId, { status = null, leadId = null, limit = 200 } = {}) {
	let q = supabase.from('orders').select(COLS).eq('client_id', clientId).order('created_at', { ascending: false }).limit(limit);
	if (status) q = q.eq('status', status);
	if (leadId) q = q.eq('lead_id', leadId);
	const { data, error } = await q;
	if (error) return { orders: [], tableMissing: isMissingOrders(error) };
	return { orders: data ?? [] };
}

/** Timeline for an order. */
export async function orderTimeline(orderId, clientId) {
	const { data, error } = await supabase.from('order_events').select('type, at, meta').eq('order_id', orderId).eq('client_id', clientId).order('at', { ascending: true });
	if (error) return [];
	return data ?? [];
}

/** Lightweight metrics for the dashboard (today + open orders + revenue). */
export async function orderStats(clientId) {
	const { orders, tableMissing } = await listOrders(clientId, { limit: 500 });
	if (tableMissing) return { tableMissing: true };
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const isRevenue = (s) => ['confirmed', 'preparing', 'packed', 'ready', 'out_for_delivery', 'delivered', 'completed'].includes(s);
	const openStatuses = new Set(['new', 'ai_parsed', 'pending_confirmation', 'confirmed', 'preparing', 'packed', 'ready', 'out_for_delivery']);
	let ordersToday = 0;
	let revenueToday = 0;
	let revenueMonth = 0;
	let pending = 0;
	let awaitingConfirmation = 0;
	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);
	for (const o of orders) {
		const created = new Date(o.created_at);
		if (created >= startOfToday) ordersToday++;
		if (isRevenue(o.status)) {
			if (created >= startOfToday) revenueToday += Number(o.total) || 0;
			if (created >= startOfMonth) revenueMonth += Number(o.total) || 0;
		}
		if (openStatuses.has(o.status)) pending++;
		if (['ai_parsed', 'pending_confirmation'].includes(o.status)) awaitingConfirmation++;
	}
	return {
		total: orders.length,
		ordersToday,
		revenueToday: Math.round(revenueToday),
		revenueMonth: Math.round(revenueMonth),
		pending,
		awaitingConfirmation,
		currency: orders[0]?.currency || 'USD'
	};
}

export async function deleteOrder(clientId, id) {
	const { error } = await supabase.from('orders').delete().eq('id', id).eq('client_id', clientId);
	return { ok: !error, error };
}
