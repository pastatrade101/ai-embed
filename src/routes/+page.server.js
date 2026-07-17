// Root: the public marketing landing page. Signed-in users skip it and go
// straight to their workspace. Pricing is pulled live from the plans catalogue
// so the landing page always shows the operator's real prices (TZS).
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { AVG_COST_PER_CONVERSATION } from '$lib/server/credits.js';

export async function load({ locals, url }) {
	if (locals.user) throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');

	const { data: plans } = await supabase
		.from('plans')
		.select('key, name, price_amount, price_currency, monthly_conversation_cap, included_ai_budget, features')
		.eq('is_active', true)
		.order('sort', { ascending: true });

	// Absolute origin for canonical + Open Graph URLs (works on any deploy host).
	// costPerConversation lets the pricing cards derive the same "≈ conversations"
	// capacity the operator billing + admin screens show (from each plan's AI budget),
	// so every screen agrees instead of relying on the legacy conversation cap.
	return { plans: plans ?? [], costPerConversation: AVG_COST_PER_CONVERSATION, origin: url.origin };
}
