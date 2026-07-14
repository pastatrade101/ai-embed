import { supabase } from '$lib/server/supabase.js';
import { updateClientSettings } from '$lib/server/tenant.js';

export async function load({ locals }) {
	const { count } = await supabase
		.from('knowledge_items')
		.select('*', { count: 'exact', head: true })
		.eq('client_id', locals.user.client_id);
	return { knowledgeCount: count ?? 0 };
}

export const actions = {
	// Operators can edit their profile, not their plan / status / active flag.
	default: async ({ request, locals }) =>
		updateClientSettings(locals.user.client_id, await request.formData(), { allowAdmin: false })
};
