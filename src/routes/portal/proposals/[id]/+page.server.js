import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { getProposal, updateProposal, proposalTimeline, markSent, setStatus } from '$lib/server/proposals.js';
import { generateProposalDraft, assistField, revenueIdeas, followupMessage, extractRequirements, syncFromConversation } from '$lib/server/proposal-ai.js';
import { scoreLead, leadTier, leadStage, extractLead } from '$lib/server/dashboard.js';
import { sendEmail, brandedEmail, escapeHtml } from '$lib/server/email.js';
import { getProposalSettings } from '$lib/server/proposal-settings.js';
import { proposalConfig } from '$lib/industries.js';

async function loadClient(id) {
	const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
	return data ?? null;
}

async function loadLead(clientId, leadId) {
	if (!leadId) return null;
	const { data } = await supabase.from('leads').select('*').eq('id', leadId).eq('client_id', clientId).maybeSingle();
	return data ?? null;
}

// CRM intelligence for the Customer panel — derived from the linked lead.
function customerIntel(lead) {
	if (!lead) return null;
	const detail = extractLead(lead, []);
	const score = scoreLead(lead);
	const tier = leadTier(score);
	const d = lead.details || {};
	return {
		score,
		tier: tier.label,
		cls: tier.cls,
		stage: leadStage(lead, detail, score),
		intent: d.intent || null,
		budget: d.budget ?? detail.budget ?? null,
		currency: d.currency || null,
		interest: lead.interest || null,
		country: d.country || detail.country || null,
		timing: d.travel || detail.dates || detail.month || null,
		convCount: Array.isArray(lead.transcript) ? lead.transcript.length : 0,
		createdAt: lead.created_at
	};
}

export async function load({ params, locals, url }) {
	const clientId = locals.user.client_id;
	const { proposal, tableMissing } = await getProposal(clientId, params.id);
	if (tableMissing) throw error(503, 'Proposals need a database update (run db/018).');
	if (!proposal) throw error(404, 'Proposal not found.');
	const client = await loadClient(clientId);
	const cfg = proposalConfig(client);
	const events = await proposalTimeline(proposal.id, clientId);
	const lead = await loadLead(clientId, proposal.lead_id);
	return {
		proposal,
		events,
		docTypes: cfg.docTypes,
		hostedUrl: `${url.origin}/p/${proposal.public_token}`,
		operatorEmail: client?.contact_email || null,
		customerHasEmail: !!proposal.customer_email,
		customer: customerIntel(lead),
		conversation: conversationPanel(lead),
		requirements: proposal.meta?.requirements || null,
		settings: getProposalSettings(client)
	};
}

// The linked conversation, trimmed for the editor's "AI Sales Memory" panel.
function conversationPanel(lead) {
	if (!lead) return { linked: false };
	const msgs = (Array.isArray(lead.transcript) ? lead.transcript : [])
		.filter((m) => m && m.role && m.content)
		.map((m) => ({ role: m.role === 'assistant' ? 'ai' : 'customer', content: String(m.content).slice(0, 1200) }));
	return {
		linked: true,
		leadId: lead.id,
		startedAt: lead.created_at,
		count: msgs.length,
		hasDetails: !!(lead.details && Object.keys(lead.details).length),
		transcript: msgs.slice(-40)
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

	// One-click AI rewrite of a single section — returns the new text (the client
	// applies it to the field; nothing is persisted until the operator saves).
	assist: async ({ params, locals, request }) => {
		const clientId = locals.user.client_id;
		const client = await loadClient(clientId);
		const { proposal } = await getProposal(clientId, params.id);
		if (!proposal) return fail(404, { section: 'assist', error: 'Proposal not found.' });
		const form = await request.formData();
		const field = String(form.get('field') ?? '');
		const action = String(form.get('action') ?? 'improve');
		const text = String(form.get('text') ?? '');
		if (!['intro', 'summary', 'terms'].includes(field)) return fail(400, { section: 'assist', error: 'Invalid section.' });
		const res = await assistField({ client, field, action, text, proposal });
		if (res.error === 'quota') return fail(403, { section: 'assist', error: 'You’ve used your AI actions for this month — edit by hand or upgrade.' });
		if (res.error || !res.text) return fail(502, { section: 'assist', error: 'The AI edit failed — please try again.' });
		return { section: 'assist', field, text: res.text };
	},

	// AI revenue advisor — upsell/cross-sell ideas + a coaching line.
	revenue: async ({ params, locals }) => {
		const clientId = locals.user.client_id;
		const client = await loadClient(clientId);
		const { proposal } = await getProposal(clientId, params.id);
		if (!proposal) return fail(404, { section: 'revenue', error: 'Proposal not found.' });
		const lead = await loadLead(clientId, proposal.lead_id);
		const res = await revenueIdeas({ client, proposal, lead });
		if (res.error === 'quota') return fail(403, { section: 'revenue', error: 'You’ve used your AI actions for this month.' });
		if (res.error || !res.data) return fail(502, { section: 'revenue', error: 'Could not get revenue ideas — try again.' });
		return { section: 'revenue', revenue: res.data };
	},

	// AI follow-up message (email / WhatsApp) for the operator to copy & send.
	followup: async ({ params, locals, request }) => {
		const clientId = locals.user.client_id;
		const client = await loadClient(clientId);
		const { proposal } = await getProposal(clientId, params.id);
		if (!proposal) return fail(404, { section: 'followup', error: 'Proposal not found.' });
		const channel = String((await request.formData()).get('channel') ?? 'email');
		const res = await followupMessage({ client, proposal, channel });
		if (res.error === 'quota') return fail(403, { section: 'followup', error: 'You’ve used your AI actions for this month.' });
		if (res.error || !res.text) return fail(502, { section: 'followup', error: 'Could not draft the follow-up — try again.' });
		return { section: 'followup', channel, text: res.text };
	},

	// AI Sales Memory — extract structured requirements + readiness from the
	// linked conversation. Persisted into meta so it's remembered on reload.
	requirements: async ({ params, locals }) => {
		const clientId = locals.user.client_id;
		const client = await loadClient(clientId);
		const { proposal } = await getProposal(clientId, params.id);
		if (!proposal) return fail(404, { section: 'requirements', error: 'Proposal not found.' });
		const lead = await loadLead(clientId, proposal.lead_id);
		const res = await extractRequirements({ client, lead });
		if (res.error === 'quota') return fail(403, { section: 'requirements', error: 'You’ve used your AI actions for this month.' });
		if (res.error || !res.data) return fail(502, { section: 'requirements', error: 'Could not analyse the conversation — try again.' });
		// Remember it (no timeline event — this is analysis, not an edit).
		try {
			await supabase.from('proposals').update({ meta: { ...(proposal.meta || {}), requirements: res.data } }).eq('id', params.id).eq('client_id', clientId);
		} catch {
			/* non-fatal — still return it to the operator */
		}
		return { section: 'requirements', requirements: res.data };
	},

	// AI Sales Memory — detect what's out of sync with the latest conversation and
	// propose scoped section updates (preview only; the operator approves & saves).
	sync: async ({ params, locals }) => {
		const clientId = locals.user.client_id;
		const client = await loadClient(clientId);
		const { proposal } = await getProposal(clientId, params.id);
		if (!proposal) return fail(404, { section: 'sync', error: 'Proposal not found.' });
		const lead = await loadLead(clientId, proposal.lead_id);
		if (!lead) return fail(400, { section: 'sync', error: 'This proposal isn’t linked to a conversation.' });
		const res = await syncFromConversation({ client, proposal, lead });
		if (res.error === 'quota') return fail(403, { section: 'sync', error: 'You’ve used your AI actions for this month.' });
		if (res.error || !res.data) return fail(502, { section: 'sync', error: 'Could not check the conversation — try again.' });
		return { section: 'sync', sync: res.data };
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
