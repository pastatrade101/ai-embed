import { error, fail } from '@sveltejs/kit';
import { getCustomer, updateCustomer } from '$lib/server/customers.js';
import { listOrders } from '$lib/server/orders.js';

export async function load({ params, locals, parent }) {
	const { client } = await parent();
	const { customer, tableMissing } = await getCustomer(locals.user.client_id, params.id);
	if (tableMissing) throw error(503, 'Run db/026_customers.sql to enable customers.');
	if (!customer) throw error(404, 'Customer not found.');
	const { orders } = await listOrders(locals.user.client_id, { customerId: customer.id, limit: 100 });
	return { customer, orders, currency: client.default_currency || 'USD' };
}

export const actions = {
	save: async ({ request, params, locals }) => {
		const f = await request.formData();
		const { error: err } = await updateCustomer(locals.user.client_id, params.id, {
			name: f.get('name'),
			email: f.get('email'),
			notes: f.get('notes')
		});
		return err ? fail(400, { error: 'Could not save.' }) : { ok: 'Saved.' };
	}
};
