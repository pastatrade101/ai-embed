// Wires the WhatsApp webhook to the Proposal Conversation engine. Registered once at
// server start (from hooks.server.js) so inbound messages/statuses fan out to the
// right services. This is the CRM/AI seam the webhook module left open.
import { on } from './whatsapp/webhook.js';
import { handleInboundMessage } from './proposal-conversation.js';
import { log } from './whatsapp/logger.js';
import * as convo from './wa-conversations.js';

let registered = false;

export function registerWhatsAppHandlers() {
	if (registered) return;
	registered = true;

	// Inbound customer message → the AI proposal assistant.
	on('message', async (ev) => {
		const text = ev.text || ev.interactive?.button_reply?.title || ev.interactive?.list_reply?.title || null;
		if (!text) return; // ignore media-only / unsupported for now
		try {
			const res = await handleInboundMessage({ phoneNumberId: ev.phoneNumberId, from: ev.from, text });
			log.info('assistant_handled', { from: ev.from, ...res });
		} catch (err) {
			log.error('inbound_handler_failed', { error: err?.message });
		}
	});

	// Delivery / read receipts → CRM timeline (best-effort).
	on('status', async (ev) => {
		if (ev.status !== 'delivered' && ev.status !== 'read') return;
		try {
			const { conversation } = await convo.getByPhone(ev.recipient || '');
			if (conversation) await convo.addTimeline(conversation, ev.status, { messageId: ev.messageId });
		} catch {
			/* non-fatal */
		}
	});

	log.info('assistant_handlers_registered', {});
}
