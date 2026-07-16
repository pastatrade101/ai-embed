// Activate a client's subscription after a confirmed payment. Idempotent enough
// for our needs: it just sets the target plan + active status + next renewal +
// the plan's conversation cap. Called from both the webhook and the self-verify
// fallback (like Pastatrade's assignPlan).
import { supabase } from '../supabase.js';
import { CREDIT_PACKS } from '../credits.js';

/** Credit a purchased AI Credit pack to a client (from the webhook or self-verify).
 *  The pack's AI-cost value is taken server-side from CREDIT_PACKS, never client
 *  input. Idempotent on `reference` (a redelivered webhook won't double-credit). */
export async function creditClientPack(clientId, packKey, { reference = null, amount = null, currency = null, provider = 'snippe' } = {}) {
	if (!clientId || !packKey) return { ok: false, error: 'missing client or pack' };
	const pack = CREDIT_PACKS.find((p) => p.key === packKey);
	if (!pack) return { ok: false, error: `unknown pack: ${packKey}` };
	const { error } = await supabase.from('ai_credit_packs').insert({
		client_id: clientId,
		pack_key: packKey,
		budget: pack.budget,
		amount_paid: amount ?? pack.price,
		currency: currency ?? pack.currency,
		provider,
		reference
	});
	if (error) {
		if (/duplicate|unique/i.test(error.message)) return { ok: true, duplicate: true }; // already credited
		console.error('[payments] credit pack failed:', error.message);
		return { ok: false, error: error.message };
	}
	console.log(`[payments] client ${clientId} credited pack ${packKey} (${reference ?? 'n/a'})`);
	return { ok: true };
}

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
