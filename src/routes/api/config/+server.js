// GET /api/config?client=slug  -> public widget config (welcome message,
// suggested questions, brand, assistant name, whatsapp, auto-lead-capture).
// Called by the widget on load so it can greet before the first message.
import { supabase } from '$lib/server/supabase.js';
import { preflight, jsonCors } from '$lib/server/cors.js';

export function OPTIONS() {
	return preflight();
}

export async function GET({ url }) {
	const slug = url.searchParams.get('client');
	if (!slug) return jsonCors({ error: 'client is required' }, 400);

	const { data: client } = await supabase
		.from('clients')
		.select('name, assistant_name, logo_url, brand_color, whatsapp_number, welcome_message, suggested_questions, auto_lead_capture, is_active, subscription_status')
		.eq('slug', slug)
		.maybeSingle();

	if (!client || !client.is_active || client.subscription_status === 'canceled') {
		return jsonCors({ error: 'client not found' }, 404);
	}

	return jsonCors({
		name: client.name,
		assistantName: client.assistant_name ?? null,
		logo: client.logo_url ?? null,
		brand: client.brand_color ?? '#0f6e56',
		whatsapp: client.whatsapp_number ?? null,
		welcome: client.welcome_message ?? null,
		suggestions: Array.isArray(client.suggested_questions) ? client.suggested_questions.slice(0, 6) : [],
		autoLeadCapture: client.auto_lead_capture !== false
	});
}
