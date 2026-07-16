import { fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { conversationsThisMonth, usageThisMonth } from '$lib/server/tenant.js';
import { usageSummary, CREDIT_PACKS } from '$lib/server/credits.js';
import { getPaymentProvider, paymentsEnabled } from '$lib/server/payments/index.js';
import { activateClientPlan } from '$lib/server/payments/activate.js';

export async function load({ parent }) {
	const { client } = await parent();
	const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
	const [plansRes, used, usage, credits, pendingRes] = await Promise.all([
		supabase.from('plans').select('*').eq('is_active', true).order('sort'),
		conversationsThisMonth(client.id),
		usageThisMonth(client.id),
		usageSummary(client.id, client.plan),
		supabase
			.from('payment_attempts')
			.select('id, plan_key, amount, currency, status, created_at')
			.eq('client_id', client.id)
			.eq('status', 'pending')
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle()
	]);
	const plans = plansRes.data ?? [];
	return {
		plans,
		currentPlan: plans.find((p) => p.key === client.plan) ?? null,
		usedThisMonth: used,
		usage,
		credits,
		creditPacks: CREDIT_PACKS,
		paymentsEnabled: paymentsEnabled(),
		pendingAttempt: pendingRes.data ?? null
	};
}

export const actions = {
	// Start a hosted Snippe checkout for a plan, then redirect the browser to it.
	checkout: async ({ request, locals, url }) => {
		const provider = getPaymentProvider();
		const form = await request.formData();
		const planKey = String(form.get('plan') ?? '').trim();
		const phone = String(form.get('phone') ?? '').trim();

		if (!provider) return fail(503, { error: 'Online payment isn’t set up yet — contact us to upgrade.' });

		const { data: plan } = await supabase.from('plans').select('*').eq('key', planKey).eq('is_active', true).maybeSingle();
		if (!plan) return fail(400, { error: 'Unknown plan.' });

		const clientId = locals.user.client_id;
		const { data: client } = await supabase
			.from('clients')
			.select('id, name, plan, contact_email, whatsapp_number')
			.eq('id', clientId)
			.maybeSingle();
		if (!client) return fail(404, { error: 'Business not found.' });
		if (client.plan === planKey) return fail(400, { error: `You’re already on ${plan.name}.` });

		// Self-serve checkout is upgrade-only: never let an operator pay for the
		// tier they already hold or a lower one (a "downgrade" via a fresh charge).
		const { data: currentPlan } = await supabase.from('plans').select('sort').eq('key', client.plan).maybeSingle();
		if (currentPlan && Number(plan.sort) <= Number(currentPlan.sort)) {
			return fail(400, { error: `${plan.name} isn’t an upgrade from your current plan — contact us to change plans.` });
		}

		const successUrl = `${url.origin}/portal/billing?upgrade=success`;
		let checkout;
		try {
			checkout = await provider.createCheckout({
				clientId,
				userId: locals.user.id,
				planKey,
				planName: plan.name,
				amount: Number(plan.price_amount),
				currency: plan.price_currency,
				interval: 'monthly',
				customer: {
					name: client.name,
					email: client.contact_email || locals.user.email,
					phone: phone || client.whatsapp_number || undefined
				},
				successUrl
			});
		} catch (e) {
			return fail(e?.status ?? 502, { error: e?.message ?? 'Could not start checkout.' });
		}

		await supabase.from('payment_events').insert({
			client_id: clientId,
			user_id: locals.user.id,
			provider: provider.name,
			event_type: 'checkout_created',
			status: 'pending',
			event_payload: { reference: checkout.reference, plan_key: planKey, amount: plan.price_amount, currency: plan.price_currency }
		});
		await supabase.from('payment_attempts').insert({
			client_id: clientId,
			user_id: locals.user.id,
			provider: provider.name,
			reference: checkout.reference,
			plan_key: planKey,
			billing_interval: 'monthly',
			amount: plan.price_amount,
			currency: plan.price_currency,
			status: 'pending'
		});

		// Hand off to Snippe's hosted checkout (external URL).
		throw redirect(303, checkout.checkout_url);
	},

	// Pull-based fallback when the webhook is missed/delayed: check the live status
	// of the latest pending attempt and activate if it's actually paid.
	verifyPayment: async ({ locals }) => {
		const provider = getPaymentProvider();
		if (!provider?.fetchStatus) return fail(503, { error: 'Automatic verification isn’t available — contact us and we’ll confirm your payment.' });

		const { data: attempt } = await supabase
			.from('payment_attempts')
			.select('id, reference, plan_key')
			.eq('client_id', locals.user.client_id)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		if (!attempt?.reference) return { ok: false, message: 'No pending payment to verify.' };

		const status = await provider.fetchStatus(attempt.reference);
		if (!status) return { ok: false, message: 'Could not reach the payment provider. Please try again shortly.' };
		if (!status.paid) return { ok: false, message: 'Your payment hasn’t completed yet. If you’ve paid, give it a minute and try again.' };

		await activateClientPlan(locals.user.client_id, attempt.plan_key, { provider: provider.name, reference: attempt.reference });
		await supabase.from('payment_attempts').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', attempt.id);
		await supabase.from('payment_events').insert({
			client_id: locals.user.client_id,
			user_id: locals.user.id,
			provider: provider.name,
			event_type: 'payment.completed',
			status: 'completed',
			event_payload: { reference: attempt.reference, via: 'self-verify' }
		});
		return { ok: true, message: 'Payment verified — your plan is now active.' };
	}
};
