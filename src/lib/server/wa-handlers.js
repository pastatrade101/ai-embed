// Wires the WhatsApp webhook to the Proposal Conversation engine. Registered once at
// server start (from hooks.server.js) so inbound messages/statuses fan out to the
// right services. This is the CRM/AI seam the webhook module left open.
import { on } from './whatsapp/webhook.js';
import { handleInboundMessage } from './proposal-conversation.js';
import { log } from './whatsapp/logger.js';
import * as convo from './wa-conversations.js';
import { getClientById } from './tenant.js';
import { isModuleEnabled } from './modules.js';
import { resolveTenantByPhoneNumberId } from './whatsapp/credentials.js';
import { draftOrderFromMessage } from './order-extraction.js';

const msgText = (ev) => ev.text || ev.interactive?.button_reply?.title || ev.interactive?.list_reply?.title || null;

// Cheap pre-filter so we don't spend an AI call on greetings/questions — the
// extractor still makes the final is_order decision.
const ORDERISH = /\b(order|buy|need|want|deliver|delivery|pcs|pieces?|bags?|boxes?|cartons?|kg|litres?|liters?|units?|qty|quantity|purchase|restock)\b/i;
const looksLikeOrder = (t) => /\d/.test(t) || ORDERISH.test(t);

let registered = false;

export function registerWhatsAppHandlers() {
	if (registered) return;
	registered = true;

	// Inbound customer message → the AI proposal assistant.
	on('message', async (ev) => {
		const text = msgText(ev);
		if (!text) return; // ignore media-only / unsupported for now
		try {
			const res = await handleInboundMessage({ phoneNumberId: ev.phoneNumberId, from: ev.from, text });
			log.info('assistant_handled', { from: ev.from, ...res });
		} catch (err) {
			log.error('inbound_handler_failed', { error: err?.message });
		}
	});

	// Inbound customer message → AI Order Extraction (Orders module). SILENT: it only
	// drops a draft order into the operator's board — it never replies, so it can't
	// double-message the customer or interfere with the proposal assistant above. Only
	// runs on a tenant's OWN connected number (which unambiguously identifies the
	// tenant); on the shared platform number we can't attribute the order, so we skip.
	on('message', async (ev) => {
		const text = msgText(ev);
		if (!text || !looksLikeOrder(text)) return;
		try {
			const tenant = await resolveTenantByPhoneNumberId(ev.phoneNumberId);
			if (!tenant?.clientId) return;
			const client = await getClientById(tenant.clientId);
			if (!client || !isModuleEnabled(client, 'orders')) return;
			const { order, skipped } = await draftOrderFromMessage({ client, message: text, from: ev.from, source: 'whatsapp' });
			if (order) log.info('order_autodrafted', { client: client.id, number: order.number, confidence: order.confidence });
			else log.info('order_autodraft_skipped', { reason: skipped });
		} catch (err) {
			log.error('order_autodraft_failed', { error: err?.message });
		}
	});

	// Delivery / read receipts → CRM timeline (best-effort).
	on('status', async (ev) => {
		if (ev.status !== 'delivered' && ev.status !== 'read') return;
		try {
			const { conversation } = await convo.getByPhone(ev.recipient || '', ev.phoneNumberId);
			if (conversation) await convo.addTimeline(conversation, ev.status, { messageId: ev.messageId });
		} catch {
			/* non-fatal */
		}
	});

	log.info('assistant_handlers_registered', {});
}
