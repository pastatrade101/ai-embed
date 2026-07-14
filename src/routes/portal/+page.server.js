import { loadWorkspace } from '$lib/server/tenant.js';

export async function load({ locals }) {
	return loadWorkspace(locals.user.client_id);
}
