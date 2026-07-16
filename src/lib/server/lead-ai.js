// Structured lead extraction — a small Haiku call that turns a captured lead's
// free-text conversation into reliable typed fields, replacing the brittle regex
// parser. Runs fire-and-forget at capture time (never blocks the chat reply),
// gated by the AI-qualified-leads feature and metered by the lead_extract quota.
import { askJSON, AI, HAIKU } from '$lib/server/ai.js';
import { supabase } from '$lib/server/supabase.js';

const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['destination', 'tour', 'travel', 'adults', 'children', 'budget', 'currency', 'country', 'accommodation', 'specialRequests', 'intent'],
	properties: {
		destination: { type: ['string', 'null'], description: 'Where they want to go (park, region, country)' },
		tour: { type: ['string', 'null'], description: 'A specific tour/package name if they named one' },
		travel: { type: ['string', 'null'], description: 'Travel month or exact dates, as stated' },
		adults: { type: ['integer', 'null'] },
		children: { type: ['integer', 'null'] },
		budget: { type: ['integer', 'null'], description: 'Numeric budget if stated' },
		currency: { type: ['string', 'null'], description: 'Currency of the budget, e.g. USD' },
		country: { type: ['string', 'null'], description: 'Nationality / where they travel from' },
		accommodation: { type: ['string', 'null'], description: 'Accommodation preference, e.g. Luxury lodge' },
		specialRequests: { type: ['string', 'null'] },
		intent: { type: 'string', enum: ['ready_to_book', 'high', 'medium', 'low'] }
	}
};

const SYSTEM = `Extract the trip details a customer actually stated, for a tour operator's lead record. Use null for anything not clearly stated — never guess or infer beyond what they said. "intent" is how ready to book they sound. Return the structured object only.`;

/** Enrich one lead's `details` from its conversation. Best-effort — swallows all
 *  errors (fire-and-forget) and no-ops if the details column isn't migrated yet. */
export async function enrichLead(clientId, planKey, leadId, lead) {
	try {
		const userText = Array.isArray(lead.transcript) ? lead.transcript.filter((m) => m.role === 'user').map((m) => m.content).join('\n') : '';
		const text = `${lead.interest ?? ''}\n${userText}`.trim();
		if (text.length < 8) return;
		const res = await askJSON({ clientId, planKey, feature: AI.LEAD_EXTRACT, model: HAIKU, system: SYSTEM, schema: SCHEMA, maxTokens: 400, messages: [{ role: 'user', content: text.slice(0, 6000) }] });
		if (res.error || !res.data) return;
		await supabase.from('leads').update({ details: res.data }).eq('id', leadId).eq('client_id', clientId);
	} catch {
		/* fire-and-forget */
	}
}
