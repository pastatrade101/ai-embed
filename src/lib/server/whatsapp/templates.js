// Message templates — the reusable content layer. Two kinds live here:
//  1) META_TEMPLATES: names of pre-approved Meta message templates (needed to open a
//     conversation outside the 24h window). Keep them here so template names aren't
//     scattered as string literals across the codebase.
//  2) build*(): helpers that turn business data into a NotificationService payload,
//     so event handlers never hand-assemble WhatsApp JSON.
//
// These are content only — sending goes through NotificationService.

/** Pre-approved Meta template names (register these in the WhatsApp Manager). */
export const META_TEMPLATES = {
	PROPOSAL_READY: 'proposal_ready',
	PAYMENT_RECEIVED: 'payment_received',
	APPOINTMENT_REMINDER: 'appointment_reminder'
};

/** A branded quotation/proposal-ready message with the hosted link. */
export function buildProposalReady({ to, businessName, docLabel = 'quotation', number, total, currency, url }) {
	const money = total ? ` (${currency || ''} ${total})`.trimEnd() : '';
	return {
		channel: 'whatsapp',
		type: 'text',
		to,
		text: `Your ${docLabel.toLowerCase()} ${number} from ${businessName} is ready${money}.\n\nView & accept it here:\n${url}`,
		previewUrl: true
	};
}

/** Attach the quotation PDF (used once PDF generation is wired). */
export function buildProposalPdf({ to, filename, link, caption }) {
	return { channel: 'whatsapp', type: 'pdf', to, link, filename, caption };
}

/** A short accepted-confirmation to the operator/customer. */
export function buildProposalAccepted({ to, customerName, number, businessName }) {
	return {
		channel: 'whatsapp',
		type: 'text',
		to,
		text: `✅ ${customerName || 'A customer'} accepted ${number}. ${businessName} will follow up shortly.`
	};
}

/** Accept/decline reply buttons (interactive). */
export function buildDecisionButtons({ to, businessName, number, docLabel = 'quotation' }) {
	return {
		channel: 'whatsapp',
		type: 'interactive',
		to,
		body: `Your ${docLabel.toLowerCase()} ${number} from ${businessName} is ready. Would you like to proceed?`,
		buttons: [
			{ id: `accept_${number}`, title: 'Accept' },
			{ id: `question_${number}`, title: 'I have a question' }
		]
	};
}
