import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { getProposal, updateProposal, proposalTimeline, markSent, setStatus } from '$lib/server/proposals.js';
import { generateProposalDraft } from '$lib/server/proposal-ai.js';
import { sendEmail, brandedEmail, escapeHtml } from '$lib/server/email.js';
import { proposalConfig } from '$lib/industries.js';

async function loadClient(id) {
	const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
	return data ?? null;
}

export async function load({ params, locals, url }) {
	const clientId = locals.user.client_id;
	const { proposal, tableMissing } = await getProposal(clientId, params.id);
	if (tableMissing) throw error(503, 'Proposals need a database update (run db/018).');
	if (!proposal) throw error(404, 'Proposal not found.');
	const client = await loadClient(clientId);
	const cfg = proposalConfig(client);
	const events = await proposalTimeline(proposal.id, clientId);
	return {
		proposal,
		events,
		docTypes: cfg.docTypes,
		hostedUrl: `${url.origin}/p/${proposal.public_token}`,
		operatorEmail: client?.contact_email || null,
		customerHasEmail: !!proposal.customer_email
	};
}

// Parse the editable fields (line items arrive as a JSON string).
function readFields(form) {
	let lineItems = [];
	try {
		lineItems = JSON.parse(String(form.get('line_items') ?? '[]'));
	} catch {
		lineItems = [];
	}
	return {
		title: String(form.get('title') ?? '').trim() || null,
		doc_type: String(form.get('doc_type') ?? 'quotation'),
		customer_name: String(form.get('customer_name') ?? '').trim() || null,
		customer_email: String(form.get('customer_email') ?? '').trim() || null,
		customer_phone: String(form.get('customer_phone') ?? '').trim() || null,
		currency: String(form.get('currency') ?? 'USD').trim() || 'USD',
		intro: String(form.get('intro') ?? '').trim() || null,
		summary: String(form.get('summary') ?? '').trim() || null,
		terms: String(form.get('terms') ?? '').trim() || null,
		notes: String(form.get('notes') ?? '').trim() || null,
		valid_until: String(form.get('valid_until') ?? '').trim() || null,
		line_items: Array.isArray(lineItems) ? lineItems : [],
		discount: Number(form.get('discount') ?? 0) || 0,
		tax: Number(form.get('tax') ?? 0) || 0
	};
}

export const actions = {
	save: async ({ params, locals, request }) => {
		const { proposal } = await updateProposal(locals.user.client_id, params.id, readFields(await request.formData()));
		if (!proposal) return fail(400, { section: 'save', error: 'Could not save.' });
		return { section: 'save', ok: 'Saved.', proposal };
	},

	// AI draft — merges into the current proposal (operator edits after).
	generate: async ({ params, locals, request }) => {
		const clientId = locals.user.client_id;
		const client = await loadClient(clientId);
		const { proposal } = await getProposal(clientId, params.id);
		if (!proposal) return fail(404, { section: 'ai', error: 'Proposal not found.' });
		const extra = String((await request.formData()).get('instructions') ?? '').trim();
		let lead = null;
		if (proposal.lead_id) {
			const { data } = await supabase.from('leads').select('*').eq('id', proposal.lead_id).eq('client_id', clientId).maybeSingle();
			lead = data || null;
		}
		const res = await generateProposalDraft({ client, planKey: client.plan, lead, extra });
		if (res.error === 'quota') return fail(403, { section: 'ai', error: 'You’ve used your AI proposal drafts for this month — write it by hand or upgrade for more.' });
		if (res.error || !res.data) return fail(502, { section: 'ai', error: 'The AI draft failed — please try again.' });
		const d = res.data;
		const meta = { ...(proposal.meta || {}), aiUpsell: d.upsell || [], aiCrossSell: d.cross_sell || [], aiCta: d.cta || null, aiThankYou: d.thank_you || null };
		const { proposal: updated } = await updateProposal(clientId, params.id, {
			title: d.title || proposal.title,
			intro: d.intro || null,
			summary: d.summary || null,
			terms: d.terms || proposal.terms,
			line_items: Array.isArray(d.line_items) ? d.line_items : [],
			discount: proposal.discount,
			tax: proposal.tax,
			meta
		});
		return { section: 'ai', ok: 'Draft generated — review and edit below.', proposal: updated, aiGenerated: true };
	},

	// Send the branded proposal email (reply-to the operator, not Makutano).
	sendEmail: async ({ params, locals, request, url }) => {
		const clientId = locals.user.client_id;
		const client = await loadClient(clientId);
		const { proposal } = await getProposal(clientId, params.id);
		if (!proposal) return fail(404, { section: 'send', error: 'Proposal not found.' });
		if (!proposal.customer_email) return fail(400, { section: 'send', error: 'Add the customer’s email first, then save.' });
		const cfg = proposalConfig(client);
		const docLabel = (cfg.docTypes.find((d) => d.key === proposal.doc_type) || {}).label || cfg.docLabel;
		const hosted = `${url.origin}/p/${proposal.public_token}`;
		let money;
		try {
			money = new Intl.NumberFormat('en-US', { style: 'currency', currency: (proposal.currency || 'USD').slice(0, 3).toUpperCase(), maximumFractionDigits: 0 }).format(Number(proposal.total) || 0);
		} catch {
			money = `${proposal.currency || 'USD'} ${Math.round(Number(proposal.total) || 0)}`;
		}
		const res = await sendEmail({
			to: proposal.customer_email,
			replyTo: client.contact_email || undefined,
			subject: `${docLabel} ${proposal.number} from ${client.name}`,
			text: `${proposal.customer_name ? 'Hi ' + proposal.customer_name + ',' : 'Hello,'}\n\nYour ${docLabel.toLowerCase()} from ${client.name} is ready${proposal.total ? ` (total ${money})` : ''}.\n\nView it here: ${hosted}\n\n— ${client.name}`,
			html: brandedEmail({
				preheader: `Your ${docLabel.toLowerCase()} from ${client.name} is ready to view.`,
				heading: `Your ${docLabel.toLowerCase()} is ready`,
				body: [
					`${proposal.customer_name ? 'Hi ' + escapeHtml(proposal.customer_name) + ',' : 'Hello,'}`,
					`${escapeHtml(client.name)} has prepared a ${escapeHtml(docLabel.toLowerCase())} for you${proposal.total ? ` — <strong>${money}</strong>` : ''}. Open it to see the details${proposal.valid_until ? ', and accept it while it’s valid' : ''}.`
				],
				button: { label: `View ${docLabel.toLowerCase()}`, url: hosted },
				footer: `Reply to this email to reach ${escapeHtml(client.name)} directly.`
			})
		});
		await markSent(clientId, params.id, 'email');
		if (res.ok) return { section: 'send', ok: `Sent to ${proposal.customer_email}.` };
		// Email skipped/failed (Resend unconfigured) — the hosted link still works.
		return { section: 'send', ok: `Marked as sent. Share the link directly: ${hosted}`, emailFailed: true };
	},

	// Record that the operator sent it via another channel (WhatsApp / copied link).
	markSent: async ({ params, locals, request }) => {
		const channel = String((await request.formData()).get('channel') ?? 'link');
		await markSent(locals.user.client_id, params.id, channel);
		return { section: 'send', ok: 'Marked as sent.' };
	},

	setStatus: async ({ params, locals, request }) => {
		const status = String((await request.formData()).get('status') ?? '');
		if (!['accepted', 'declined', 'converted', 'sent'].includes(status)) return fail(400, { section: 'status', error: 'Invalid status.' });
		const { ok, error } = await setStatus(locals.user.client_id, params.id, status);
		if (!ok) return fail(400, { section: 'status', error: error?.message || 'Could not update.' });
		return { section: 'status', ok: 'Updated.' };
	}
};
