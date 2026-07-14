// hooks.server.js guards /portal to operators. Load the operator's own client.
import { error } from '@sveltejs/kit';
import { getClientById } from '$lib/server/tenant.js';

export async function load({ locals }) {
	if (!locals.user?.client_id) throw error(403, 'No business is linked to this account.');
	const client = await getClientById(locals.user.client_id);
	if (!client) throw error(404, 'Your business could not be found.');
	return { user: locals.user, client };
}
