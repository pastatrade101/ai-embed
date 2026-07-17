// AI Research Assistant — the operator points it at a topic (often a catalogue gap
// like "balloon safaris" that customers keep asking about) and it drafts a
// knowledge-base entry using live web search, for the operator to review and
// publish. Never answers customers directly; it only produces operator-reviewed
// drafts, so the "answer only from verified data" rule is preserved.
//
import { askText, AI, SONNET } from '$lib/server/ai.js';
import { supabase } from '$lib/server/supabase.js';
import { reingestItem } from '$lib/server/rag.js';
import { serverIndustry } from '$lib/server/industries.js';

/** Draft a knowledge entry for a topic. Gated + metered via ai.js. The
 *  researcher's role framing comes from the Industry Registry (tourism verbatim). */
export async function researchDraft(clientId, planKey, topic, ind = serverIndustry(null)) {
	const topicStr = String(topic).slice(0, 300);
	// Server-side web search loops internally; give enough hops to finish searching
	// and reach a clean final entry rather than being cut off mid-search.
	const res = await askText({
		clientId,
		planKey,
		feature: AI.RESEARCH,
		model: SONNET,
		maxTokens: 2000,
		hops: 12,
		system: ind.researchSystem,
		tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
		messages: [{ role: 'user', content: `Draft a knowledge-base entry about: ${topicStr}` }]
	});
	if (res.error) return res; // 'quota' or 'ai_error' — pass through for the action to handle

	// Robust parse: drop any leading narration before the first "# " title line.
	const text = (res.text || '').trim();
	const start = text.search(/^\s*#\s+/m);
	const fromTitle = start >= 0 ? text.slice(start) : text;
	const m = fromTitle.match(/^\s*#\s+(.+)$/m);
	const title = (m ? m[1] : topicStr).trim().slice(0, 120);
	const body = (start >= 0 ? fromTitle.replace(/^\s*#\s+.+$/m, '') : text).trim();
	// A successful call that produced no usable text is a soft failure, not an empty draft.
	if (!body) return { error: 'empty', quota: res.quota };
	return { title, body, quota: res.quota };
}

/** Publish an (operator-edited) draft into AI Knowledge and embed it. */
export async function saveResearchDraft(clientId, { title, body, category = 'Travel guide' }) {
	if (!String(title || '').trim() || !String(body || '').trim()) return { error: 'A title and content are required.' };
	const { data: item, error } = await supabase
		.from('knowledge_items')
		.insert({
			client_id: clientId,
			title: String(title).trim().slice(0, 200),
			body: String(body).trim(),
			category,
			metadata: { source: 'research', drafted: new Date().toISOString() }
		})
		.select('id, client_id, title, body, category, price_amount, price_currency, metadata')
		.single();
	if (error) return { error: error.message };
	try {
		await reingestItem(item);
	} catch (e) {
		return { error: `Saved, but couldn’t be learned yet — ${e.message}` };
	}
	return { ok: true, id: item.id };
}
