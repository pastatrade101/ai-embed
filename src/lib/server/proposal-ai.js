// AI proposal drafting — turns a lead + the tenant's catalogue into a
// professional, editable draft (intro, recommended line items with REAL catalogue
// prices, summary, terms, CTA, plus upsell/cross-sell suggestions). Metered and
// gated via ai.js (AI.PROPOSAL). Industry-agnostic: tone + doc label come from the
// Industry Registry. The operator always edits before sending.
import { askJSON, AI, SONNET } from '$lib/server/ai.js';
import { supabase } from '$lib/server/supabase.js';
import { serverIndustry } from '$lib/server/industries.js';
import { proposalConfig } from '$lib/industries.js';

const DRAFT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['title', 'intro', 'summary', 'line_items', 'terms', 'cta', 'thank_you', 'upsell', 'cross_sell'],
	properties: {
		title: { type: 'string', description: 'Short document title, e.g. "Website & Branding Package for Acme"' },
		intro: { type: 'string', description: 'Warm, professional introduction, 2–4 sentences addressed to the customer' },
		summary: { type: 'string', description: 'The recommended solution and why it fits, 2–5 sentences' },
		line_items: {
			type: 'array',
			description: 'Recommended items chosen from the CATALOGUE only',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['description', 'detail', 'qty', 'unit_price'],
				properties: {
					description: { type: 'string', description: 'The item/service name as in the catalogue' },
					detail: { type: ['string', 'null'], description: 'A short line of what it includes' },
					qty: { type: 'integer', description: 'Quantity (default 1)' },
					unit_price: { type: 'number', description: 'Per-unit price taken EXACTLY from the catalogue; 0 if the catalogue has no price' }
				}
			}
		},
		terms: { type: 'string', description: 'Concise terms & conditions / validity note' },
		cta: { type: 'string', description: 'One-line call to action' },
		thank_you: { type: 'string', description: 'Short thank-you closing line' },
		upsell: { type: 'array', items: { type: 'string' }, description: 'Optional premium upgrades to mention (names only)' },
		cross_sell: { type: 'array', items: { type: 'string' }, description: 'Complementary items to suggest (names only)' }
	}
};

/** Compact catalogue (title · category · price · snippet) for grounding. */
async function catalogueText(clientId) {
	const { data } = await supabase
		.from('knowledge_items')
		.select('title, category, price_amount, price_currency, body')
		.eq('client_id', clientId)
		.limit(60);
	return (data ?? [])
		.map((i) => {
			const price = i.price_amount != null && i.price_amount !== '' ? `${i.price_currency || 'USD'} ${i.price_amount}` : 'price on request';
			const snip = i.body ? `: ${String(i.body).replace(/\s+/g, ' ').slice(0, 130)}` : '';
			return `- ${i.title}${i.category ? ` [${i.category}]` : ''} — ${price}${snip}`;
		})
		.join('\n');
}

/**
 * Draft a proposal. `lead` may include { name, interest, details, transcript }.
 * Returns { data, error, quota } from the metered layer.
 */
export async function generateProposalDraft({ client, planKey, lead = null, extra = '' }) {
	const ind = serverIndustry(client);
	const cfg = proposalConfig(client);
	const cat = await catalogueText(client.id);

	const who = lead
		? [
				`Customer name: ${lead.name || '—'}`,
				`Their interest: ${lead.interest || '—'}`,
				lead.details ? `Known details: ${JSON.stringify(lead.details).slice(0, 800)}` : ''
			]
				.filter(Boolean)
				.join('\n')
		: 'No specific lead — draft a general example the operator can tailor.';
	const convo =
		lead && Array.isArray(lead.transcript)
			? lead.transcript
					.filter((m) => m && m.role && m.content)
					.map((m) => `${m.role}: ${m.content}`)
					.join('\n')
					.slice(0, 3000)
			: '';

	const system = `You draft a professional ${cfg.docLabel} for ${client.name || `a ${ind.businessType}`}, a ${ind.businessType}. Write in a ${client.tone || 'warm, professional'} tone that matches the brand.

Rules:
- Recommend items ONLY from the CATALOGUE below. NEVER invent products, services or prices. Copy catalogue prices EXACTLY into unit_price; if an item has no price, set unit_price to 0 and note "price on request" in detail.
- Pick the items that best fit the customer's stated interest; a good ${cfg.docLabel} is focused, not a dump of everything.
- Be concise, benefits-led and easy to skim. No markdown, no headings — just the fields.
- upsell = optional premium upgrades; cross_sell = complementary add-ons. Use catalogue item names where possible; leave arrays empty if nothing fits.
- Return the structured object only.`;

	const user = `CATALOGUE (the only prices/items you may use):\n${cat || '(no catalogue items yet — keep line_items minimal and set prices to 0)'}\n\nCUSTOMER:\n${who}\n${convo ? `\nCONVERSATION SO FAR:\n${convo}` : ''}${extra ? `\n\nOperator instructions: ${extra}` : ''}\n\nDraft the ${cfg.docLabel} now.`;

	return askJSON({
		clientId: client.id,
		planKey: client.plan,
		feature: AI.PROPOSAL,
		model: SONNET,
		system,
		schema: DRAFT_SCHEMA,
		maxTokens: 1600,
		messages: [{ role: 'user', content: user }]
	});
}
