import { supabase } from '$lib/server/supabase.js';

export async function load({ locals }) {
	const { data: conversations } = await supabase
		.from('conversations')
		.select('id, messages, summary, created_at, updated_at')
		.eq('client_id', locals.user.client_id)
		.order('created_at', { ascending: false })
		.limit(50);
	return { conversations: conversations ?? [] };
}
