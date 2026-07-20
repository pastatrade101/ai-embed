// Meta WhatsApp Cloud API webhook.
//   GET  /api/webhooks/whatsapp  — Meta's verification handshake (hub.challenge).
//   POST /api/webhooks/whatsapp  — inbound messages, statuses, errors.
// Public (no session): the GET is gated by the verify token, the POST by the
// X-Hub-Signature-256 HMAC. Tokens/secrets stay server-side via $lib/server.
import { verifyChallenge, verifySignature, parseWebhook, dispatchWebhookEvents } from '$lib/server/whatsapp/webhook.js';
import { whatsappConfig } from '$lib/server/whatsapp/config.js';
import { log } from '$lib/server/whatsapp/logger.js';

export async function GET({ url }) {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	const echo = verifyChallenge({ mode, token, challenge });
	if (echo !== null) {
		log.info('webhook_verified', { mode });
		// Meta expects the raw challenge string, 200, plain text.
		return new Response(echo, { status: 200, headers: { 'content-type': 'text/plain' } });
	}
	log.warn('webhook_verify_rejected', { mode, hasToken: !!token });
	return new Response('Forbidden', { status: 403 });
}

export async function POST({ request }) {
	// The RAW body is required to validate the HMAC — read it before parsing.
	const raw = await request.text();
	const signature = request.headers.get('x-hub-signature-256');
	const { appSecret } = whatsappConfig();

	const check = verifySignature(raw, signature);
	// With an app secret configured, a bad/missing signature is rejected. Without one
	// (early dev, before you paste WHATSAPP_APP_SECRET), accept but log — so the
	// initial handshake and test events still flow.
	if (appSecret && !check.ok) {
		log.warn('webhook_bad_signature', { reason: check.reason });
		return new Response('Invalid signature', { status: 401 });
	}
	if (!appSecret) log.warn('webhook_unsigned_accept', { reason: 'no_app_secret' });

	let body;
	try {
		body = raw ? JSON.parse(raw) : {};
	} catch {
		return new Response('Bad Request', { status: 400 });
	}

	// Process best-effort; always ack 200 fast so Meta doesn't retry-storm.
	try {
		await dispatchWebhookEvents(parseWebhook(body));
	} catch (err) {
		log.error('webhook_process_failed', { error: err?.message });
	}
	return new Response('EVENT_RECEIVED', { status: 200 });
}
