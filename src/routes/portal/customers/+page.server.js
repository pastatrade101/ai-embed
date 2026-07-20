// Portal ▸ Customers — the people behind the WhatsApp numbers. Simple by design.
// Always available (core to the commerce flow); records are usually created
// automatically from orders/conversations, with a manual add for convenience.
import { fail } from '@sveltejs/kit';
import { listCustomers, upsertByPhone } from '$lib/server/customers.js';

export async function load({ locals, parent, url }) {
	const { client } = await parent();
	const search = url.searchParams.get('q') || '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const { customers, total, tableMissing } = await listCustomers(locals.user.client_id, { search, page, pageSize: 50 });
	return { customers, total, page, search, needsMigration: !!tableMissing, currency: client.default_currency || 'USD' };
}

export const actions = {
	add: async ({ request, locals }) => {
		const f = await request.formData();
		const phone = String(f.get('phone') || '').trim();
		const name = String(f.get('name') || '').trim() || null;
		if (!phone.replace(/[^0-9]/g, '')) return fail(400, { error: 'Enter a valid WhatsApp number.' });
		const { customer, tableMissing } = await upsertByPhone(locals.user.client_id, { phone, name, source: 'manual' });
		if (!customer) return fail(400, { error: tableMissing ? 'Run db/026_customers.sql first.' : 'Could not add customer.' });
		return { ok: `Customer ${customer.name || customer.phone} added.`, customerId: customer.id };
	}
};
