// AI proposal drafting — turns a lead + the tenant's catalogue into a
// professional, editable draft (intro, recommended line items with REAL catalogue
// prices, summary, terms, CTA, plus upsell/cross-sell suggestions). Metered and
// gated via ai.js (AI.PROPOSAL). Industry-agnostic: tone + doc label come from the
// Industry Registry. The operator always edits before sending.
import { askJSON, askText, AI, SONNET } from '$lib/server/ai.js';
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
export async function catalogueText(clientId) {
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

// ---- One-click section rewrites (the AI Proposal Assistant) -----------------

// Each action is an instruction applied to ONE section only. Truthful edits:
// never invent prices/products/facts — the operator can always undo by editing.
const ASSIST_ACTIONS = {
	improve: 'Improve it: clearer, more polished and more compelling, same facts and roughly the same length.',
	rewrite: 'Rewrite it cleanly and professionally.',
	persuasive: 'Rewrite it to be more persuasive and benefits-led, without exaggerating or inventing anything.',
	luxury: 'Rewrite it in a refined, premium, luxury tone.',
	professional: 'Rewrite it in a crisp, professional business tone.',
	friendly: 'Rewrite it in a warm, friendly, approachable tone.',
	formal: 'Rewrite it in a formal, precise tone.',
	simplify: 'Simplify the language so anyone can understand it — short sentences, plain words.',
	expand: 'Expand it with a little more useful, factual detail, staying concise.',
	shorten: 'Make it shorter and punchier without losing the key point.',
	cta: 'Rewrite it to finish with a clear, confident call to action.',
	closing: 'Strengthen the closing so it gently encourages the customer to proceed.'
};
export const ASSIST_ACTION_KEYS = Object.keys(ASSIST_ACTIONS);

/** Rewrite one section (intro / summary / terms). Returns { text, error, quota }. */
export async function assistField({ client, field, action, text, proposal = {} }) {
	const ind = serverIndustry(client);
	const cfg = proposalConfig(client);
	const instruction = ASSIST_ACTIONS[action] || ASSIST_ACTIONS.improve;
	const system = `You are an expert proposal editor for ${client.name || `a ${ind.businessType}`}. You are editing ONE section of a ${cfg.docLabel}. ${instruction}
Rules: keep it truthful — never invent prices, products, dates or facts. No markdown, no headings, no surrounding quotes. Return ONLY the rewritten text for this section.`;
	const items = (Array.isArray(proposal.line_items) ? proposal.line_items : []).map((li) => li.description).filter(Boolean).join(', ');
	const user = `Section: ${field}\nCustomer: ${proposal.customer_name || '—'}\nItems in the proposal: ${items || '—'}\n\nCurrent text:\n${(text || '').trim() || '(empty — write a strong, safe, generic one for this section)'}`;
	const res = await askText({ clientId: client.id, planKey: client.plan, feature: AI.PROPOSAL, model: SONNET, system, maxTokens: 900, messages: [{ role: 'user', content: user }] });
	return { text: (res.text || '').trim(), error: res.error, quota: res.quota };
}

// ---- Revenue advisor: upsell / cross-sell with values + confidence ----------

const REVENUE_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['upsells', 'cross_sells', 'coach'],
	properties: {
		upsells: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'add_value', 'confidence'], properties: { name: { type: 'string' }, add_value: { type: 'number', description: 'Catalogue price of this add-on' }, confidence: { type: 'integer', description: '0–100 fit estimate' } } } },
		cross_sells: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'add_value', 'confidence'], properties: { name: { type: 'string' }, add_value: { type: 'number' }, confidence: { type: 'integer' } } } },
		coach: { type: 'string', description: 'One or two short coaching sentences for the operator' }
	}
};

/** Upsell/cross-sell ideas (from the catalogue) + a coaching line. */
export async function revenueIdeas({ client, proposal, lead = null }) {
	const ind = serverIndustry(client);
	const cat = await catalogueText(client.id);
	const have = (Array.isArray(proposal.line_items) ? proposal.line_items : []).map((li) => li.description).filter(Boolean).join(', ');
	const system = `You are a revenue advisor for ${client.name || `a ${ind.businessType}`}. Suggest UPSELLS (premium upgrades) and CROSS-SELLS (complementary add-ons) for this proposal, chosen ONLY from the catalogue and NOT already on the proposal. add_value = the item's catalogue price (0 if unknown). confidence = 0–100 fit for this customer. Also give one short coaching tip. Empty arrays are fine if nothing fits. Return the structured object only.`;
	const user = `CATALOGUE:\n${cat || '(none)'}\n\nAlready on the proposal: ${have || 'nothing yet'}\nCustomer: ${proposal.customer_name || '—'}; interest: ${lead?.interest || '—'}${lead?.details ? `; details: ${JSON.stringify(lead.details).slice(0, 400)}` : ''}`;
	return askJSON({ clientId: client.id, planKey: client.plan, feature: AI.PROPOSAL, model: SONNET, schema: REVENUE_SCHEMA, maxTokens: 900, system, messages: [{ role: 'user', content: user }] });
}

// ---- Follow-up message generator (email / WhatsApp) -------------------------

/** A short follow-up message to nudge the customer. Returns { text, error, quota }. */
export async function followupMessage({ client, proposal, channel = 'email', reason = '' }) {
	const cfg = proposalConfig(client);
	const isWa = channel === 'whatsapp';
	const system = `Write a short, friendly follow-up ${isWa ? 'WhatsApp message' : 'email'} from ${client.name || 'the team'} to a customer about their ${cfg.docLabel.toLowerCase()} (${proposal.number}). Encourage them to review and accept it. ${isWa ? 'Keep it to 2–3 short, casual lines. No subject line.' : 'Keep it brief and professional. Put the subject on the first line as "Subject: …".'} ${reason ? `Context for you (do not quote verbatim): ${reason}.` : ''} Never invent facts. Return only the message.`;
	const money = Number(proposal.total) ? `${proposal.currency} ${proposal.total}` : '';
	const user = `Customer: ${proposal.customer_name || 'there'}. ${money ? `Total: ${money}. ` : ''}Status: ${proposal.status}.${proposal.valid_until ? ` Valid until: ${proposal.valid_until}.` : ''}`;
	const res = await askText({ clientId: client.id, planKey: client.plan, feature: AI.PROPOSAL, model: SONNET, system, maxTokens: 500, messages: [{ role: 'user', content: user }] });
	return { text: (res.text || '').trim(), error: res.error, quota: res.quota };
}
