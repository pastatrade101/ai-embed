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
import { serverIndustry } from './industries.js';
import { landNationalSummary, landCouncilProjects, landAreaCodes, landLotUse } from './govdata.js';

/** Tool schemas exposed to Claude now live in the Industry Registry — each
 *  industry declares its own toolset (rag.js reads `serverIndustry(client).tools`).
 *  This export remains as the default (tourism) set for compatibility. */
export const TOOL_DEFS = serverIndustry(null).tools;

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

	// Live TAUSI land-sales lookups (public gov data; tenant-independent). Each
	// returns an AI-readable string and never throws — unreachable → graceful msg.
	if (name === 'land_national_summary') {
		return landNationalSummary(input?.status);
	}

	if (name === 'land_council_projects') {
		return landCouncilProjects(input?.council ?? input?.administrative_area_code, input?.status);
	}

	if (name === 'land_area_codes') {
		return landAreaCodes();
	}

	if (name === 'land_lot_use') {
		return landLotUse();
	}

	if (name === 'search_knowledge') {
		const q = String(input?.query ?? '').trim();
		if (!q) return 'No query provided.';
		const emb = await embedQuery(q, { clientId: ctx.client.id, feature: 'embedding' });
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
			enrichLead(ctx.client.id, ctx.client.plan, inserted.id, lead, serverIndustry(ctx.client)).catch(() => {});
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
