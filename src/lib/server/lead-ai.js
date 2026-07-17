// Structured lead extraction — a small Haiku call that turns a captured lead's
// free-text conversation into reliable typed fields, replacing the brittle regex
// parser. Runs fire-and-forget at capture time (never blocks the chat reply),
// gated by the AI-qualified-leads feature and metered by the lead_extract quota.
import { askJSON, AI, HAIKU } from '$lib/server/ai.js';
import { supabase } from '$lib/server/supabase.js';
import { serverIndustry } from '$lib/server/industries.js';

/** Enrich one lead's `details` from its conversation. Best-effort — swallows all
 *  errors (fire-and-forget) and no-ops if the details column isn't migrated yet.
 *  The extraction schema + prompt come from the tenant's Industry Registry entry
 *  (tourism = the original trip schema, verbatim). */
export async function enrichLead(clientId, planKey, leadId, lead, ind = serverIndustry(null)) {
	try {
		const userText = Array.isArray(lead.transcript) ? lead.transcript.filter((m) => m.role === 'user').map((m) => m.content).join('\n') : '';
		const text = `${lead.interest ?? ''}\n${userText}`.trim();
		if (text.length < 8) return;
		const res = await askJSON({ clientId, planKey, feature: AI.LEAD_EXTRACT, model: HAIKU, system: ind.leadSystem, schema: ind.leadSchema, maxTokens: 400, messages: [{ role: 'user', content: text.slice(0, 6000) }] });
		if (res.error || !res.data) return;
		await supabase.from('leads').update({ details: res.data }).eq('id', leadId).eq('client_id', clientId);
	} catch {
		/* fire-and-forget */
	}
}
