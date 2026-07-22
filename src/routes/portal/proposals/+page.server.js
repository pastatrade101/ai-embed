import { redirect, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { listProposals, createProposal, updateProposal, deleteProposal } from '$lib/server/proposals.js';
import { generateProposalDraft } from '$lib/server/proposal-ai.js';
import { getProposalSettings } from '$lib/server/proposal-settings.js';
import { scoreLead, leadTier } from '$lib/server/dashboard.js';
import { proposalConfig } from '$lib/industries.js';

// Recent conversations/leads for the "start from a conversation" picker.
async function pickerLeads(clientId) {
	const { data } = await supabase
		.from('leads')
		.select('id, name, email, whatsapp, interest, details, transcript, created_at')
		.eq('client_id', clientId)
		.order('created_at', { ascending: false })
		.limit(50);
	return (data ?? []).map((l) => {
		const score = scoreLead(l);
		const tier = leadTier(score);
		return {
			id: l.id,
			name: l.name || 'Unnamed customer',
			interest: l.interest || '',
			score,
			tier: tier.label,
			cls: tier.cls,
			msgs: Array.isArray(l.transcript) ? l.transcript.length : 0,
			hasDetails: !!(l.details && Object.keys(l.details).length),
			createdAt: l.created_at
		};
	});
}

export async function load({ locals, parent }) {
	// Lead-free industries (e.g. government) don't do sales proposals — the nav is
	// hidden; send a direct visit back to the overview.
	const { leadsEnabled } = await parent();
	if (leadsEnabled === false) throw redirect(303, '/portal');
	const clientId = locals.user.client_id;
	const { proposals, tableMissing } = await listProposals(clientId);
	const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
	const leads = tableMissing ? [] : await pickerLeads(clientId);
	const settings = getProposalSettings(client);
	return { proposals, tableMissing: !!tableMissing, leads, docLabel: proposalConfig(client).docLabel, defaultMode: settings.defaultMode };
}

export const actions = {
	// Create a proposal in one of three modes: from a conversation, from a CRM
	// record (both prefill from a lead; conversation/crm also auto-draft with AI so
	// it never starts empty), or blank. Then open its editor.
	create: async ({ locals, request }) => {
		const clientId = locals.user.client_id;
		const form = await request.formData();
		const mode = String(form.get('mode') ?? 'blank');
		const leadId = String(form.get('lead_id') ?? '') || null;
		const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
		const cfg = proposalConfig(client);
		const settings = getProposalSettings(client);
		let seed = { currency: client?.default_currency || 'USD', doc_type: cfg.defaultDocType, terms: cfg.defaultTerms };
		if (settings.defaultExpiryDays > 0) seed.valid_until = new Date(Date.now() + settings.defaultExpiryDays * 86400000).toISOString().slice(0, 10);
		let lead = null;
		if (leadId && mode !== 'blank') {
			const { data } = await supabase.from('leads').select('*').eq('id', leadId).eq('client_id', clientId).maybeSingle();
			lead = data || null;
			if (lead)
				seed = {
					...seed,
					lead_id: lead.id,
					customer_name: lead.name || null,
					customer_email: lead.email || null,
					customer_phone: lead.whatsapp || null,
					title: lead.interest ? `${cfg.docLabel} — ${String(lead.interest).slice(0, 60)}` : null,
					meta: { creationMode: mode }
				};
		}
		const { proposal, error, tableMissing } = await createProposal(clientId, seed);
		if (tableMissing) return fail(400, { error: 'Proposals need a quick database update (run db/018) before you can use them.' });
		if (error || !proposal) return fail(400, { error: error?.message || 'Could not create the proposal.' });

		// AI Sales Memory: for conversation/CRM modes, draft immediately from what
		// the AI already knows. Non-fatal — on quota/error the operator still lands
		// on a prefilled editor and can draft manually.
		if (lead && (mode === 'conversation' || mode === 'crm')) {
			try {
				const res = await generateProposalDraft({ client, planKey: client.plan, lead });
				if (res?.data) {
					const d = res.data;
					await updateProposal(clientId, proposal.id, {
						title: d.title || proposal.title,
						intro: d.intro || null,
						summary: d.summary || null,
						terms: d.terms || proposal.terms,
						line_items: Array.isArray(d.line_items) ? d.line_items : [],
						meta: { ...(proposal.meta || {}), creationMode: mode, aiUpsell: d.upsell || [], aiCrossSell: d.cross_sell || [], aiCta: d.cta || null, aiThankYou: d.thank_you || null }
					});
				}
			} catch {
				/* non-fatal — land on the seeded editor */
			}
		}
		throw redirect(303, `/portal/proposals/${proposal.id}`);
	},
	delete: async ({ locals, request }) => {
		const form = await request.formData();
		await deleteProposal(locals.user.client_id, String(form.get('id') ?? ''));
		return { ok: true };
	}
};
