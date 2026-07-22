// The RAG flow: retrieve → ground → answer. This is the product's core.
// It runs on every visitor question and never touches the operator's live site —
// the assistant answers only from stored, verified data.
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { supabase } from './supabase.js';
import { embed, embedQuery } from './embeddings.js';
import { chunkItem } from './knowledge.js';
import { estimateCost } from './pricing.js';
import { runTool } from './tools.js';
import { serverIndustry } from './industries.js';
import { FEATURE, planAllows, planUnlocks } from './gating.js';
import { budgetStatus } from './credits.js';
import { notifyUsageIfCrossed } from './usage-alerts.js';

const MAX_TOOL_LOOPS = 6;
// Premium model tier unlocked by the "Advanced (Sonnet) AI model" plan feature.
const SONNET_MODEL = 'claude-sonnet-5';

// Memory: once a conversation passes SUMMARY_THRESHOLD messages, we summarize
// the earlier ones and send [summary + last KEEP_RECENT] to the model.
const SUMMARY_THRESHOLD = 12;
const KEEP_RECENT = 6;

const extractText = (response) =>
	response.content
		.filter((b) => b.type === 'text')
		.map((b) => b.text)
		.join('')
		.trim();

/**
 * Fire-and-forget: summarize a long conversation and store it on the row, so
 * the next turn can send the summary instead of the full history. Its own
 * (small) token cost is logged to usage_records.
 */
function summarizeConversation(clientId, conversationId, transcript, ind = serverIndustry(null)) {
	if (!conversationId || transcript.length < SUMMARY_THRESHOLD) return;
	const text = transcript.map((m) => `${m.role}: ${m.content}`).join('\n');
	anthropic()
		.messages.create({
			model: CHAT_MODEL,
			max_tokens: 300,
			system: ind.summarySystem,
			messages: [{ role: 'user', content: text }]
		})
		.then((resp) => {
			const summary = extractText(resp);
			if (summary) {
				supabase.from('conversations').update({ summary }).eq('id', conversationId).then(() => {});
			}
			const u = resp.usage ?? {};
			supabase
				.from('usage_records')
				.insert({
					client_id: clientId,
					conversation_id: conversationId,
					model: CHAT_MODEL,
					input_tokens: u.input_tokens ?? 0,
					cached_tokens: u.cache_read_input_tokens ?? 0,
					output_tokens: u.output_tokens ?? 0,
					tool_calls: 0,
					estimated_cost: estimateCost(CHAT_MODEL, u),
					feature: 'summary'
				})
				.then(({ error }) => {
					if (error) {
						supabase.from('usage_records').insert({ client_id: clientId, conversation_id: conversationId, model: CHAT_MODEL, input_tokens: u.input_tokens ?? 0, cached_tokens: u.cache_read_input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, tool_calls: 0, estimated_cost: estimateCost(CHAT_MODEL, u) }).then(() => {});
					}
				});
		})
		.catch((e) => console.error('[rag] summarize failed:', e?.message ?? e));
}

// Claude Haiku 4.5 — fast and cheap per conversation; grounding does the heavy
// lifting. Swap to claude-sonnet-5 for a Pro tier. (Per build spec §4.)
const CHAT_MODEL = 'claude-haiku-4-5';

/**
 * Translate an array of message texts into English (for the operator's inbox).
 * Returns a same-length array; already-English text passes through. Pass
 * `clientId` to meter the Claude cost toward the tenant's AI usage.
 */
export async function translateToEnglish(texts, clientId = null, ind = serverIndustry(null)) {
	const list = (Array.isArray(texts) ? texts : [texts]).map((t) => String(t ?? ''));
	if (!list.length) return [];
	const resp = await anthropic().messages.create({
		model: CHAT_MODEL,
		max_tokens: 2000,
		system: ind.translateSystem,
		messages: [{ role: 'user', content: JSON.stringify(list) }]
	});
	if (clientId) {
		const u = resp.usage ?? {};
		const row = { client_id: clientId, model: CHAT_MODEL, input_tokens: u.input_tokens ?? 0, cached_tokens: u.cache_read_input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, tool_calls: 0, estimated_cost: estimateCost(CHAT_MODEL, u), feature: 'translate' };
		supabase
			.from('usage_records')
			.insert(row)
			.then(({ error }) => {
				if (error) {
					delete row.feature;
					supabase.from('usage_records').insert(row).then(() => {});
				}
			});
	}
	let text = extractText(resp).replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
	try {
		const arr = JSON.parse(text);
		if (Array.isArray(arr) && arr.length === list.length) return arr.map((x) => String(x ?? ''));
	} catch (_) {
		/* fall through */
	}
	return list; // on any parse issue, show originals rather than break the view
}

let _anthropic;
function anthropic() {
	if (_anthropic) return _anthropic;
	if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
	_anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	return _anthropic;
}

/**
 * Stable persona + rules + tool guidance for one client. This is the same on
 * every turn of a conversation, so it's marked cacheable — the retrieved
 * CONTEXT (which changes per question) is sent as a separate system block.
 */
function buildPersona(client, ind) {
	const persona = client.assistant_name
		? `You are ${client.assistant_name}, the customer assistant for ${client.name}.`
		: `You are the customer assistant for ${client.name}.`;

	const profile = [];
	if (client.business_context) profile.push(`About / instructions: ${client.business_context}`);
	if (client.tone) profile.push(`Tone: ${client.tone}.`);
	if (client.business_hours) profile.push(`Business hours: ${client.business_hours}.`);
	if (client.address) profile.push(`Location: ${client.address}.`);

	const fallbackLang = client.languages ? client.languages.split(/[,/]/)[0].trim() : 'English';
	const langRule =
		`Detect the language of the customer's latest message and reply ENTIRELY in that language — match it naturally (e.g. German→German, French→French, Italian→Italian, Spanish→Spanish, Dutch→Dutch, Portuguese→Portuguese, Swahili→Swahili, Arabic→Arabic, Chinese→Chinese). ${ind.langKeep} If a message is too short to tell, reply in ${fallbackLang}.` +
		(client.languages ? ` This business primarily serves: ${client.languages}.` : '');

	const escalationRule = client.escalation
		? `When you can't help or the customer wants a human: ${client.escalation}`
		: `If you don't have a detail, say so and offer to connect them to the team.`;

	const leadRule = client.auto_lead_capture === false
		? "Do not push for contact details unless the customer offers them."
		: 'On buying intent, invite the customer to share their name and a WhatsApp number and/or email, then call create_lead to save it.';

	// The qualification workflow is the industry's sales/intake script — the one
	// deeply vertical part of this prompt, so it comes from the Industry Registry.
	return `${persona}
${profile.join('\n')}

RULES — follow these exactly:
1. Answer ONLY from the verified catalogue (the CONTEXT below and search_knowledge results). No outside knowledge.
2. ${escalationRule} Never guess prices or availability.
3. Never invent products/services/prices. Never recommend a competitor.
4. Be warm and concise. ${langRule}
5. ${leadRule}
6. When the CONTEXT, a tool result, or the knowledge base gives an official link (website, portal, app or page) relevant to the customer's next step, include it as a clickable Markdown link — e.g. [Open the portal](https://example.org) — so it works in chat instead of plain text. Only share links that appear in your verified sources; never invent or guess a URL.

${ind.qualify}`;
}

function contextBlock(chunks) {
	const body = chunks.length ? chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n') : '(no initial matches — use search_knowledge if you need details)';
	return `CONTEXT (initial search results for the latest question):\n${body}`;
}

/**
 * Answer a visitor question, grounded in one client's verified data.
 * @param {{ slug: string, messages: {role:'user'|'assistant', content:string}[], conversationId?: string|null }} args
 * @returns {Promise<{ answer: string, conversationId: string|null, client: { name:string, whatsapp:string|null, brand:string } }>}
 */
export async function answerQuestion({ slug, messages, conversationId = null, source = 'widget', attachment = null, page = null }) {
	// 1. Resolve the tenant. Reject if inactive or the subscription is canceled.
	//    select('*') so optional columns (industry, from migration 016) flow in
	//    when present and are simply absent before the migration — never an error.
	const { data: client, error } = await supabase
		.from('clients')
		.select('*')
		.eq('slug', slug)
		.maybeSingle();

	if (error) throw new Error(`client lookup failed: ${error.message}`);
	if (!client || !client.is_active || client.subscription_status === 'canceled') {
		const err = new Error('client not found or inactive');
		err.status = 404;
		throw err;
	}

	// 1a. Plan gating. The hosted page (source 'hosted') is always available; the
	//     embeddable widget requires the "Website chat widget" plan feature.
	if (source !== 'hosted' && !(await planAllows(client.plan, FEATURE.WIDGET))) {
		const err = new Error('widget not available on this plan');
		err.status = 403;
		throw err;
	}
	// Model tier + which tools are offered follow the plan.
	let model = (await planUnlocks(client.plan, FEATURE.SONNET)) ? SONNET_MODEL : CHAT_MODEL;
	// File attachments (photos/PDFs) are a gated, top-tier capability.
	const attachmentAllowed = attachment && (await planUnlocks(client.plan, FEATURE.ATTACHMENTS));
	const toursAllowed = await planAllows(client.plan, FEATURE.TOURS);
	const summariesAllowed = await planAllows(client.plan, FEATURE.SUMMARIES);
	// The toolset is the industry's (tourism = the original four defs); the
	// structured-catalogue tools stay behind the same plan feature as before.
	const ind = serverIndustry(client);
	const tools = toursAllowed ? ind.tools : ind.tools.filter((t) => t.name !== 'search_tours' && t.name !== 'get_tour_price');

	// 1b. Resolve the conversation. A known id → we're continuing (append + reuse
	//     its summary). Unknown/absent → a new conversation.
	let convoSummary = null;
	let isNewConversation = true;
	if (conversationId) {
		const { data: existing } = await supabase
			.from('conversations')
			.select('id, summary')
			.eq('id', conversationId)
			.eq('client_id', client.id)
			.maybeSingle();
		if (existing) {
			isNewConversation = false;
			convoSummary = existing.summary ?? null;
		} else {
			conversationId = null; // unknown id → start fresh
		}
	}

	// 1c. Soft AI-budget limit, enforced on NEW conversations only — a customer
	//     already mid-chat is never cut off. The tenant keeps operating through
	//     100% and a grace band; only past budget + grace do we pause new chats.
	//     Fails open (budgetStatus returns spent 0 pre-migration), so nothing is
	//     blocked until migration 014 is applied.
	if (isNewConversation) {
		const budget = await budgetStatus(client.id, client.plan);
		// Heads-up email at 80/95/100% (de-duped per month) — never blocks the reply.
		notifyUsageIfCrossed(client.id, budget).catch(() => {});
		if (budget.blocked) {
			return {
				answer:
					"Thanks for your interest! Our assistant has reached its monthly AI allowance. " +
					(client.whatsapp_number
						? 'Please reach us directly on WhatsApp and the team will help you right away.'
						: 'Please try again soon or contact the team directly.'),
				conversationId: null,
				client: { name: client.name, whatsapp: client.whatsapp_number ?? null, brand: client.brand_color ?? '#0f6e56' },
				capped: true
			};
		}
	}

	// 2. Embed the latest user message.
	const lastUser = [...messages].reverse().find((m) => m.role === 'user');
	const question = lastUser?.content?.trim() ?? '';

	let chunks = [];
	if (question) {
		const queryEmbedding = await embedQuery(question, { clientId: client.id, feature: 'embedding' });

		// 3. Retrieve scoped chunks. Isolation is enforced in SQL (match_chunks).
		const { data, error: matchErr } = await supabase.rpc('match_chunks', {
			p_client_id: client.id,
			p_query_embedding: queryEmbedding,
			p_match_count: 5
		});
		if (matchErr) throw new Error(`match_chunks failed: ${matchErr.message}`);
		chunks = data ?? [];
	}

	// 4. Run the agent loop: the model answers, and may call tools
	//    (search_knowledge, create_lead) which the backend executes tenant-scoped.
	const system = [
		{ type: 'text', text: buildPersona(client, ind), cache_control: { type: 'ephemeral' } },
		{ type: 'text', text: contextBlock(chunks) }
	];
	if (convoSummary) {
		system.push({ type: 'text', text: `EARLIER IN THIS CONVERSATION (summary):\n${convoSummary}` });
	}
	// The page the customer is looking at right now (from the embedded widget).
	// Lets the AI answer about the exact page even if it isn't in the knowledge base.
	if (page && (page.title || page.excerpt || page.url)) {
		const head = `The customer is currently viewing this page on the website: ${page.title || ''}${page.url ? ` (${page.url})` : ''}.`.trim();
		system.push({
			type: 'text',
			text: `CURRENT PAGE THE CUSTOMER IS ON:\n${head}${page.excerpt ? `\nPage content:\n${page.excerpt}` : ''}`
		});
	}

	// With a summary in hand, send only the recent turns (the summary covers the
	// rest) to keep long conversations cheap. Keep the slice starting on a user turn.
	let sendMessages = messages;
	if (convoSummary && messages.length > KEEP_RECENT) {
		sendMessages = messages.slice(-KEEP_RECENT);
		while (sendMessages.length && sendMessages[0].role !== 'user') sendMessages = sendMessages.slice(1);
		if (!sendMessages.length) sendMessages = messages.slice(-1);
	}
	const convo = sendMessages.map((m) => ({ role: m.role, content: m.content }));

	// Attach the file (if the plan allows) to the latest user turn as a vision /
	// document content block, and use a vision-capable model to read it.
	if (attachmentAllowed && attachment.data) {
		const block =
			attachment.kind === 'pdf'
				? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: attachment.data } }
				: { type: 'image', source: { type: 'base64', media_type: attachment.mediaType || 'image/jpeg', data: attachment.data } };
		for (let j = convo.length - 1; j >= 0; j--) {
			if (convo[j].role === 'user') {
				const text = typeof convo[j].content === 'string' ? convo[j].content : '';
				convo[j] = { role: 'user', content: [...(text ? [{ type: 'text', text }] : []), block] };
				break;
			}
		}
		model = SONNET_MODEL; // best vision + PDF understanding
	}

	const totals = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
	const addUsage = (u = {}) => {
		totals.input_tokens += u.input_tokens ?? 0;
		totals.output_tokens += u.output_tokens ?? 0;
		totals.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
		totals.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
	};
	let toolCalls = 0;
	let answer = '';
	let lastStop = null;

	for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
		const response = await anthropic().messages.create({
			model,
			max_tokens: 1024,
			system,
			tools,
			messages: convo
		});
		addUsage(response.usage);
		lastStop = response.stop_reason;

		// A non-tool turn is the final answer. Preamble text on a tool turn
		// ("Let me search…") is NOT the answer — ignore it and keep looping.
		if (response.stop_reason !== 'tool_use') {
			answer = extractText(response);
			break;
		}

		const toolUses = response.content.filter((b) => b.type === 'tool_use');
		convo.push({ role: 'assistant', content: response.content });
		const results = [];
		for (const tu of toolUses) {
			toolCalls++;
			const out = await runTool(tu.name, tu.input, { client, transcript: messages });
			results.push({ type: 'tool_result', tool_use_id: tu.id, content: String(out) });
		}
		convo.push({ role: 'user', content: results });
	}

	// If the loop ran out while still calling tools, force a final wrap-up turn
	// (no more tools) so the customer always gets a real answer, never a preamble.
	if (lastStop === 'tool_use') {
		const finalResp = await anthropic().messages.create({
			model,
			max_tokens: 1024,
			system,
			tools,
			tool_choice: { type: 'none' },
			messages: convo
		});
		addUsage(finalResp.usage);
		answer = extractText(finalResp);
	}

	if (!answer) answer = "Sorry — I couldn't put that together just now. Please try again.";

	// 5. Persist the conversation. New → insert (await so we can return the id);
	//    continuing → append the full transcript (fire-and-forget).
	const fullTranscript = [...messages, { role: 'assistant', content: answer }];
	let convId = conversationId;
	if (isNewConversation) {
		const { data, error: insErr } = await supabase
			.from('conversations')
			.insert({ client_id: client.id, messages: fullTranscript })
			.select('id')
			.single();
		if (!insErr) convId = data.id;
		else console.error('[rag] conversation create failed:', insErr.message);
	} else {
		supabase
			.from('conversations')
			.update({ messages: fullTranscript, updated_at: new Date().toISOString() })
			.eq('id', convId)
			.eq('client_id', client.id)
			.then(({ error: e }) => {
				if (e) console.error('[rag] conversation update failed:', e.message);
			});
	}

	// Usage — always logged (even if the conversation insert failed, so spend is
	// never undercounted; conversation_id is nullable). Tag with the surface
	// (widget / hosted / whatsapp) for the usage dashboard; fall back to an
	// untagged row if the feature column isn't migrated. Fire-and-forget.
	const usageRow = {
		client_id: client.id,
		conversation_id: convId,
		model,
		input_tokens: totals.input_tokens,
		cached_tokens: totals.cache_read_input_tokens,
		output_tokens: totals.output_tokens,
		tool_calls: toolCalls,
		estimated_cost: estimateCost(model, totals)
	};
	supabase
		.from('usage_records')
		.insert({ ...usageRow, feature: source || 'widget' })
		.then(({ error: uErr }) => {
			if (uErr) supabase.from('usage_records').insert(usageRow).then(() => {});
		});
	// Rolling summary needs a persisted conversation to attach to.
	if (convId && summariesAllowed) summarizeConversation(client.id, convId, fullTranscript, ind);

	return {
		answer,
		conversationId: convId,
		client: {
			name: client.name,
			whatsapp: client.whatsapp_number ?? null,
			brand: client.brand_color ?? '#0f6e56'
		}
	};
}

/**
 * Ingestion: (re)build the machine side for one knowledge item. Deletes any
 * existing chunks for the item, renders it into structured facts + body chunks
 * (so price and metadata reach retrieval), embeds each as a 'document', and
 * inserts into content_chunks. Called whenever an item is created or edited.
 * @param {{ id:string, client_id:string, title:string, body?:string, category?:string, price_amount?:number, price_currency?:string, metadata?:object }} item
 */
export async function reingestItem(item) {
	// Clear old chunks so edits don't leave stale vectors behind.
	await supabase.from('content_chunks').delete().eq('item_id', item.id);

	const texts = chunkItem(item);
	if (!texts.length) return;

	const vectors = await embed(texts, 'document', { clientId: item.client_id, feature: 'knowledge_index' });

	const rows = texts.map((content, i) => ({
		client_id: item.client_id,
		item_id: item.id,
		content,
		embedding: vectors[i]
	}));

	const { error } = await supabase.from('content_chunks').insert(rows);
	if (error) throw new Error(`chunk insert failed: ${error.message}`);
}
