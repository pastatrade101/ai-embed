// Portal ▸ Orders ▸ detail. Full order record: items, status flow, delivery, notes,
// timeline. Tenant-scoped; gated behind the `orders` module.
import { error, fail, redirect } from '@sveltejs/kit';
import { isModuleEnabled } from '$lib/server/modules.js';
import { getOrder, updateOrder, setOrderStatus, setPaymentStatus, deleteOrder, orderTimeline, ORDER_STATUSES, ORDER_STATUS_KEYS, PAYMENT_STATUSES, PAYMENT_STATUS_KEYS } from '$lib/server/orders.js';
import { generateInvoiceFromOrder, getOrderInvoice } from '$lib/server/invoices.js';
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
	return { order, timeline, statuses: ORDER_STATUSES, paymentStatuses: PAYMENT_STATUSES, invoice, hostedBase: String(origin).replace(/\/$/, '') };
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

	remove: async ({ params, locals }) => {
		await deleteOrder(locals.user.client_id, params.id);
		throw redirect(303, '/portal/orders');
	}
};
