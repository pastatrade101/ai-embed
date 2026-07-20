// Webhook plumbing: challenge verification (GET), signature verification (POST),
// payload normalization, and dispatch. Dispatch currently logs everything and fans
// out to registered handlers — the seam where CRM + AI Conversation plug in later.
// Nothing here talks to WhatsApp directly.
import crypto from 'node:crypto';
import { whatsappConfig } from './config.js';
import { log } from './logger.js';

/**
 * Meta's GET verification handshake. Returns the challenge string to echo back when
 * the mode + verify token match; otherwise null (caller responds 403).
 */
export function verifyChallenge({ mode, token, challenge }) {
	const { verifyToken } = whatsappConfig();
	if (mode === 'subscribe' && verifyToken && token === verifyToken) return challenge ?? '';
	return null;
}

/**
 * Validate the X-Hub-Signature-256 header against the raw request body using the app
 * secret. Timing-safe. Returns { ok, reason }. When no app secret is configured
 * (early dev), reason='no_app_secret' and the caller decides whether to accept.
 */
export function verifySignature(rawBody, signatureHeader) {
	const { appSecret } = whatsappConfig();
	if (!appSecret) return { ok: false, reason: 'no_app_secret' };
	if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return { ok: false, reason: 'missing_signature' };
	const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
	const a = Buffer.from(signatureHeader);
	const b = Buffer.from(expected);
	const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
	return { ok, reason: ok ? 'ok' : 'mismatch' };
}

/**
 * Flatten a Meta webhook body into normalized events. Covers inbound messages,
 * status updates (sent/delivered/read/failed) and errors.
 * @returns {Array<object>}
 */
export function parseWebhook(body) {
	const events = [];
	for (const entry of body?.entry ?? []) {
		for (const change of entry?.changes ?? []) {
			const v = change?.value ?? {};
			const phoneNumberId = v?.metadata?.phone_number_id ?? null;
			const contact = v?.contacts?.[0] ?? null;

			for (const m of v.messages ?? []) {
				events.push({
					kind: 'message',
					phoneNumberId,
					from: m.from,
					messageId: m.id,
					timestamp: m.timestamp,
					type: m.type,
					text: m.text?.body ?? null,
					interactive: m.interactive ?? null,
					contactName: contact?.profile?.name ?? null,
					message: m
				});
			}
			for (const s of v.statuses ?? []) {
				events.push({
					kind: 'status',
					phoneNumberId,
					status: s.status, // sent | delivered | read | failed
					messageId: s.id,
					recipient: s.recipient_id,
					timestamp: s.timestamp,
					conversation: s.conversation ?? null,
					errors: s.errors ?? null
				});
			}
			for (const e of v.errors ?? []) {
				events.push({ kind: 'error', phoneNumberId, error: e });
			}
		}
	}
	return events;
}

// Handler registry — later, CRM/AI subscribe here. e.g. on('message', createLeadAndReply).
const handlers = { message: [], status: [], error: [] };
export function on(kind, fn) {
	if (!handlers[kind]) handlers[kind] = [];
	handlers[kind].push(fn);
}

function summarize(ev) {
	if (ev.kind === 'message') return { from: ev.from, type: ev.type, messageId: ev.messageId, phoneNumberId: ev.phoneNumberId, preview: (ev.text ?? '').slice(0, 140) };
	if (ev.kind === 'status') return { status: ev.status, messageId: ev.messageId, recipient: ev.recipient, phoneNumberId: ev.phoneNumberId };
	return { error: ev.error };
}

/** Log every event (spec: "log everything for now") and fan out to handlers. */
export async function dispatchWebhookEvents(events) {
	for (const ev of events) {
		if (ev.kind === 'error') log.error('webhook_error', summarize(ev));
		else log.info(`inbound_${ev.kind}`, summarize(ev));
		for (const fn of handlers[ev.kind] ?? []) {
			try {
				await fn(ev);
			} catch (err) {
				log.error('handler_error', { kind: ev.kind, error: err?.message });
			}
		}
	}
}
