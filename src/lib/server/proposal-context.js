// ProposalContextService — assembles everything the AI needs to hold a grounded
// WhatsApp conversation about ONE proposal: tenant/business, the live proposal JSON
// (items, pricing, version, terms, status), the catalogue (for add-ons), the discount
// policy, the customer profile, and the conversation history. The AI never has to ask
// "which proposal?" — it's all here.
import { serverIndustry } from './industries.js';
import { proposalConfig } from '$lib/industries.js';
import { getProposalSettings } from './proposal-settings.js';
import { catalogueText } from './proposal-ai.js';

const money = (n, cur) => `${cur || ''} ${Math.round(Number(n) || 0).toLocaleString('en-US')}`.trim();

/**
 * Build the context object for the negotiation AI.
 * @param {object} p  { client, proposal, lead, conversation }
 */
export async function buildProposalContext({ client, proposal, lead = null, conversation = null }) {
	const ind = serverIndustry(client);
	const cfg = proposalConfig(client);
	const settings = getProposalSettings(client);
	const cat = settings.sources?.catalogue ? await catalogueText(client.id) : '';

	const items = (Array.isArray(proposal.line_items) ? proposal.line_items : []).map((li, i) => ({
		n: i + 1,
		description: li.description,
		detail: li.detail || null,
		qty: li.qty,
		unit_price: li.unit_price,
		amount: li.amount
	}));

	const priorMods = Array.isArray(proposal.meta?.versions) ? proposal.meta.versions.map((v) => `v${v.version}: ${v.summary} (${money(v.oldTotal, proposal.currency)} → ${money(v.newTotal, proposal.currency)})`) : [];

	const history = Array.isArray(conversation?.messages)
		? conversation.messages.slice(-24).map((m) => `${m.role === 'customer' ? 'Customer' : m.role === 'agent' ? 'Human agent' : 'AI'}: ${m.text}`)
		: [];

	return {
		// Raw pieces (used by the negotiation validator)
		settings,
		items,
		docLabel: cfg.docLabel,
		// A compact text block for the prompt
		text: [
			`BUSINESS: ${client.name || ind.businessType} — a ${ind.businessType}. Tone: ${client.tone || 'warm, professional'}.`,
			settings.customInstructions ? `BUSINESS RULES (must follow): ${settings.customInstructions}` : '',
			`PROPOSAL: ${proposal.number} · ${cfg.docLabel} · status ${proposal.status} · version ${proposal.version || 1}`,
			proposal.title ? `Title: ${proposal.title}` : '',
			`Customer: ${proposal.customer_name || lead?.name || '—'}`,
			proposal.intro ? `Intro: ${proposal.intro}` : '',
			proposal.summary ? `Recommendation: ${proposal.summary}` : '',
			`ITEMS:\n${items.map((i) => `  ${i.n}. ${i.description}${i.detail ? ` — ${i.detail}` : ''} · qty ${i.qty} · ${money(i.unit_price, proposal.currency)} · line ${money(i.amount, proposal.currency)}`).join('\n') || '  (none)'}`,
			`PRICING: subtotal ${money(proposal.subtotal, proposal.currency)}; discount ${money(proposal.discount, proposal.currency)}; tax ${money(proposal.tax, proposal.currency)}; TOTAL ${money(proposal.total, proposal.currency)} ${proposal.currency}.`,
			proposal.terms ? `TERMS: ${proposal.terms}` : '',
			proposal.valid_until ? `Valid until: ${proposal.valid_until}` : '',
			`DISCOUNT POLICY: ${settings.enableDiscounts ? `discounts allowed up to ${settings.maxDiscountPercent ?? 10}%` : 'discounts are NOT allowed'}. Upsell ${settings.enableUpsell ? 'on' : 'off'}; cross-sell ${settings.enableCrossSell ? 'on' : 'off'}.`,
			priorMods.length ? `PREVIOUS CHANGES:\n${priorMods.map((m) => `  - ${m}`).join('\n')}` : '',
			cat ? `CATALOGUE (only source for added items/prices):\n${cat.slice(0, 1800)}` : '',
			lead?.details ? `CUSTOMER DETAILS: ${JSON.stringify(lead.details).slice(0, 500)}` : '',
			history.length ? `CONVERSATION SO FAR:\n${history.join('\n')}` : ''
		]
			.filter(Boolean)
			.join('\n\n')
	};
}
