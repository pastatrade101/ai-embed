// ProposalConversationService — the orchestrator. Turns an inbound WhatsApp message
// into: a grounded answer, a negotiated + versioned modification, or a human
// escalation. Controllers/handlers only call handleInboundMessage()/startProposal
// Conversation(); all the reasoning lives here. Nothing calls WhatsApp directly —
// replies go through NotificationService.
import { env } from '$env/dynamic/private';
import { supabase } from './supabase.js';
import { askJSON, AI, SONNET } from './ai.js';
import { NotificationService, Channel } from './notifications.js';
import { serverIndustry } from './industries.js';
import { getProposalSettings } from './proposal-settings.js';
import { getProposal, markSent } from './proposals.js';
import { buildProposalContext } from './proposal-context.js';
import { applyModification } from './proposal-versions.js';
import { defaultCredentials } from './whatsapp/config.js';
import { log } from './whatsapp/logger.js';
import * as convo from './wa-conversations.js';

// Sensitive topics the AI must NOT handle — hand to a human instead of hallucinating.
const ESCALATION_RE = /\b(lawyer|legal|lawsuit|sue|contract terms|refund|charge ?back|dispute|complain|complaint|scam|fraud|cancel (my|the) (order|contract))\b/i;

const DECISION_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['reply', 'intent', 'escalate', 'escalate_reason', 'modification'],
	properties: {
		reply: { type: 'string', description: 'The WhatsApp message to send back — short, natural, grounded in the proposal.' },
		intent: { type: 'string', enum: ['question', 'negotiate', 'modify', 'accept', 'smalltalk', 'escalate', 'other'] },
		escalate: { type: 'boolean', description: 'true if this needs a human (legal, refund, complaint, discount above policy, anything you are unsure of).' },
		escalate_reason: { type: ['string', 'null'] },
		modification: {
			type: 'object',
			additionalProperties: false,
			required: ['action', 'remove_items', 'add_items', 'discount_percent', 'summary'],
			properties: {
				action: { type: 'string', enum: ['none', 'propose', 'apply'], description: 'propose = describe the change and ask to confirm; apply = the customer clearly confirmed, change it now.' },
				remove_items: { type: 'array', items: { type: 'integer' }, description: '1-based indices from the ITEMS list to remove.' },
				add_items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['description', 'qty', 'unit_price'], properties: { description: { type: 'string' }, qty: { type: 'integer' }, unit_price: { type: 'number' } } }, description: 'Only items that exist in the CATALOGUE, with the catalogue price.' },
				discount_percent: { type: ['number', 'null'], description: 'A discount to apply, within the policy limit; null if none.' },
				summary: { type: 'string' }
			}
		}
	}
};

const hostedBase = () => (env.APP_ORIGIN || env.PUBLIC_APP_URL || '').replace(/\/$/, '');
const hostedUrl = (p) => `${hostedBase()}/p/${p.public_token}`;
const fmtTotal = (p, n) => `${p.currency} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

async function loadClient(id) {
	const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
	return data ?? null;
}
async function loadLead(clientId, leadId) {
	if (!leadId) return null;
	const { data } = await supabase.from('leads').select('*').eq('id', leadId).eq('client_id', clientId).maybeSingle();
	return data ?? null;
}

// Fallback resolution: a customer messaged a number we sent a proposal to but no
// thread exists yet. Match by normalized phone across recent proposals.
async function findProposalByPhone(phone) {
	const { data } = await supabase
		.from('proposals')
		.select('id, client_id, lead_id, customer_phone')
		.not('customer_phone', 'is', null)
		.order('created_at', { ascending: false })
		.limit(200);
	return (data ?? []).find((p) => convo.normalizePhone(p.customer_phone) === phone) ?? null;
}

function systemPrompt(client, proposal, ctx, linkUrl) {
	const ind = serverIndustry(client);
	return `You are the AI sales representative for ${client.name || `a ${ind.businessType}`}, chatting with a customer on WhatsApp about their ${ctx.docLabel} ${proposal.number}. You already know the entire proposal (below) — never ask "which proposal?".

Do:
- Answer naturally and briefly (WhatsApp style). Explain items, pricing, taxes, timelines, terms, payment.
- Negotiate ONLY within the discount policy. Suggest alternatives (remove a service, a package change, installments) when you can't meet a price.
- Modify the proposal only from the real data: remove existing items by their index, or add items that exist in the CATALOGUE at the catalogue price. NEVER invent items or prices.
- Use modification.action = "propose" to describe a change and ask them to confirm; use "apply" only once they clearly confirm.
- Share the proposal link when useful: ${linkUrl}
Escalate (escalate=true) for anything legal, refunds, complaints, a discount beyond the policy, or anything you're unsure about — reply politely that a colleague will follow up, and do not guess.

${ctx.text}

Return the structured decision only.`;
}

async function sendReply(client, to, text) {
	// Single-WABA today → default credentials. credentialsFor(client) is the seam
	// for per-tenant numbers later.
	return NotificationService.send({ channel: Channel.WHATSAPP, type: 'text', to, text });
}

async function notifyOperator(client, proposal, reason, snippet) {
	const to = client.lead_email || client.contact_email;
	log.warn('wa_escalation', { client: client.name, proposal: proposal.number, reason });
	if (!to) return;
	await NotificationService.send({
		channel: Channel.EMAIL,
		to,
		subject: `WhatsApp needs you — ${proposal.number}`,
		text: `A WhatsApp conversation about ${proposal.number} needs a human.\nReason: ${reason}\nCustomer said: "${snippet || ''}"\n\nOpen Admin ▸ WhatsApp to take over.`
	});
}

// Validate a proposed modification server-side before it can touch money:
//  - remove_items: kept (only existing items can be removed, by index).
//  - discount_percent: kept (applyModification clamps it to the policy).
//  - add_items: allowed ONLY when upsell/cross-sell + catalogue are enabled, and each
//    item MUST match a real catalogue entry — we substitute the STORED price so the AI
//    can never invent an item or a price. Non-matching adds are dropped and flagged.
async function sanitizeModification(client, settings, mod) {
	const clean = {
		remove_items: Array.isArray(mod.remove_items) ? mod.remove_items.map(Number).filter(Number.isFinite) : [],
		add_items: [],
		discount_percent: mod.discount_percent ?? null,
		summary: mod.summary
	};
	const addsRequested = Array.isArray(mod.add_items) ? mod.add_items.length : 0;
	const addsAllowed = (settings.enableUpsell || settings.enableCrossSell) && settings.sources?.catalogue;
	if (addsAllowed && addsRequested) {
		const { data } = await supabase.from('knowledge_items').select('title, price_amount').eq('client_id', client.id).limit(300);
		const priced = (data || []).filter((i) => i.price_amount != null && i.price_amount !== '');
		for (const a of mod.add_items) {
			const name = String(a.description || '').toLowerCase().trim();
			if (!name) continue;
			const m = priced.find((i) => {
				const t = String(i.title || '').toLowerCase();
				return t === name || t.includes(name) || name.includes(t);
			});
			if (m) clean.add_items.push({ description: m.title, qty: Math.max(1, Number(a.qty) || 1), unit_price: Math.max(0, Number(m.price_amount) || 0) });
		}
	}
	clean.droppedAdds = addsRequested - clean.add_items.length;
	return clean;
}

/**
 * Handle one inbound customer message end-to-end.
 * @returns {Promise<object>} a small status object (for logs/tests).
 */
export async function handleInboundMessage({ phoneNumberId, from, text }) {
	const phone = convo.normalizePhone(from);
	if (!phone || !text) return { ok: false, reason: 'empty' };

	// 1. Resolve the thread (or start one from a matching proposal).
	let { conversation, tableMissing } = await convo.getByPhone(phone);
	if (tableMissing) { log.warn('wa_assistant_needs_migration', {}); return { ok: false, reason: 'migration_020_needed' }; }
	if (!conversation) {
		const found = await findProposalByPhone(phone);
		if (!found) { log.info('wa_no_proposal_for_number', { from: phone }); return { ok: false, reason: 'no_proposal' }; }
		const created = await convo.createConversation({ clientId: found.client_id, proposalId: found.id, leadId: found.lead_id, customerPhone: phone, phoneNumberId });
		conversation = created.conversation;
		if (!conversation) return { ok: false, reason: 'create_failed' };
		conversation = (await convo.addTimeline(conversation, 'conversation_started', {})) || conversation;
	}

	// 2. Load context.
	const client = await loadClient(conversation.client_id);
	const { proposal } = conversation.proposal_id ? await getProposal(conversation.client_id, conversation.proposal_id) : { proposal: null };
	if (!client || !proposal) { log.warn('wa_missing_context', { convId: conversation.id }); return { ok: false, reason: 'missing_context' }; }
	const lead = await loadLead(conversation.client_id, proposal.lead_id);

	// 3. Record the customer message (this opens the 24h free-text window).
	conversation = await convo.appendMessage(conversation, { role: 'customer', text });
	conversation = (await convo.addTimeline(conversation, 'customer_replied', {})) || conversation;

	// 4. Human in control → store only, no AI reply.
	if (conversation.ai_enabled === false || ['escalated', 'paused', 'closed'].includes(conversation.status)) {
		log.info('wa_ai_paused', { convId: conversation.id, status: conversation.status });
		return { ok: true, skipped: 'ai_paused' };
	}

	const settings = getProposalSettings(client);

	// 5. Hard escalation pre-check (before spending an AI call).
	if (ESCALATION_RE.test(text)) {
		conversation = (await convo.escalate(conversation, 'sensitive_topic')) || conversation;
		await notifyOperator(client, proposal, 'sensitive_topic', text);
		const holding = `Thanks for that — let me bring in a colleague from ${client.name} to help you properly. They'll follow up here shortly.`;
		await sendReply(client, phone, holding);
		await convo.appendMessage(conversation, { role: 'ai', text: holding, kind: 'escalation' });
		return { ok: true, escalated: true };
	}

	// 6. The negotiation AI (metered, grounded, structured decision).
	const ctx = await buildProposalContext({ client, proposal, lead, conversation });
	const res = await askJSON({
		clientId: client.id,
		planKey: client.plan,
		feature: AI.PROPOSAL,
		model: SONNET,
		schema: DECISION_SCHEMA,
		maxTokens: 900,
		system: systemPrompt(client, proposal, ctx, hostedUrl(proposal)),
		messages: [{ role: 'user', content: `Latest customer message:\n${text}` }]
	});
	if (res.error || !res.data) {
		log.warn('wa_ai_failed', { error: res.error, convId: conversation.id });
		return { ok: false, reason: res.error || 'ai_failed' };
	}
	const decision = res.data;

	// 7. AI-requested escalation.
	if (decision.escalate) {
		conversation = (await convo.escalate(conversation, decision.escalate_reason || 'ai_escalated')) || conversation;
		await notifyOperator(client, proposal, decision.escalate_reason || 'ai_escalated', text);
	}

	// 8. Apply a modification the customer confirmed (validated, versioned, policy-clamped).
	let replyText = decision.reply;
	const mod = decision.modification;
	if (!decision.escalate && settings.allowNegotiation && mod && mod.action === 'apply') {
		const clean = await sanitizeModification(client, settings, mod);
		const hasChange = clean.remove_items.length || clean.add_items.length || clean.discount_percent != null;
		if (hasChange) {
			const maxPct = settings.enableDiscounts ? settings.maxDiscountPercent ?? 10 : 0;
			const applied = await applyModification(client.id, proposal, clean, { by: 'ai', reason: 'whatsapp negotiation', maxDiscountPercent: maxPct });
			if (applied.proposal) {
				conversation = (await convo.addTimeline(conversation, 'proposal_modified', { version: applied.version, summary: applied.summary, newTotal: applied.newTotal })) || conversation;
				const note = clean.droppedAdds > 0 ? `\n(One or more requested additions need our team to confirm — I've flagged them.)` : '';
				replyText = `${decision.reply}\n\nDone — updated total is ${fmtTotal(applied.proposal, applied.newTotal)} (v${applied.version}). Here's your updated ${ctx.docLabel.toLowerCase()}:\n${hostedUrl(applied.proposal)}${note}`;
			} else {
				// Write failed — DO NOT send the AI's optimistic confirmation. Escalate + a safe reply.
				log.warn('wa_modify_failed', { convId: conversation.id, error: applied.error?.message });
				conversation = (await convo.escalate(conversation, 'modify_failed')) || conversation;
				await notifyOperator(client, proposal, `modify_failed: ${applied.error?.message || ''}`, text);
				replyText = `Sorry — I couldn't update the ${ctx.docLabel.toLowerCase()} just now. A colleague from ${client.name} will sort this out and follow up shortly.`;
			}
		} else if (clean.droppedAdds > 0) {
			// Customer wanted to add something not in the catalogue — don't fabricate it.
			replyText = `${decision.reply}\n\nI'll confirm that addition with our team and get back to you shortly.`;
		}
	}

	// 9. Send the reply (window is open from the inbound message) + remember it.
	const sent = await sendReply(client, phone, replyText);
	conversation = await convo.appendMessage(conversation, { role: 'ai', text: replyText, kind: decision.intent, meta: mod?.action !== 'none' ? { modification: mod } : {} });
	conversation = (await convo.addTimeline(conversation, 'ai_responded', { intent: decision.intent })) || conversation;
	return { ok: sent.ok, intent: decision.intent, escalated: decision.escalate };
}

/**
 * Kick off a proposal conversation: open the thread and send the approved template
 * (a new thread has no free-text window, so it must be a template). The link + full
 * answers flow once the customer replies.
 */
export async function startProposalConversation({ client, proposal, to, templateName = 'hello_world', templateLanguage = 'en_US' }) {
	const phone = convo.normalizePhone(to || proposal.customer_phone);
	if (!phone) return { ok: false, reason: 'no_phone' };

	const existing = await convo.getForProposal(proposal.id, phone);
	if (existing.tableMissing) return { ok: false, reason: 'migration_020_needed' };

	// Send the opening template first — a brand-new thread has no free-text window.
	const sent = await NotificationService.send({ channel: Channel.WHATSAPP, type: 'template', to: phone, name: templateName, language: templateLanguage });

	// Only persist a thread when the template actually went out (no orphan threads),
	// or reuse one that already exists.
	let conversation = existing.conversation;
	if (!conversation) {
		if (!sent.ok) return { ok: false, reason: 'send_failed', sent };
		const created = await convo.createConversation({ clientId: client.id, proposalId: proposal.id, leadId: proposal.lead_id, customerPhone: phone, phoneNumberId: defaultCredentials().phoneNumberId });
		conversation = created.conversation;
		if (!conversation) return { ok: false, reason: created.tableMissing ? 'migration_020_needed' : 'create_failed', sent };
	}

	conversation = (await convo.addTimeline(conversation, 'template_sent', { template: templateName, ok: sent.ok, messageId: sent.messageId })) || conversation;
	await convo.appendMessage(conversation, { role: 'system', text: `Opening template "${templateName}" sent`, kind: 'template', meta: { messageId: sent.messageId, ok: sent.ok } });
	if (sent.ok) {
		try { await markSent(client.id, proposal.id, 'whatsapp'); } catch { /* non-fatal */ }
	}
	return { ok: sent.ok, conversation, sent };
}
