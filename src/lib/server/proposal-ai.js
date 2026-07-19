// AI proposal drafting — turns a lead + the tenant's catalogue into a
// professional, editable draft (intro, recommended line items with REAL catalogue
// prices, summary, terms, CTA, plus upsell/cross-sell suggestions). Metered and
// gated via ai.js (AI.PROPOSAL). Industry-agnostic: tone + doc label come from the
// Industry Registry. The operator always edits before sending.
import { askJSON, askText, AI, SONNET } from '$lib/server/ai.js';
import { supabase } from '$lib/server/supabase.js';
import { serverIndustry } from '$lib/server/industries.js';
import { proposalConfig } from '$lib/industries.js';
import { listProposals } from '$lib/server/proposals.js';
import { getProposalSettings, aiDirectives, detailTokens } from '$lib/server/proposal-settings.js';

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
	const s = getProposalSettings(client);
	// Knowledge-source toggles decide what the AI may draw on.
	const cat = s.sources.catalogue ? await catalogueText(client.id) : '';

	const who = lead
		? [
				`Customer name: ${lead.name || '—'}`,
				`Their interest: ${lead.interest || '—'}`,
				s.sources.crm && lead.details ? `Known details: ${JSON.stringify(lead.details).slice(0, 800)}` : ''
			]
				.filter(Boolean)
				.join('\n')
		: 'No specific lead — draft a general example the operator can tailor.';
	const convo =
		s.sources.conversation && lead && Array.isArray(lead.transcript)
			? lead.transcript
					.filter((m) => m && m.role && m.content)
					.map((m) => `${m.role}: ${m.content}`)
					.join('\n')
					.slice(0, 3000)
			: '';

	const recRule =
		!s.enableUpsell && !s.enableCrossSell
			? '- Do NOT suggest any upsells or cross-sells — return empty arrays for both.'
			: `- ${s.enableUpsell ? 'upsell = optional premium upgrades' : 'return an empty upsell array'}; ${s.enableCrossSell ? 'cross_sell = complementary add-ons' : 'return an empty cross_sell array'}. Use catalogue item names where possible; leave arrays empty if nothing fits.`;
	const directives = aiDirectives(s, { includeStyle: false });
	const styleTone = s.writingStyle ? s.writingStyle : client.tone || 'warm, professional';

	const system = `You draft a professional ${cfg.docLabel} for ${client.name || `a ${ind.businessType}`}, a ${ind.businessType}. Write in a ${styleTone} tone that matches the brand.

Rules:
- Recommend items ONLY from the CATALOGUE below. NEVER invent products, services or prices. Copy catalogue prices EXACTLY into unit_price; if an item has no price, set unit_price to 0 and note "price on request" in detail.
- Pick the items that best fit the customer's stated interest; a good ${cfg.docLabel} is focused, not a dump of everything.
- Be concise, benefits-led and easy to skim. No markdown, no headings — just the fields.
${recRule}
- Return the structured object only.${directives ? `\n\n${directives}` : ''}`;

	const user = `CATALOGUE (the only prices/items you may use):\n${cat || '(no catalogue items yet — keep line_items minimal and set prices to 0)'}\n\nCUSTOMER:\n${who}\n${convo ? `\nCONVERSATION SO FAR:\n${convo}` : ''}${extra ? `\n\nOperator instructions: ${extra}` : ''}\n\nDraft the ${cfg.docLabel} now.`;

	return askJSON({
		clientId: client.id,
		planKey: client.plan,
		feature: AI.PROPOSAL,
		model: SONNET,
		system,
		schema: DRAFT_SCHEMA,
		maxTokens: detailTokens(s, 1600),
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
	const directives = aiDirectives(getProposalSettings(client), { includeStyle: false });
	const system = `You are an expert proposal editor for ${client.name || `a ${ind.businessType}`}. You are editing ONE section of a ${cfg.docLabel}. ${instruction}
Rules: keep it truthful — never invent prices, products, dates or facts. No markdown, no headings, no surrounding quotes. Return ONLY the rewritten text for this section.${directives ? `\n${directives}` : ''}`;
	const items = (Array.isArray(proposal.line_items) ? proposal.line_items : []).map((li) => li.description).filter(Boolean).join(', ');
	const user = `Section: ${field}\nCustomer: ${proposal.customer_name || '—'}\nItems in the proposal: ${items || '—'}\n\nCurrent text:\n${(text || '').trim() || '(empty — write a strong, safe, generic one for this section)'}`;
	const res = await askText({ clientId: client.id, planKey: client.plan, feature: AI.PROPOSAL, model: SONNET, system, maxTokens: 900, messages: [{ role: 'user', content: user }] });
	return { text: (res.text || '').trim(), error: res.error, quota: res.quota };
}

// ---- Revenue advisor: upsell / cross-sell with values + confidence ----------

const REV_ITEM = {
	type: 'object',
	additionalProperties: false,
	required: ['name', 'add_value', 'confidence', 'reason'],
	properties: {
		name: { type: 'string' },
		add_value: { type: 'number', description: 'Catalogue price of this add-on' },
		confidence: { type: 'integer', description: '0–100 fit estimate' },
		reason: { type: 'string', description: 'One short sentence: WHY this fits THIS customer, grounded in what they said or their profile (e.g. "Customer asked for premium accommodation")' }
	}
};
const REVENUE_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['upsells', 'cross_sells', 'coach'],
	properties: {
		upsells: { type: 'array', items: REV_ITEM },
		cross_sells: { type: 'array', items: REV_ITEM },
		coach: { type: 'string', description: 'One or two short coaching sentences for the operator' }
	}
};

/** Upsell/cross-sell ideas (from the catalogue) + a coaching line. Honours the
 *  tenant's recommendation settings (enable up/cross-sell, min confidence, max recs). */
export async function revenueIdeas({ client, proposal, lead = null }) {
	const ind = serverIndustry(client);
	const s = getProposalSettings(client);
	// Both off → no AI call, no cost.
	if (!s.enableUpsell && !s.enableCrossSell) {
		return { data: { upsells: [], cross_sells: [], coach: 'Upsell and cross-sell recommendations are turned off in Proposal AI settings.' } };
	}
	const cat = await catalogueText(client.id);
	const have = (Array.isArray(proposal.line_items) ? proposal.line_items : []).map((li) => li.description).filter(Boolean).join(', ');
	const kinds = [s.enableUpsell && 'UPSELLS (premium upgrades)', s.enableCrossSell && 'CROSS-SELLS (complementary add-ons)'].filter(Boolean).join(' and ');
	const extra = [s.enablePremium && 'You may recommend premium options.', s.enableBundles && 'You may suggest sensible bundles.', s.enableDiscounts && 'You may suggest a discount where it helps close.'].filter(Boolean).join(' ');
	const directives = aiDirectives(s, { includeStyle: false });
	const system = `You are a revenue advisor for ${client.name || `a ${ind.businessType}`}. Suggest ${kinds} for this proposal, chosen ONLY from the catalogue and NOT already on the proposal.${s.enableUpsell ? '' : ' Return an empty upsells array.'}${s.enableCrossSell ? '' : ' Return an empty cross_sells array.'} add_value = the item's catalogue price (0 if unknown). confidence = 0–100 fit for this customer. For EACH suggestion give a short, specific reason grounded in what the customer said or their profile — never a generic reason. Also give one short coaching tip. Empty arrays are fine if nothing fits. ${extra} ${directives} Return the structured object only.`;
	const user = `CATALOGUE:\n${cat || '(none)'}\n\nAlready on the proposal: ${have || 'nothing yet'}\nCustomer: ${proposal.customer_name || '—'}; interest: ${lead?.interest || '—'}${lead?.details ? `; details: ${JSON.stringify(lead.details).slice(0, 400)}` : ''}`;
	const res = await askJSON({ clientId: client.id, planKey: client.plan, feature: AI.PROPOSAL, model: SONNET, schema: REVENUE_SCHEMA, maxTokens: 900, system, messages: [{ role: 'user', content: user }] });

	// Enforce the tenant's recommendation rules (min confidence, max, enables).
	if (res.data) {
		const gate = (arr, on) => (on && Array.isArray(arr) ? arr.filter((r) => (r.confidence ?? 0) >= (s.minConfidence || 0)).slice(0, s.maxRecommendations || 10) : []);
		res.data.upsells = gate(res.data.upsells, s.enableUpsell);
		res.data.cross_sells = gate(res.data.cross_sells, s.enableCrossSell);
	}
	return res;
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

// ---- AI Sales Memory: requirement extraction + conversation sync ------------
// The proposal is a continuation of the customer conversation. These helpers let
// the AI read everything it already knows — the transcript, the extracted lead
// details, and previous proposals — instead of starting from an empty document.

/** Flatten a lead's conversation transcript into readable text (trimmed). */
function conversationText(lead, max = 4000) {
	if (!lead || !Array.isArray(lead.transcript)) return '';
	return lead.transcript
		.filter((m) => m && m.role && m.content)
		.map((m) => `${m.role === 'assistant' ? 'AI' : 'Customer'}: ${m.content}`)
		.join('\n')
		.slice(-max);
}

/** Compact list of the customer's previous proposals (sales memory / continuity). */
async function priorProposalsText(clientId, leadId, excludeId) {
	if (!leadId) return '';
	try {
		const { proposals } = await listProposals(clientId, { leadId, limit: 6 });
		return (proposals || [])
			.filter((p) => p.id !== excludeId)
			.map((p) => `- ${p.number} (${p.doc_type}, ${p.status}) — ${p.currency} ${p.total}${p.title ? `: ${p.title}` : ''}`)
			.join('\n');
	} catch {
		return '';
	}
}

const SOURCE_ENUM = ['conversation', 'crm', 'knowledge_base', 'catalogue', 'pricing', 'policy', 'previous_proposal', 'inferred'];

const REQUIREMENTS_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['customer', 'intent', 'summary', 'confidence', 'ready', 'missing', 'questions', 'estimated_value'],
	properties: {
		customer: { type: 'string', description: 'The customer name, or "the customer" if unknown' },
		intent: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'], description: 'The customer’s buying intent, judged from the conversation' },
		summary: {
			type: 'array',
			description: 'Structured requirements you can infer, as fields. Choose the ones that matter for THIS kind of business (e.g. Budget, Timeline, Participants, Interest, Location…). Only include fields you actually know from the conversation or details.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['label', 'value', 'confidence', 'source'],
				properties: {
					label: { type: 'string' },
					value: { type: 'string' },
					confidence: { type: 'integer', description: '0–100 confidence in THIS field’s value' },
					source: { type: 'string', enum: SOURCE_ENUM, description: 'Where this value came from — "conversation" if the customer said it, "crm" if from saved details, "inferred" if you deduced it' }
				}
			}
		},
		confidence: { type: 'integer', description: '0–100: how confident you are that there is enough to draft a strong, accurate proposal' },
		ready: { type: 'boolean', description: 'true if there is enough information to generate a high-quality proposal now' },
		missing: { type: 'array', items: { type: 'string' }, description: 'Important information still missing (short labels)' },
		questions: { type: 'array', items: { type: 'string' }, description: 'Suggested follow-up questions to ask the customer to fill the gaps (empty if ready)' },
		estimated_value: { type: 'number', description: 'Best estimate of the proposal value in the customer’s currency, grounded in the catalogue and stated budget; 0 if you cannot estimate' }
	}
};

/** Deterministic grounding signals — computed from real data, never asked of the
 *  AI (so it can't fake its own trustworthiness). Powers the Trust panel. */
async function groundingFor(clientId, lead, s) {
	let kb = 0;
	let priced = 0;
	// Only query (and only credit) the catalogue if the operator left it enabled —
	// grounding must reflect what was ACTUALLY fed to the model, not raw data presence.
	if (s.sources.catalogue) {
		try {
			const { data } = await supabase.from('knowledge_items').select('price_amount').eq('client_id', clientId).limit(300);
			kb = (data ?? []).length;
			priced = (data ?? []).filter((i) => i.price_amount != null && i.price_amount !== '').length;
		} catch {
			/* fail open — report no catalogue grounding */
		}
	}
	return {
		conversation: !!(s.sources.conversation && lead && Array.isArray(lead.transcript) && lead.transcript.length),
		crm: !!(s.sources.crm && lead && lead.details && Object.keys(lead.details).length),
		knowledge_base: kb > 0,
		pricing: priced > 0
	};
}

/**
 * Extract structured requirements + readiness from the conversation, before/while
 * drafting. Industry-aware. Returns { data, error, quota }.
 */
export async function extractRequirements({ client, lead }) {
	const ind = serverIndustry(client);
	const cfg = proposalConfig(client);
	const s = getProposalSettings(client);
	const convo = s.sources.conversation ? conversationText(lead) : '';
	const details = s.sources.crm && lead?.details ? JSON.stringify(lead.details).slice(0, 900) : '';
	const prior = s.sources.previous_proposals ? await priorProposalsText(client.id, lead?.id, null) : '';

	const cat = s.sources.catalogue ? await catalogueText(client.id) : '';
	const system = `You are a sales requirements analyst for ${client.name || `a ${ind.businessType}`}, a ${ind.businessType}. Read the customer conversation and known details and extract the requirements needed to prepare a ${cfg.docLabel}. Decide which fields matter for this kind of business and fill only the ones you actually know. For EACH field give a confidence (0–100) and its source — "conversation" if the customer said it, "crm" if it came from saved details, "inferred" if you deduced it. Be strictly truthful — never invent budgets, dates, numbers or preferences. Estimate the proposal value using the catalogue and stated budget. Judge overall readiness, list what's missing, and suggest concise follow-up questions for the gaps. Return the structured object only.`;
	const user = `CUSTOMER: ${lead?.name || '—'}\nStated interest: ${lead?.interest || '—'}\n${details ? `Known details (extracted): ${details}\n` : ''}${prior ? `Previous proposals for this customer:\n${prior}\n` : ''}${cat ? `\nCATALOGUE (for value estimate):\n${cat.slice(0, 1500)}\n` : ''}${convo ? `\nCONVERSATION:\n${convo}` : '\n(no conversation transcript — infer from interest/details only, and lower confidence)'}`;

	const res = await askJSON({
		clientId: client.id,
		planKey: client.plan,
		feature: AI.PROPOSAL,
		model: SONNET,
		schema: REQUIREMENTS_SCHEMA,
		maxTokens: 1300,
		system,
		messages: [{ role: 'user', content: user }]
	});

	// Augment with deterministic grounding/trust signals (not AI-authored).
	if (res.data) {
		const g = await groundingFor(client.id, lead, s);
		const have = Array.isArray(res.data.summary) ? res.data.summary.length : 0;
		const miss = Array.isArray(res.data.missing) ? res.data.missing.length : 0;
		res.data.grounding = g;
		res.data.sources_used = Object.entries(g).filter(([, v]) => v).map(([k]) => k);
		res.data.hallucination_risk = g.knowledge_base && g.pricing ? 'very_low' : g.knowledge_base || g.conversation ? 'low' : 'medium';
		res.data.completeness = { have, total: have + miss };
	}
	return res;
}

const SYNC_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['in_sync', 'changes', 'updated_fields', 'estimated_diff', 'note'],
	properties: {
		in_sync: { type: 'boolean', description: 'true if the proposal already reflects the latest conversation — no changes needed' },
		changes: {
			type: 'array',
			description: 'Only the sections that should change based on NEW information in the conversation. Empty when in_sync.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['section', 'label', 'from', 'to', 'reason'],
				properties: {
					section: { type: 'string', enum: ['intro', 'summary', 'terms', 'pricing', 'scope', 'customer'] },
					label: { type: 'string', description: 'Short change title, e.g. "Budget increased", "Removed Zanzibar"' },
					from: { type: 'string', description: 'The current value/state in one short phrase (e.g. "USD 8,000", "Luxury lodge"). "" if new.' },
					to: { type: 'string', description: 'The new value/state in one short phrase (e.g. "USD 10,000", "Ultra-luxury lodge").' },
					reason: { type: 'string', description: 'Why it changed, grounded in the conversation (e.g. "Customer increased budget during the chat")' }
				}
			}
		},
		updated_fields: {
			type: 'object',
			additionalProperties: false,
			required: ['intro', 'summary', 'terms'],
			description: 'Rewritten text for a section that should change; null to leave that section exactly as-is. Preserve the operator’s wording where possible.',
			properties: { intro: { type: ['string', 'null'] }, summary: { type: ['string', 'null'] }, terms: { type: ['string', 'null'] } }
		},
		estimated_diff: { type: 'number', description: 'Estimated change to the total in the proposal currency (+/-), 0 if none. Advisory only — the operator edits line items.' },
		note: { type: 'string', description: 'One-line summary for the operator' }
	}
};

/**
 * Detect what in the current proposal is out of sync with the latest conversation
 * and propose scoped updates (never a full regeneration). Returns { data, error, quota }.
 */
export async function syncFromConversation({ client, proposal, lead }) {
	const ind = serverIndustry(client);
	const cfg = proposalConfig(client);
	const s = getProposalSettings(client);
	const convo = s.sources.conversation ? conversationText(lead) : '';
	const details = s.sources.crm && lead?.details ? JSON.stringify(lead.details).slice(0, 700) : '';
	const items = (Array.isArray(proposal.line_items) ? proposal.line_items : []).map((li) => `${li.description} (${li.qty}× ${li.unit_price})`).join('; ');

	const system = `You keep a ${cfg.docLabel} in sync with the customer conversation for ${client.name || `a ${ind.businessType}`}. Compare the CURRENT proposal to the LATEST conversation and known details. Identify ONLY what genuinely changed because of new customer information (budget, group size, scope added/removed, preferences, timing…). Do NOT rewrite things that are already correct, and preserve the operator's wording where you can. For any of intro/summary/terms that should change, return the full rewritten text; otherwise return null for it. Estimate the pricing impact as a number (advisory — you cannot edit line items). If nothing changed, set in_sync=true with an empty changes array. Never invent facts. Return the structured object only.`;
	const user = `CURRENT PROPOSAL (${proposal.number}, ${proposal.currency}):\nTitle: ${proposal.title || '—'}\nIntro: ${proposal.intro || '—'}\nSummary: ${proposal.summary || '—'}\nTerms: ${proposal.terms || '—'}\nLine items: ${items || '—'}\nTotal: ${proposal.total}\n\n${details ? `Known details: ${details}\n` : ''}CONVERSATION:\n${convo || '(no transcript available)'}`;

	return askJSON({
		clientId: client.id,
		planKey: client.plan,
		feature: AI.PROPOSAL,
		model: SONNET,
		schema: SYNC_SCHEMA,
		maxTokens: 1400,
		system,
		messages: [{ role: 'user', content: user }]
	});
}
