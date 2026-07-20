// Portal ▸ Orders — the Order Management module (Phase 1 of the AI Business OS).
// Gated behind the `orders` module (enable it in Portal → Modules). AI draft turns a
// pasted customer message into a draft order the operator confirms.
import { fail } from '@sveltejs/kit';
import { isModuleEnabled } from '$lib/server/modules.js';
import { listOrders, createOrder, setOrderStatus, deleteOrder, ORDER_STATUSES, ORDER_STATUS_KEYS } from '$lib/server/orders.js';
import { draftOrderFromMessage } from '$lib/server/order-extraction.js';

export async function load({ locals, parent }) {
	const { client } = await parent();
	const enabled = isModuleEnabled(client, 'orders');
	if (!enabled) return { enabled: false, orders: [], statuses: ORDER_STATUSES, needsMigration: false };
	const { orders, tableMissing } = await listOrders(locals.user.client_id, { limit: 300 });
	return { enabled: true, orders, statuses: ORDER_STATUSES, needsMigration: !!tableMissing };
}

function parseItems(raw) {
	try {
		const arr = JSON.parse(raw || '[]');
		return Array.isArray(arr) ? arr : [];
	} catch {
		return [];
	}
}

export const actions = {
	// AI: extract a draft order from a natural-language message.
	extract: async ({ request, locals, parent }) => {
		const { client } = await parent();
		if (!isModuleEnabled(client, 'orders')) return fail(403, { error: 'The Orders module is not enabled.' });
		const form = await request.formData();
		const message = String(form.get('message') || '').trim();
		const phone = String(form.get('customer_phone') || '').trim() || null;
		if (message.length < 3) return fail(400, { error: 'Paste the customer message first.' });
		const { order, extraction, skipped } = await draftOrderFromMessage({ client, message, from: phone, source: 'whatsapp' });
		if (order) return { ok: `Draft order ${order.number} created — review and confirm it.`, orderId: order.id };
		if (skipped === 'not_an_order') return fail(422, { error: `That doesn't look like an order${extraction?.reasoning ? ` — ${extraction.reasoning}` : ''}. You can still create one manually.` });
		if (skipped === 'migration_needed' || skipped === 'create_failed') return fail(400, { error: 'Could not save the draft — run db/023_orders.sql, then try again.' });
		return fail(400, { error: 'The AI could not read an order from that message. Try adding the product and quantity, or create it manually.' });
	},

	// Manual create (items come as a JSON string built in the browser).
	create: async ({ request, locals, parent }) => {
		const { client } = await parent();
		if (!isModuleEnabled(client, 'orders')) return fail(403, { error: 'The Orders module is not enabled.' });
		const form = await request.formData();
		const items = parseItems(form.get('items'));
		if (!items.length) return fail(400, { error: 'Add at least one item.' });
		const { order, error, tableMissing } = await createOrder(locals.user.client_id, {
			source: 'manual',
			status: 'confirmed',
			customer_name: String(form.get('customer_name') || '').trim() || null,
			customer_phone: String(form.get('customer_phone') || '').trim() || null,
			currency: client.default_currency || 'USD',
			items,
			delivery_date: String(form.get('delivery_date') || '').trim() || null,
			delivery_address: String(form.get('delivery_address') || '').trim() || null,
			notes: String(form.get('notes') || '').trim() || null
		});
		if (error) return fail(400, { error: tableMissing ? 'Run db/023_orders.sql first.' : 'Could not create the order.' });
		return { ok: `Order ${order.number} created.`, orderId: order.id };
	},

	status: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const status = String(form.get('status') || '');
		if (!id || !ORDER_STATUS_KEYS.includes(status)) return fail(400, { error: 'Invalid status.' });
		const res = await setOrderStatus(locals.user.client_id, id, status);
		if (!res.ok) {
			if (res.error === 'insufficient_stock') {
				const detail = (res.shortages || []).map((s) => `${s.requested} needed, ${s.available} in stock`).join('; ');
				return fail(409, { error: `Not enough stock to confirm — ${detail}. Restock or enable backorders.` });
			}
			return fail(400, { error: 'Could not update the order.' });
		}
		return { ok: 'Order updated.' };
	},

	remove: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const { ok } = await deleteOrder(locals.user.client_id, id);
		if (!ok) return fail(400, { error: 'Could not delete the order.' });
		return { ok: 'Order deleted.' };
	}
};
