// hooks.server.js guards /portal to operators. Load the operator's own client
// plus its Industry Registry entry (client-safe part), so every portal page can
// use the right terminology, categories and copy without re-resolving it.
import { error } from '@sveltejs/kit';
import { getClientById } from '$lib/server/tenant.js';
import { industryOf } from '$lib/industries.js';

export async function load({ locals }) {
	if (!locals.user?.client_id) throw error(403, 'No business is linked to this account.');
	const client = await getClientById(locals.user.client_id);
	if (!client) throw error(404, 'Your business could not be found.');
	return { user: locals.user, client, industry: industryOf(client) };
}
