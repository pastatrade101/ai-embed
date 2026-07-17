// Operator-only: translate a conversation's messages to English for the inbox.
import { json } from '@sveltejs/kit';
import { translateToEnglish } from '$lib/server/rag.js';
import { getClientById } from '$lib/server/tenant.js';
import { serverIndustry } from '$lib/server/industries.js';

export async function POST({ request, locals }) {
	if (!locals.user?.client_id) return json({ error: 'Not signed in.' }, { status: 401 });
	try {
		const { texts } = await request.json();
		const client = await getClientById(locals.user.client_id).catch(() => null);
		const translations = await translateToEnglish(Array.isArray(texts) ? texts.slice(0, 60) : [], locals.user.client_id, serverIndustry(client));
		return json({ translations });
	} catch (e) {
		return json({ error: e?.message ?? 'Translation failed.' }, { status: 400 });
	}
}
