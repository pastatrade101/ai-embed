// Products service — the tenant's real catalogue (money in integer minor units).
// Powers manual management, AI order matching, and inventory. Tenant-scoped, fail-open
// before migration 024.
import { supabase } from './supabase.js';
import { balancesFor } from './inventory.js';

const COLS =
	'id, client_id, name, description, sku, barcode, category_id, brand, unit, price_minor, cost_minor, currency, tax_rate, track_inventory, min_stock, active, images, tags, aliases, attributes, meta, created_at, updated_at';

export function isMissingProducts(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	return /42P01|PGRST205|does not exist|schema cache|could not find the table/i.test(m);
}

const clean = (v) => (v == null ? null : String(v).trim() || null);
const arr = (v) => (Array.isArray(v) ? v : []);

export async function createProduct(clientId, data = {}) {
	const row = {
		client_id: clientId,
		name: (data.name ?? '').trim(),
		description: clean(data.description),
		sku: clean(data.sku),
		barcode: clean(data.barcode),
		category_id: data.category_id || null,
		brand: clean(data.brand),
		unit: (data.unit ?? 'unit').trim() || 'unit',
		price_minor: Math.max(0, Math.round(Number(data.price_minor) || 0)),
		cost_minor: Math.max(0, Math.round(Number(data.cost_minor) || 0)),
		currency: (data.currency || 'USD').toUpperCase().slice(0, 8),
		tax_rate: Math.max(0, Number(data.tax_rate) || 0),
		track_inventory: data.track_inventory !== false,
		min_stock: Math.max(0, Math.round(Number(data.min_stock) || 0)),
		active: data.active !== false,
		images: arr(data.images),
		tags: arr(data.tags),
		aliases: arr(data.aliases),
		attributes: data.attributes && typeof data.attributes === 'object' ? data.attributes : {}
	};
	if (!row.name) return { product: null, error: { message: 'name_required' } };
	const { data: created, error } = await supabase.from('products').insert(row).select(COLS).single();
	if (error) return { product: null, error, tableMissing: isMissingProducts(error) };
	return { product: created };
}

export async function updateProduct(clientId, id, patch = {}) {
	const set = { updated_at: new Date().toISOString() };
	for (const k of ['name', 'description', 'sku', 'barcode', 'category_id', 'brand', 'unit', 'currency'])
		if (k in patch) set[k] = k === 'currency' ? String(patch[k] || 'USD').toUpperCase().slice(0, 8) : k === 'name' || k === 'unit' ? (patch[k] ?? '').trim() : clean(patch[k]);
	for (const k of ['price_minor', 'cost_minor', 'min_stock'])
		if (k in patch) set[k] = Math.max(0, Math.round(Number(patch[k]) || 0));
	if ('tax_rate' in patch) set.tax_rate = Math.max(0, Number(patch.tax_rate) || 0);
	if ('track_inventory' in patch) set.track_inventory = !!patch.track_inventory;
	if ('active' in patch) set.active = !!patch.active;
	for (const k of ['images', 'tags', 'aliases']) if (k in patch) set[k] = arr(patch[k]);
	if ('attributes' in patch && patch.attributes && typeof patch.attributes === 'object') set.attributes = patch.attributes;
	const { data, error } = await supabase.from('products').update(set).eq('id', id).eq('client_id', clientId).select(COLS).single();
	if (error) return { product: null, error };
	return { product: data };
}

export async function getProduct(clientId, id) {
	const { data, error } = await supabase.from('products').select(COLS).eq('id', id).eq('client_id', clientId).maybeSingle();
	if (error && isMissingProducts(error)) return { product: null, tableMissing: true };
	return { product: data ?? null };
}

/** Paginated list + search (name/sku/brand/tags). Returns products with live stock. */
export async function listProducts(clientId, { search = '', activeOnly = false, page = 1, pageSize = 50 } = {}) {
	let q = supabase.from('products').select(COLS, { count: 'exact' }).eq('client_id', clientId);
	if (activeOnly) q = q.eq('active', true);
	if (search && search.trim()) {
		const s = search.trim().replace(/[%,]/g, ' ');
		q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,brand.ilike.%${s}%`);
	}
	const from = Math.max(0, (page - 1) * pageSize);
	q = q.order('updated_at', { ascending: false }).range(from, from + pageSize - 1);
	const { data, error, count } = await q;
	if (error) return { products: [], total: 0, tableMissing: isMissingProducts(error) };
	const bal = await balancesFor(clientId, (data ?? []).map((p) => p.id));
	const products = (data ?? []).map((p) => ({ ...p, stock: bal.get(p.id) || { on_hand: 0, reserved: 0, available: 0 } }));
	return { products, total: count ?? products.length };
}

/**
 * AI/order matching: find the best product for a free-text item name. Matches on
 * name, sku, aliases and AI keywords (case-insensitive substring + alias equality).
 * Returns { product, confidence, alternatives } or { product:null }.
 */
export async function matchProduct(clientId, rawName) {
	const name = String(rawName || '').toLowerCase().trim();
	if (!name) return { product: null };
	const { data, error } = await supabase.from('products').select('id, name, sku, price_minor, currency, unit, aliases, track_inventory').eq('client_id', clientId).eq('active', true).limit(500);
	if (error || !data?.length) return { product: null };
	const scored = data
		.map((p) => {
			const n = String(p.name || '').toLowerCase().trim();
			const aliases = (Array.isArray(p.aliases) ? p.aliases : []).map((a) => String(a).toLowerCase().trim()).filter(Boolean);
			const sku = String(p.sku || '').toLowerCase().trim();
			let score = 0;
			if (n === name || sku === name || aliases.includes(name)) score = 1;
			else if (aliases.some((a) => a && (a.includes(name) || name.includes(a)))) score = 0.85;
			else if (n && (n.includes(name) || name.includes(n))) score = 0.75;
			return { p, score };
		})
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score);
	if (!scored.length) return { product: null };
	return {
		product: scored[0].p,
		confidence: scored[0].score,
		alternatives: scored.slice(1, 4).map((x) => ({ id: x.p.id, name: x.p.name, confidence: x.score }))
	};
}

export async function listCatalogueForMatching(clientId) {
	const { data } = await supabase.from('products').select('id').eq('client_id', clientId).eq('active', true).limit(1);
	return (data ?? []).length > 0;
}

export async function deleteProduct(clientId, id) {
	const { error } = await supabase.from('products').delete().eq('id', id).eq('client_id', clientId);
	return { ok: !error, error };
}
