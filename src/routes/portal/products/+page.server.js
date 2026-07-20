// Portal ▸ Products & Inventory. Manage the catalogue + stock. Gated behind the
// `inventory` module. Money is entered in major units and stored as minor units.
import { fail } from '@sveltejs/kit';
import { getClientById } from '$lib/server/tenant.js';
import { isModuleEnabled } from '$lib/server/modules.js';
import { listProducts, createProduct, updateProduct, deleteProduct } from '$lib/server/products.js';
import { applyMovement, lowStock } from '$lib/server/inventory.js';
import { toMinor } from '$lib/server/money.js';

export async function load({ locals, parent, url }) {
	const { client } = await parent();
	if (!isModuleEnabled(client, 'inventory')) return { enabled: false, products: [], total: 0, page: 1, search: '', low: 0, currency: client.default_currency || 'USD' };
	const search = url.searchParams.get('q') || '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const { products, total, tableMissing } = await listProducts(locals.user.client_id, { search, page, pageSize: 40 });
	const low = tableMissing ? { items: [] } : await lowStock(locals.user.client_id, { limit: 100 });
	return {
		enabled: true,
		needsMigration: !!tableMissing,
		products,
		total,
		page,
		search,
		low: (low.items || []).length,
		currency: client.default_currency || 'USD'
	};
}

const splitList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const actions = {
	create: async ({ request, locals }) => {
		const client = await getClientById(locals.user.client_id);
		if (!isModuleEnabled(client, 'inventory')) return fail(403, { error: 'Enable the Inventory module first.' });
		const f = await request.formData();
		const currency = client.default_currency || 'USD';
		const { product, error, tableMissing } = await createProduct(locals.user.client_id, {
			name: f.get('name'),
			sku: f.get('sku'),
			unit: f.get('unit') || 'unit',
			brand: f.get('brand'),
			description: f.get('description'),
			price_minor: toMinor(f.get('price'), currency),
			cost_minor: toMinor(f.get('cost'), currency),
			currency,
			tax_rate: Number(f.get('tax_rate')) || 0,
			track_inventory: f.get('track_inventory') === 'on',
			min_stock: Number(f.get('min_stock')) || 0,
			aliases: splitList(f.get('aliases')),
			images: f.get('image') ? [String(f.get('image')).trim()] : []
		});
		if (error) return fail(400, { error: tableMissing ? 'Run db/024_inventory.sql first.' : error.message === 'name_required' ? 'Product name is required.' : 'Could not create product.' });
		// Optional opening stock.
		const opening = Number(f.get('opening_stock')) || 0;
		if (opening > 0 && product.track_inventory) await applyMovement({ clientId: locals.user.client_id, productId: product.id, type: 'opening', qty: opening, reason: 'Initial stock' });
		return { ok: `Product “${product.name}” added.` };
	},

	update: async ({ request, locals }) => {
		const client = await getClientById(locals.user.client_id);
		if (!isModuleEnabled(client, 'inventory')) return fail(403, { error: 'Enable the Inventory module first.' });
		const f = await request.formData();
		const id = String(f.get('id') || '');
		const currency = client.default_currency || 'USD';
		const patch = {
			name: f.get('name'),
			sku: f.get('sku'),
			unit: f.get('unit') || 'unit',
			brand: f.get('brand'),
			description: f.get('description'),
			price_minor: toMinor(f.get('price'), currency),
			cost_minor: toMinor(f.get('cost'), currency),
			tax_rate: Number(f.get('tax_rate')) || 0,
			track_inventory: f.get('track_inventory') === 'on',
			min_stock: Number(f.get('min_stock')) || 0,
			active: f.get('active') === 'on',
			aliases: splitList(f.get('aliases')),
			images: f.get('image') ? [String(f.get('image')).trim()] : []
		};
		const { error } = await updateProduct(locals.user.client_id, id, patch);
		return error ? fail(400, { error: 'Could not save product.' }) : { ok: 'Saved.' };
	},

	// Set opening / adjust stock via the ledger (never edits a total directly).
	adjust: async ({ request, locals }) => {
		const client = await getClientById(locals.user.client_id);
		if (!isModuleEnabled(client, 'inventory')) return fail(403, { error: 'Enable the Inventory module first.' });
		const f = await request.formData();
		const productId = String(f.get('product_id') || '');
		const qty = Math.round(Number(f.get('qty')) || 0);
		const type = String(f.get('type') || 'adjustment');
		if (!productId || !qty) return fail(400, { error: 'Enter a non-zero quantity.' });
		const res = await applyMovement({ clientId: locals.user.client_id, productId, type, qty, reason: String(f.get('reason') || '') || null });
		return res.ok ? { ok: 'Stock updated.' } : fail(400, { error: res.tableMissing ? 'Run db/024_inventory.sql first.' : 'Could not update stock.' });
	},

	remove: async ({ request, locals }) => {
		const f = await request.formData();
		const { ok } = await deleteProduct(locals.user.client_id, String(f.get('id') || ''));
		return ok ? { ok: 'Product deleted.' } : fail(400, { error: 'Could not delete.' });
	}
};
