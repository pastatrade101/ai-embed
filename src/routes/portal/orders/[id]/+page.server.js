// Portal ▸ Orders ▸ detail. Full order record: items, status flow, delivery, notes,
// timeline. Tenant-scoped; gated behind the `orders` module.
import { error, fail, redirect } from '@sveltejs/kit';
import { isModuleEnabled } from '$lib/server/modules.js';
import { getOrder, updateOrder, setOrderStatus, setPaymentStatus, deleteOrder, orderTimeline, ORDER_STATUSES, ORDER_STATUS_KEYS, PAYMENT_STATUSES, PAYMENT_STATUS_KEYS } from '$lib/server/orders.js';
import { generateInvoiceFromOrder, getOrderInvoice } from '$lib/server/invoices.js';
import { getClientById } from '$lib/server/tenant.js';
import { createProduct, matchProduct } from '$lib/server/products.js';
import { toMinor } from '$lib/server/money.js';
import { env } from '$env/dynamic/private';

export async function load({ params, locals, parent, url }) {
	const { client } = await parent();
	if (!isModuleEnabled(client, 'orders')) throw redirect(303, '/portal/modules');
	const { order, tableMissing } = await getOrder(locals.user.client_id, params.id);
	if (tableMissing) throw error(503, 'Run db/023_orders.sql to enable orders.');
	if (!order) throw error(404, 'Order not found.');
	const timeline = await orderTimeline(order.id, locals.user.client_id);
	const { invoice } = await getOrderInvoice(locals.user.client_id, order);
	const origin = env.APP_ORIGIN || env.PUBLIC_APP_URL || url.origin || '';
	// Items the AI didn't recognise but you priced → offer to remember them as products
	// (self-building price memory). Only when the Products module is on.
	const inventoryOn = isModuleEnabled(client, 'inventory');
	const newPriced = (order.items || []).filter((i) => !i.product_id && Number(i.unit_price) > 0 && String(i.description || '').trim());
	return {
		order,
		timeline,
		statuses: ORDER_STATUSES,
		paymentStatuses: PAYMENT_STATUSES,
		invoice,
		hostedBase: String(origin).replace(/\/$/, ''),
		rememberable: inventoryOn ? newPriced.length : 0
	};
}

export const actions = {
	status: async ({ request, params, locals }) => {
		const form = await request.formData();
		const status = String(form.get('status') || '');
		if (!ORDER_STATUS_KEYS.includes(status)) return fail(400, { error: 'Invalid status.' });
		const res = await setOrderStatus(locals.user.client_id, params.id, status);
		if (res.ok) return { ok: 'Status updated.' };
		if (res.error === 'insufficient_stock') {
			const detail = (res.shortages || []).map((s) => `${s.requested} needed, ${s.available} in stock`).join('; ');
			return fail(409, { error: `Not enough stock to confirm — ${detail}. Restock or enable backorders.` });
		}
		return fail(400, { error: 'Could not update.' });
	},

	save: async ({ request, params, locals }) => {
		const form = await request.formData();
		let items;
		try {
			items = JSON.parse(String(form.get('items') || '[]'));
		} catch {
			items = undefined;
		}
		const patch = {
			customer_name: String(form.get('customer_name') || '').trim() || null,
			customer_phone: String(form.get('customer_phone') || '').trim() || null,
			delivery_date: String(form.get('delivery_date') || '').trim() || null,
			delivery_address: String(form.get('delivery_address') || '').trim() || null,
			notes: String(form.get('notes') || '').trim() || null,
			internal_notes: String(form.get('internal_notes') || '').trim() || null
		};
		if (Array.isArray(items)) patch.items = items;
		const { error: err } = await updateOrder(locals.user.client_id, params.id, patch);
		return err ? fail(400, { error: 'Could not save.' }) : { ok: 'Saved.' };
	},

	pay: async ({ request, params, locals }) => {
		const form = await request.formData();
		const status = String(form.get('payment_status') || '');
		if (!PAYMENT_STATUS_KEYS.includes(status)) return fail(400, { error: 'Invalid payment status.' });
		const res = await setPaymentStatus(locals.user.client_id, params.id, status);
		return res.ok ? { ok: 'Payment updated.' } : fail(400, { error: 'Could not update payment.' });
	},

	invoice: async ({ params, locals }) => {
		const { invoice, error: err } = await generateInvoiceFromOrder(locals.user.client_id, params.id);
		if (err || !invoice) return fail(400, { error: 'Could not generate the invoice.' });
		return { ok: `Invoice ${invoice.number} ready.` };
	},

	// Self-building price memory: remember the order's newly-priced, unmatched items as
	// products so the AI auto-fills them next time. Links each order line to its product;
	// reuses an existing product when the name already matches (no duplicates).
	remember: async ({ params, locals }) => {
		const clientId = locals.user.client_id;
		const client = await getClientById(clientId);
		if (!isModuleEnabled(client, 'inventory')) return fail(403, { error: 'Turn on Products to remember prices.' });
		const { order } = await getOrder(clientId, params.id);
		if (!order) return fail(404, { error: 'Order not found.' });
		const currency = order.currency || client.default_currency || 'USD';
		const items = Array.isArray(order.items) ? [...order.items] : [];
		let remembered = 0;
		for (const it of items) {
			if (it.product_id || !(Number(it.unit_price) > 0) || !String(it.description || '').trim()) continue;
			const name = String(it.description).trim();
			const match = await matchProduct(clientId, name);
			let productId = match.product?.id || null;
			if (!productId) {
				// price memory by default — no stock tracking unless the operator opts in later
				const { product } = await createProduct(clientId, { name, price_minor: toMinor(it.unit_price, currency), currency, track_inventory: false });
				productId = product?.id || null;
			}
			if (productId) {
				it.product_id = productId;
				delete it.unmatched;
				remembered++;
			}
		}
		if (!remembered) return fail(400, { error: 'Nothing new to remember.' });
		await updateOrder(clientId, params.id, { items });
		return { ok: `Remembered ${remembered} price${remembered === 1 ? '' : 's'} — the AI will auto-fill next time.` };
	},

	remove: async ({ params, locals }) => {
		await deleteOrder(locals.user.client_id, params.id);
		throw redirect(303, '/portal/orders');
	}
};
