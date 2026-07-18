import { redirect, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { listProposals, createProposal, deleteProposal } from '$lib/server/proposals.js';
import { proposalConfig } from '$lib/industries.js';

export async function load({ locals }) {
	const { proposals, tableMissing } = await listProposals(locals.user.client_id);
	return { proposals, tableMissing: !!tableMissing };
}

export const actions = {
	// Create a blank draft, or one prefilled from a lead, then open its editor.
	create: async ({ locals, request }) => {
		const clientId = locals.user.client_id;
		const form = await request.formData();
		const leadId = String(form.get('lead_id') ?? '') || null;
		const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
		const cfg = proposalConfig(client);
		let seed = { currency: client?.default_currency || 'USD', doc_type: cfg.defaultDocType, terms: cfg.defaultTerms };
		if (leadId) {
			const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).eq('client_id', clientId).maybeSingle();
			if (lead)
				seed = {
					...seed,
					lead_id: lead.id,
					customer_name: lead.name || null,
					customer_email: lead.email || null,
					customer_phone: lead.whatsapp || null,
					title: lead.interest ? `${cfg.docLabel} — ${String(lead.interest).slice(0, 60)}` : null
				};
		}
		const { proposal, error, tableMissing } = await createProposal(clientId, seed);
		if (tableMissing) return fail(400, { error: 'Proposals need a quick database update (run db/018) before you can use them.' });
		if (error || !proposal) return fail(400, { error: error?.message || 'Could not create the proposal.' });
		throw redirect(303, `/portal/proposals/${proposal.id}`);
	},
	delete: async ({ locals, request }) => {
		const form = await request.formData();
		await deleteProposal(locals.user.client_id, String(form.get('id') ?? ''));
		return { ok: true };
	}
};
