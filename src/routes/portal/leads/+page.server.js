import { supabase } from '$lib/server/supabase.js';

export async function load({ locals }) {
	const { data: leads } = await supabase
		.from('leads')
		.select('*')
		.eq('client_id', locals.user.client_id)
		.order('created_at', { ascending: false })
		.limit(200);
	return { leads: leads ?? [] };
}
