// Lightweight in-process event bus. Business modules emit domain events; subscribers
// turn them into notifications. This is how "the AI never calls WhatsApp directly"
// is enforced — everything flows: module → emitEvent() → subscriber → NotificationService.
//
// To wire a real emitter, call emitEvent(Events.PROPOSAL_ACCEPTED, {...}) from the
// place the thing happens (e.g. the proposal accept action). Emitting is safe before
// go-live: NotificationService no-ops until WhatsApp is configured.
import { NotificationService, Channel } from './notifications.js';
import { log } from './whatsapp/logger.js';

/** Canonical domain event names. */
export const Events = Object.freeze({
	PROPOSAL_CREATED: 'proposal.created',
	PROPOSAL_ACCEPTED: 'proposal.accepted',
	PROPOSAL_REJECTED: 'proposal.rejected',
	INVOICE_CREATED: 'invoice.created',
	PAYMENT_RECEIVED: 'payment.received',
	BOOKING_CONFIRMED: 'booking.confirmed',
	APPOINTMENT_CREATED: 'appointment.created',
	CUSTOMER_FOLLOWUP: 'customer.followup'
});

/** @type {Map<string, Array<(payload:object)=>any>>} */
const listeners = new Map();

export function on(name, fn) {
	const arr = listeners.get(name) || [];
	arr.push(fn);
	listeners.set(name, arr);
}

/**
 * Emit a domain event. Runs listeners sequentially and collects their results;
 * a failing listener is logged and never breaks the emitter.
 */
export async function emitEvent(name, payload = {}) {
	log.info('event', { name, keys: Object.keys(payload) });
	const results = [];
	for (const fn of listeners.get(name) || []) {
		try {
			results.push(await fn(payload));
		} catch (err) {
			log.error('event_listener_failed', { name, error: err?.message });
		}
	}
	return results;
}

// --- Default subscribers: domain event → notification -----------------------
// Each handler builds a payload and routes it through NotificationService. They are
// intentionally conservative (only act when a recipient is present) and no-op until
// WhatsApp is configured. Extend these as each feature ships.

on(Events.PROPOSAL_ACCEPTED, async (p) => {
	// p: { to, customerName, number, businessName }  (to = operator's WhatsApp)
	if (!p.to) return { skipped: true, reason: 'no_recipient' };
	return NotificationService.send({
		channel: Channel.WHATSAPP,
		type: 'text',
		to: p.to,
		text: `✅ ${p.customerName || 'A customer'} accepted ${p.number || 'a proposal'}. ${p.businessName || 'Your team'} can follow up now.`
	});
});

on(Events.PAYMENT_RECEIVED, async (p) => {
	// p: { to, amount, currency, reference }
	if (!p.to) return { skipped: true, reason: 'no_recipient' };
	return NotificationService.send({
		channel: Channel.WHATSAPP,
		type: 'text',
		to: p.to,
		text: `💰 Payment received${p.amount ? `: ${p.currency || ''} ${p.amount}` : ''}${p.reference ? ` (ref ${p.reference})` : ''}.`
	});
});

on(Events.CUSTOMER_FOLLOWUP, async (p) => {
	// p: { to, text }  — a ready-made follow-up nudge (e.g. from proposal-ai.followupMessage)
	if (!p.to || !p.text) return { skipped: true, reason: 'incomplete' };
	return NotificationService.send({ channel: Channel.WHATSAPP, type: 'text', to: p.to, text: p.text });
});
