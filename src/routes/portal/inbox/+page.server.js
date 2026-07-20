// Portal ▸ Inbox — the transformation workspace (the product's hero). NOT a chat list:
// it's the queue of draft orders the AI extracted from WhatsApp messages, where the
// owner reviews ONLY the uncertain fields and confirms in one click. Gated behind the
// `orders` module.
import { fail, redirect } from '@sveltejs/kit';
import { isModuleEnabled } from '$lib/server/modules.js';
import { listOrders, updateOrder, setOrderStatus, deleteOrder } from '$lib/server/orders.js';

export async function load({ locals, parent }) {
	const { client } = await parent();
	if (!isModuleEnabled(client, 'orders')) return { enabled: false, drafts: [] };
	const { orders, tableMissing } = await listOrders(locals.user.client_id, { status: 'draft', limit: 100 });
	return { enabled: true, needsMigration: !!tableMissing, drafts: orders, currency: client.default_currency || 'USD' };
}

function parseItems(raw) {
	try {
		const arr = JSON.parse(raw || '[]');
		return Array.isArray(arr) ? arr : null;
	} catch {
		return null;
	}
}

export const actions = {
	// Save any inline fixes, then confirm — one click. Confirming reserves stock.
	confirm: async ({ request, locals }) => {
		const f = await request.formData();
		const id = String(f.get('id') || '');
		if (!id) return fail(400, { error: 'Missing order.' });
		const items = parseItems(f.get('items'));
		const patch = {
			customer_name: String(f.get('customer_name') || '').trim() || null,
			delivery_address: String(f.get('delivery_address') || '').trim() || null,
			delivery_date: String(f.get('delivery_date') || '').trim() || null
		};
		if (Array.isArray(items) && items.length) patch.items = items;
		await updateOrder(locals.user.client_id, id, patch);
		const res = await setOrderStatus(locals.user.client_id, id, 'confirmed');
		if (!res.ok) {
			if (res.error === 'insufficient_stock') {
				const detail = (res.shortages || []).map((s) => `${s.requested} needed, ${s.available} in stock`).join('; ');
				return fail(409, { error: `Not enough stock — ${detail}.` });
			}
			return fail(400, { error: 'Could not confirm the order.' });
		}
		return { ok: 'Order confirmed.', confirmedId: id };
	},

	// Save edits without confirming (park it).
	save: async ({ request, locals }) => {
		const f = await request.formData();
		const id = String(f.get('id') || '');
		const items = parseItems(f.get('items'));
		const patch = {
			customer_name: String(f.get('customer_name') || '').trim() || null,
			delivery_address: String(f.get('delivery_address') || '').trim() || null,
			delivery_date: String(f.get('delivery_date') || '').trim() || null
		};
		if (Array.isArray(items) && items.length) patch.items = items;
		const { error } = await updateOrder(locals.user.client_id, id, patch);
		return error ? fail(400, { error: 'Could not save.' }) : { ok: 'Saved.' };
	},

	dismiss: async ({ request, locals }) => {
		const f = await request.formData();
		await deleteOrder(locals.user.client_id, String(f.get('id') || ''));
		return { ok: 'Draft dismissed.', dismissedId: String(f.get('id') || '') };
	}
};
