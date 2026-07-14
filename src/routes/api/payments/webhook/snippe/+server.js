// POST /api/payments/webhook/snippe — public; authenticated by HMAC signature,
// NOT a session cookie. Verifies, records to payment_events, advances the matching
// payment_attempt, and on payment.completed activates the client's subscription.
// Idempotent on the provider event id. (Same technique as the Pastatrade backend.)
import { supabase } from '$lib/server/supabase.js';
import { getPaymentProvider } from '$lib/server/payments/index.js';
import { activateClientPlan } from '$lib/server/payments/activate.js';

const ATTEMPT_STATUS = {
	'payment.completed': 'completed',
	'payment.failed': 'failed',
	'payment.voided': 'cancelled',
	'payment.expired': 'expired'
};

export async function POST({ request }) {
	const provider = getPaymentProvider();
	if (!provider || provider.name !== 'snippe') return new Response('Payments not configured', { status: 503 });

	// RAW body is required for the HMAC — read it before parsing.
	const raw = await request.text();
	const headers = {
		'x-webhook-signature': request.headers.get('x-webhook-signature') ?? undefined,
		'x-webhook-timestamp': request.headers.get('x-webhook-timestamp') ?? undefined
	};
	if (!provider.verifyWebhook(raw, headers)) return new Response('Invalid signature', { status: 400 });

	let body;
	try {
		body = raw ? JSON.parse(raw) : {};
	} catch {
		return new Response('Invalid body', { status: 400 });
	}
	const event = provider.parseEvent(body);

	// Idempotency — don't double-process a redelivered event.
	if (event.id) {
		const { data: existing } = await supabase
			.from('payment_events')
			.select('id')
			.eq('provider', 'snippe')
			.eq('event_payload->>id', event.id)
			.maybeSingle();
		if (existing) return new Response('OK');
	}

	const clientId = event.metadata.client_id ?? null;
	const userId = event.metadata.user_id ?? null;
	const planKey = event.metadata.plan_key ?? null;

	await supabase.from('payment_events').insert({
		client_id: clientId,
		user_id: userId,
		provider: 'snippe',
		event_type: event.type,
		status: event.status || null,
		event_payload: event.raw
	});

	// Advance the matching pending attempt for this client.
	const attemptStatus = ATTEMPT_STATUS[event.type] ?? null;
	if (attemptStatus && clientId) {
		let q = supabase
			.from('payment_attempts')
			.select('id')
			.eq('client_id', clientId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
			.limit(1);
		if (planKey) q = q.eq('plan_key', planKey);
		const { data: attempt } = await q.maybeSingle();
		if (attempt) {
			await supabase.from('payment_attempts').update({ status: attemptStatus, updated_at: new Date().toISOString() }).eq('id', attempt.id);
		}
	}

	if (event.type === 'payment.completed' && clientId && planKey) {
		await activateClientPlan(clientId, planKey, {
			provider: 'snippe',
			interval: event.metadata.interval === 'yearly' ? 'yearly' : 'monthly',
			reference: event.reference
		});
	}

	return new Response('OK');
}
