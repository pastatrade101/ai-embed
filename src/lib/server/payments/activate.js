// Activate a client's subscription after a confirmed payment. Idempotent enough
// for our needs: it just sets the target plan + active status + next renewal +
// the plan's conversation cap. Called from both the webhook and the self-verify
// fallback (like Pastatrade's assignPlan).
import { supabase } from '../supabase.js';

export async function activateClientPlan(clientId, planKey, { provider = 'snippe', interval = 'monthly', reference = null } = {}) {
	if (!clientId || !planKey) return { ok: false, error: 'missing client or plan' };

	const { data: plan } = await supabase
		.from('plans')
		.select('key, monthly_conversation_cap')
		.eq('key', planKey)
		.maybeSingle();

	const renews = new Date();
	if (interval === 'yearly') renews.setFullYear(renews.getFullYear() + 1);
	else renews.setMonth(renews.getMonth() + 1);

	const patch = {
		plan: planKey,
		subscription_status: 'active',
		plan_renews_at: renews.toISOString()
	};
	if (plan?.monthly_conversation_cap != null) patch.monthly_conversation_cap = plan.monthly_conversation_cap;

	const { error } = await supabase.from('clients').update(patch).eq('id', clientId);
	if (error) {
		console.error('[payments] activate failed:', error.message);
		return { ok: false, error: error.message };
	}
	console.log(`[payments] client ${clientId} → ${planKey} via ${provider} (${reference ?? 'n/a'})`);
	return { ok: true };
}
