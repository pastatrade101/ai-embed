import { supabase } from '$lib/server/supabase.js';
import { conversationsThisMonth, usageThisMonth } from '$lib/server/tenant.js';

export async function load({ parent }) {
	const { client } = await parent();
	const [plansRes, used, usage] = await Promise.all([
		supabase.from('plans').select('*').eq('is_active', true).order('sort'),
		conversationsThisMonth(client.id),
		usageThisMonth(client.id)
	]);
	const plans = plansRes.data ?? [];
	return { plans, currentPlan: plans.find((p) => p.key === client.plan) ?? null, usedThisMonth: used, usage };
}
