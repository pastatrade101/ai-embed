// Inventory service — the stock ledger + reservations, on top of the atomic Postgres
// functions in db/024. Available = on_hand - reserved; every change is a ledger entry.
// Tenant-scoped. FAILS OPEN before migration 024 (missing table/function → no-op, so
// Orders keeps working without stock control).
import { supabase } from './supabase.js';

export function isMissingInventory(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	return /42P01|42883|PGRST202|PGRST205|does not exist|schema cache|could not find|function .* does not exist/i.test(m);
}

/** Get (or lazily create) the tenant's default warehouse. Returns id or null (fail-open). */
export async function defaultWarehouse(clientId) {
	const { data, error } = await supabase
		.from('warehouses')
		.select('id, is_default')
		.eq('client_id', clientId)
		.order('is_default', { ascending: false })
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();
	if (error) return null; // table missing → fail open
	if (data) return data.id;
	const { data: created } = await supabase
		.from('warehouses')
		.insert({ client_id: clientId, name: 'Main', is_default: true })
		.select('id')
		.single();
	return created?.id ?? null;
}

/** Balances for a set of products, keyed by product_id → { on_hand, reserved, available }. */
export async function balancesFor(clientId, productIds = []) {
	const map = new Map();
	if (!productIds.length) return map;
	const { data, error } = await supabase
		.from('inventory_balances')
		.select('product_id, on_hand, reserved')
		.eq('client_id', clientId)
		.in('product_id', productIds);
	if (error) return map;
	for (const b of data ?? []) {
		const cur = map.get(b.product_id) || { on_hand: 0, reserved: 0, available: 0 };
		cur.on_hand += b.on_hand;
		cur.reserved += b.reserved;
		cur.available = cur.on_hand - cur.reserved;
		map.set(b.product_id, cur);
	}
	return map;
}

/** Post a manual stock movement (opening/purchase/adjustment/…). */
export async function applyMovement({ clientId, productId, warehouseId, type, qty, reason = null, refType = null, refId = null }) {
	const wh = warehouseId || (await defaultWarehouse(clientId));
	if (!wh) return { ok: false, error: 'no_warehouse' };
	const { error } = await supabase.rpc('apply_stock_movement', {
		p_client: clientId, p_product: productId, p_warehouse: wh, p_type: type, p_qty: Math.round(Number(qty) || 0), p_reason: reason, p_ref_type: refType, p_ref_id: refId
	});
	if (error) return { ok: false, error: error.message, tableMissing: isMissingInventory(error) };
	return { ok: true };
}

/** Build the reservation list from an order's items (only tracked products with a product_id). */
async function reservableItems(clientId, order, warehouseId) {
	const items = Array.isArray(order.items) ? order.items : [];
	const withProduct = items.filter((i) => i.product_id && (Number(i.qty) || 0) > 0);
	if (!withProduct.length) return [];
	const ids = [...new Set(withProduct.map((i) => i.product_id))];
	const { data } = await supabase.from('products').select('id, track_inventory').eq('client_id', clientId).in('id', ids);
	const tracked = new Set((data ?? []).filter((p) => p.track_inventory).map((p) => p.id));
	return withProduct
		.filter((i) => tracked.has(i.product_id))
		.map((i) => ({ product_id: i.product_id, warehouse_id: warehouseId, qty: Math.round(Number(i.qty) || 0) }));
}

/**
 * Reserve stock for an order (all-or-nothing). Returns:
 *   { ok:true, reserved:n } | { ok:false, shortages:[...] } | { ok:true, skipped:'reason' }
 * Fails open (skipped) when inventory isn't set up, so confirmation still succeeds.
 */
export async function reserveForOrder(clientId, order, { allowBackorder = false } = {}) {
	const wh = await defaultWarehouse(clientId);
	if (!wh) return { ok: true, skipped: 'no_inventory' };
	const items = await reservableItems(clientId, order, wh);
	if (!items.length) return { ok: true, skipped: 'no_tracked_items' };
	const { data, error } = await supabase.rpc('reserve_order_stock', {
		p_client: clientId, p_order: order.id, p_items: items, p_allow_backorder: !!allowBackorder
	});
	if (error) return isMissingInventory(error) ? { ok: true, skipped: 'inventory_missing' } : { ok: false, error: error.message };
	if (data && data.ok === false) return { ok: false, shortages: data.shortages || [] };
	return { ok: true, reserved: items.length };
}

export async function releaseForOrder(clientId, orderId) {
	const { error } = await supabase.rpc('release_order_stock', { p_client: clientId, p_order: orderId });
	return { ok: !error || isMissingInventory(error) };
}

export async function deductForOrder(clientId, orderId) {
	const { error } = await supabase.rpc('deduct_order_stock', { p_client: clientId, p_order: orderId });
	return { ok: !error || isMissingInventory(error) };
}

/** Products at or below their minimum stock level (for alerts + dashboard). */
export async function lowStock(clientId, { limit = 50 } = {}) {
	const { data: products, error } = await supabase
		.from('products')
		.select('id, name, sku, min_stock, unit')
		.eq('client_id', clientId)
		.eq('track_inventory', true)
		.eq('active', true)
		.limit(500);
	if (error) return { items: [], tableMissing: isMissingInventory(error) };
	const bal = await balancesFor(clientId, (products ?? []).map((p) => p.id));
	const items = (products ?? [])
		.map((p) => {
			const b = bal.get(p.id) || { on_hand: 0, reserved: 0, available: 0 };
			return { ...p, ...b };
		})
		.filter((p) => p.available <= (p.min_stock || 0))
		.sort((a, b) => a.available - b.available)
		.slice(0, limit);
	return { items };
}

/** Ledger for a product (audit / history). */
export async function listMovements(clientId, { productId = null, limit = 100 } = {}) {
	let q = supabase.from('stock_movements').select('id, product_id, warehouse_id, type, qty, reason, ref_type, ref_id, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(limit);
	if (productId) q = q.eq('product_id', productId);
	const { data, error } = await q;
	if (error) return { movements: [], tableMissing: isMissingInventory(error) };
	return { movements: data ?? [] };
}
