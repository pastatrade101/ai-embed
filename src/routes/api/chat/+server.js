// POST /api/chat  { clientSlug, messages[] } -> { answer, client:{name,whatsapp,brand} }
// Called cross-origin by the embed widget.
import { answerQuestion } from '$lib/server/rag.js';
import { corsHeaders, preflight, jsonCors } from '$lib/server/cors.js';

export function OPTIONS() {
	return preflight();
}

export async function POST({ request }) {
	let payload;
	try {
		payload = await request.json();
	} catch {
		return jsonCors({ error: 'invalid JSON' }, 400);
	}

	const { clientSlug, messages, conversationId } = payload ?? {};
	if (!clientSlug || !Array.isArray(messages) || messages.length === 0) {
		return jsonCors({ error: 'clientSlug and messages[] are required' }, 400);
	}

	// A conversation id, if present, must be a plain string (a UUID from the DB).
	const convId = typeof conversationId === 'string' && conversationId ? conversationId : null;

	// Keep only the fields we trust from the client.
	const clean = messages
		.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
		.map((m) => ({ role: m.role, content: m.content }));

	if (!clean.length) return jsonCors({ error: 'no valid messages' }, 400);

	try {
		const result = await answerQuestion({ slug: clientSlug, messages: clean, conversationId: convId });
		return jsonCors(result);
	} catch (err) {
		const status = err?.status ?? 500;
		if (status === 404) return jsonCors({ error: 'client not found' }, 404);
		console.error('[api/chat] error:', err?.message ?? err);
		return jsonCors({ error: 'assistant unavailable' }, 500);
	}
}

// Ensure this route is treated as an API endpoint with CORS on any method.
export const fallback = ({ request }) =>
	request.method === 'OPTIONS'
		? preflight()
		: new Response('method not allowed', { status: 405, headers: corsHeaders });
