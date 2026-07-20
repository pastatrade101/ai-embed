// Customers service — the person behind the WhatsApp number. Deliberately simple
// (phone, name, notes, orders, total spent). Deduped by phone so the same number is
// ONE customer, never a new record per message. Tenant-scoped, fail-open before 026.
import { supabase } from './supabase.js';

const COLS = 'id, client_id, phone, name, email, notes, status, source, tags, total_spent, order_count, last_interaction_at, meta, created_at, updated_at';

export function isMissingCustomers(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	return /42P01|PGRST205|does not exist|schema cache|could not find the table/i.test(m);
}

export const normalizePhone = (v) => String(v ?? '').replace(/[^0-9]/g, '');

/**
 * Find-or-create a customer by phone (the dedup seam). Fills in name on first sight,
 * bumps last_interaction_at. Returns { customer } or { customer:null, tableMissing }.
 */
export async function upsertByPhone(clientId, { phone, name = null, source = 'whatsapp' } = {}) {
	const p = normalizePhone(phone);
	if (!p) return { customer: null };
	const { data: existing, error: readErr } = await supabase.from('customers').select(COLS).eq('client_id', clientId).eq('phone', p).maybeSingle();
	if (readErr) return { customer: null, tableMissing: isMissingCustomers(readErr) };
	if (existing) {
		const patch = { last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString() };
		if (!existing.name && name) patch.name = name; // fill in a name we didn't have
		const { data } = await supabase.from('customers').update(patch).eq('id', existing.id).select(COLS).single();
		return { customer: data ?? existing };
	}
	const { data, error } = await supabase
		.from('customers')
		.insert({ client_id: clientId, phone: p, name: name || null, source, last_interaction_at: new Date().toISOString() })
		.select(COLS)
		.single();
	if (error) {
		// Lost a race to a concurrent insert → re-read.
		const { data: again } = await supabase.from('customers').select(COLS).eq('client_id', clientId).eq('phone', p).maybeSingle();
		return { customer: again ?? null, tableMissing: isMissingCustomers(error) };
	}
	return { customer: data };
}

export async function getCustomer(clientId, id) {
	const { data, error } = await supabase.from('customers').select(COLS).eq('id', id).eq('client_id', clientId).maybeSingle();
	if (error && isMissingCustomers(error)) return { customer: null, tableMissing: true };
	return { customer: data ?? null };
}

export async function listCustomers(clientId, { search = '', page = 1, pageSize = 50 } = {}) {
	let q = supabase.from('customers').select(COLS, { count: 'exact' }).eq('client_id', clientId);
	if (search && search.trim()) {
		const s = search.trim().replace(/[%,]/g, ' ');
		q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%`);
	}
	const from = Math.max(0, (page - 1) * pageSize);
	q = q.order('last_interaction_at', { ascending: false, nullsFirst: false }).order('updated_at', { ascending: false }).range(from, from + pageSize - 1);
	const { data, error, count } = await q;
	if (error) return { customers: [], total: 0, tableMissing: isMissingCustomers(error) };
	return { customers: data ?? [], total: count ?? (data ?? []).length };
}

export async function updateCustomer(clientId, id, patch = {}) {
	const set = { updated_at: new Date().toISOString() };
	for (const k of ['name', 'email', 'notes', 'status']) if (k in patch) set[k] = patch[k] == null ? null : String(patch[k]).trim() || null;
	if ('tags' in patch) set.tags = Array.isArray(patch.tags) ? patch.tags : [];
	const { data, error } = await supabase.from('customers').update(set).eq('id', id).eq('client_id', clientId).select(COLS).single();
	if (error) return { customer: null, error };
	return { customer: data };
}

/** Recompute order_count + total_spent from the tenant's orders (confirmed onward). */
export async function recomputeStats(clientId, customerId) {
	const { data } = await supabase.from('orders').select('total, status').eq('client_id', clientId).eq('customer_id', customerId);
	const rows = data ?? [];
	const spent = rows.filter((o) => ['confirmed', 'completed'].includes(o.status)).reduce((a, o) => a + (Number(o.total) || 0), 0);
	await supabase.from('customers').update({ order_count: rows.length, total_spent: Math.round(spent * 100) / 100, updated_at: new Date().toISOString() }).eq('id', customerId).eq('client_id', clientId);
}
