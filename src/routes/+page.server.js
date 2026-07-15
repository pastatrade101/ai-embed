// Root: the public marketing landing page. Signed-in users skip it and go
// straight to their workspace. Pricing is pulled live from the plans catalogue
// so the landing page always shows the operator's real prices (TZS).
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';

export async function load({ locals }) {
	if (locals.user) throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');

	const { data: plans } = await supabase
		.from('plans')
		.select('key, name, price_amount, price_currency, monthly_conversation_cap, features')
		.eq('is_active', true)
		.order('sort', { ascending: true });

	return { plans: plans ?? [] };
}
