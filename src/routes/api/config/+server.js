// GET /api/config?client=slug  -> public widget config (welcome message,
// suggested questions, brand, assistant name, whatsapp, auto-lead-capture).
// Called by the widget on load so it can greet before the first message.
import { supabase } from '$lib/server/supabase.js';
import { preflight, jsonCors } from '$lib/server/cors.js';
import { FEATURE, planAllows, planUnlocks } from '$lib/server/gating.js';
import { listTours } from '$lib/server/tours.js';
import { suggestionChips } from '$lib/server/suggest.js';

const metaDest = (md) => {
	if (!md || typeof md !== 'object') return null;
	for (const k of Object.keys(md)) {
		if (/destination|route|park|location/i.test(k)) {
			const v = md[k];
			if (v != null && String(v).trim()) return String(v).trim();
		}
	}
	return null;
};

export function OPTIONS() {
	return preflight();
}

export async function GET({ url }) {
	const slug = url.searchParams.get('client');
	if (!slug) return jsonCors({ error: 'client is required' }, 400);

	const { data: client } = await supabase
		.from('clients')
		.select('id, name, plan, assistant_name, logo_url, brand_color, whatsapp_number, welcome_message, suggested_questions, auto_lead_capture, is_active, subscription_status')
		.eq('slug', slug)
		.maybeSingle();

	if (!client || !client.is_active || client.subscription_status === 'canceled') {
		return jsonCors({ error: 'client not found' }, 404);
	}

	// The embeddable widget requires the "Website chat widget" plan feature — when
	// the plan omits it, the widget won't initialise (the hosted page still works).
	if (!(await planAllows(client.plan, FEATURE.WIDGET))) {
		return jsonCors({ error: 'widget not available on this plan' }, 403);
	}

	// Derive starter chips from the catalogue only when the operator hasn't set
	// their own (saves a query when they have).
	const configured = (Array.isArray(client.suggested_questions) ? client.suggested_questions : []).filter((s) => s && String(s).trim());
	let tours = [];
	if (!configured.length) {
		try {
			tours = (await listTours(client.id)).map((t) => ({ title: t.title, destination: metaDest(t.metadata) }));
		} catch {
			/* tours are a bonus; fall back to generic chips */
		}
	}

	return jsonCors({
		name: client.name,
		assistantName: client.assistant_name ?? null,
		logo: client.logo_url ?? null,
		brand: client.brand_color ?? '#0f6e56',
		whatsapp: client.whatsapp_number ?? null,
		welcome: client.welcome_message ?? null,
		suggestions: suggestionChips(client.suggested_questions, tours),
		autoLeadCapture: client.auto_lead_capture !== false,
		hideBranding: await planUnlocks(client.plan, FEATURE.NO_BADGE)
	});
}
