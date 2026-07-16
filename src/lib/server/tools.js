// Agent tools. The model decides WHICH tool to call; the backend executes each
// one, always scoped to the current tenant (ctx.client). This is the foundation
// the later agentic phases build on — new capabilities are new tools here, not
// new prompt logic.
import { embedQuery } from './embeddings.js';
import { supabase } from './supabase.js';
import { sendLeadEmail } from './email.js';
import { searchTours, getTourPrice } from './tours.js';
import { FEATURE, planAllows } from './gating.js';
import { enrichLead } from './lead-ai.js';

/** Tool schemas exposed to Claude. */
export const TOOL_DEFS = [
	{
		name: 'search_tours',
		description:
			'Find matching tours/itineraries by interest, month, budget and group size. Use this for trip enquiries to recommend options before answering. Returns tours with duration, per-person price, best season and upcoming departures.',
		input_schema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'What they want, e.g. "wildlife safari", "Kilimanjaro climb"' },
				month: { type: 'string', description: 'Travel month, e.g. "September"' },
				max_price: { type: 'number', description: 'Total budget in the tour currency (for the whole group)' },
				group_size: { type: 'number', description: 'Number of travellers' }
			}
		}
	},
	{
		name: 'get_tour_price',
		description:
			'Get the exact base price, scheduled departures and a group estimate for a specific named tour. Prices come straight from the catalogue — never estimate a price without calling this.',
		input_schema: {
			type: 'object',
			properties: {
				tour: { type: 'string', description: 'The tour name (as shown by search_tours)' },
				group_size: { type: 'number' },
				month: { type: 'string', description: 'Travel month to filter departures' }
			},
			required: ['tour']
		}
	},
	{
		name: 'search_knowledge',
		description:
			"Search the business's verified catalogue (tours, prices, inclusions, FAQs, policies) for details to answer the customer. Initial results for the latest question are already in CONTEXT — call this only when you need additional or more specific information.",
		input_schema: {
			type: 'object',
			properties: { query: { type: 'string', description: 'What to look up, in natural language' } },
			required: ['query']
		}
	},
	{
		name: 'create_lead',
		description:
			'Save a sales lead once the customer shows clear buying intent and has shared at least a WhatsApp number or email (plus a name if given). Ask for both a WhatsApp number and email when you can, and capture whatever details you have so the operator can follow up.',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				whatsapp: { type: 'string', description: 'WhatsApp number with country code' },
				email: { type: 'string' },
				interest: {
					type: 'string',
					description:
						'Everything learned about the trip in one line: tour/destination, travel month or exact dates, number of adults and children, budget, accommodation preference, and nationality (where they travel from) — whatever was mentioned.'
				}
			}
		}
	}
];

/**
 * Execute a tool by name. Returns a plain-string result for the model.
 * @param {string} name
 * @param {any} input
 * @param {{ client: any, transcript: any[] }} ctx
 * @returns {Promise<string>}
 */
export async function runTool(name, input, ctx) {
	if (name === 'search_tours') {
		return searchTours(ctx.client.id, input ?? {});
	}

	if (name === 'get_tour_price') {
		return getTourPrice(ctx.client.id, input ?? {});
	}

	if (name === 'search_knowledge') {
		const q = String(input?.query ?? '').trim();
		if (!q) return 'No query provided.';
		const emb = await embedQuery(q);
		const { data, error } = await supabase.rpc('match_chunks', {
			p_client_id: ctx.client.id,
			p_query_embedding: emb,
			p_match_count: 5
		});
		if (error) return `Search failed: ${error.message}`;
		if (!data || !data.length) return 'No matching information found in the catalogue.';
		return data.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');
	}

	if (name === 'create_lead') {
		const lead = {
			client_id: ctx.client.id,
			name: input?.name ?? null,
			whatsapp: input?.whatsapp ?? null,
			email: input?.email ?? null,
			interest: input?.interest ?? null,
			transcript: Array.isArray(ctx.transcript) ? ctx.transcript : null
		};
		if (!lead.whatsapp && !lead.email && !lead.name) {
			return 'Not enough detail to save a lead — ask for a name or WhatsApp number first.';
		}
		const { data: inserted, error } = await supabase.from('leads').insert(lead).select('id').single();
		if (error) return `Could not save lead: ${error.message}`;
		// Structured extraction — enrich the lead's typed fields in the background
		// (premium, metered). Never blocks the reply; free/over-quota tenants no-op.
		if (inserted?.id && (await planAllows(ctx.client.plan, FEATURE.QUALIFIED_LEADS))) {
			enrichLead(ctx.client.id, ctx.client.plan, inserted.id, lead).catch(() => {});
		}
		// Email alerts are a plan feature; the lead is always saved regardless.
		if (await planAllows(ctx.client.plan, FEATURE.EMAIL_ALERTS)) {
			try {
				await sendLeadEmail({ to: ctx.client.lead_email, businessName: ctx.client.name, lead });
			} catch {
				/* email is best-effort; the lead is already saved */
			}
		}
		return 'Lead saved and the team has been notified. Tell the customer someone will follow up shortly.';
	}

	return `Unknown tool: ${name}`;
}
