// Public hosted proposal page — /p/<token>. No auth; the token is the secret.
// Shows the branded document, records a view, and lets the customer accept or
// decline. Mobile-friendly. Fails cleanly if migration 018 hasn't run.
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { getProposalByToken, recordView, respondByToken } from '$lib/server/proposals.js';
import { proposalConfig } from '$lib/industries.js';

async function brandingFor(clientId) {
	const { data } = await supabase
		.from('clients')
		.select('name, logo_url, brand_color, whatsapp_number, contact_email, phone, industry, is_active')
		.eq('id', clientId)
		.maybeSingle();
	return data ?? null;
}

const isExpired = (p) => p.valid_until && !['accepted', 'declined'].includes(p.status) && new Date(p.valid_until) < new Date(new Date().toDateString());
// Link-unfurl / crawler user-agents — their GETs must not count as customer views.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|twitter|preview|scan|monitor|curl|wget|python-requests|headless|embed|fetch/i;

export async function load({ params, url, request }) {
	const { proposal, tableMissing } = await getProposalByToken(params.token);
	if (tableMissing || !proposal) throw error(404, 'This proposal is not available.');

	const client = await brandingFor(proposal.client_id);
	if (!client || client.is_active === false) throw error(404, 'This proposal is not available.');

	const cfg = proposalConfig(client);
	// Count a view only for a genuine human open — not the operator's preview,
	// link-unfurl bots, or a reload after the customer already accepted/declined.
	const ua = request.headers.get('user-agent') || '';
	const terminal = ['accepted', 'declined', 'converted'].includes(proposal.status);
	if (url.searchParams.get('preview') !== '1' && !terminal && !BOT.test(ua)) {
		await recordView(proposal, { ref: url.searchParams.get('ref') || null });
	}

	const brand = client.brand_color || '#0f6e56';
	// Curated, customer-safe intelligence from meta (NO confidence/source/notes leak).
	const meta = proposal.meta || {};
	const req = meta.requirements || {};
	const customerSummary = Array.isArray(req.summary)
		? req.summary.filter((f) => f && f.label && f.value).slice(0, 6).map((f) => ({ label: String(f.label), value: String(f.value) }))
		: [];
	const addOns = [...(Array.isArray(meta.aiUpsell) ? meta.aiUpsell : []), ...(Array.isArray(meta.aiCrossSell) ? meta.aiCrossSell : [])]
		.map((x) => String(x || '').trim())
		.filter(Boolean)
		.slice(0, 5);
	const matchScore = typeof req.confidence === 'number' ? req.confidence : null;
	const aiGenerated = !!(meta.creationMode || meta.aiCta || addOns.length || customerSummary.length);
	return {
		smart: {
			aiGenerated,
			customerSummary,
			addOns,
			// Only surface a match score to the customer when it's genuinely strong.
			matchScore: matchScore != null && matchScore >= 70 ? matchScore : null,
			cta: typeof meta.aiCta === 'string' ? meta.aiCta : null,
			thankYou: typeof meta.aiThankYou === 'string' ? meta.aiThankYou : null
		},
		proposal: {
			id: proposal.id,
			number: proposal.number,
			docType: proposal.doc_type,
			docLabel: (cfg.docTypes.find((d) => d.key === proposal.doc_type) || {}).label || cfg.docLabel,
			status: isExpired(proposal) ? 'expired' : proposal.status,
			title: proposal.title,
			customerName: proposal.customer_name,
			currency: proposal.currency,
			intro: proposal.intro,
			summary: proposal.summary,
			terms: proposal.terms,
			lineItems: Array.isArray(proposal.line_items) ? proposal.line_items : [],
			subtotal: proposal.subtotal,
			discount: proposal.discount,
			tax: proposal.tax,
			total: proposal.total,
			validUntil: proposal.valid_until,
			createdAt: proposal.created_at,
			token: proposal.public_token
		},
		business: {
			name: client.name,
			logo: client.logo_url || null,
			brand,
			whatsapp: client.whatsapp_number || null,
			email: client.contact_email || null,
			phone: client.phone || null
		},
		origin: url.origin
	};
}

export const actions = {
	respond: async ({ params, request }) => {
		const form = await request.formData();
		const decision = String(form.get('decision') ?? '');
		if (!['accept', 'decline'].includes(decision)) return { ok: false, error: 'Invalid choice.' };
		const res = await respondByToken(params.token, decision);
		if (res.expired) return { ok: false, error: 'This proposal has expired — please contact the business for an updated one.' };
		if (!res.ok) return { ok: false, error: 'Could not record your response.' };
		return { ok: true, decision, already: res.already ?? false };
	}
};
