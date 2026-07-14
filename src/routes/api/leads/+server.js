// POST /api/leads  { clientSlug, name, whatsapp, email, interest, transcript } -> { ok: true }
// Saves the lead FIRST, then best-effort emails the operator via Resend.
// A failed email never loses a saved lead.
import { supabase } from '$lib/server/supabase.js';
import { sendLeadEmail } from '$lib/server/email.js';
import { preflight, jsonCors } from '$lib/server/cors.js';

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

	const { clientSlug, name, whatsapp, email, interest, transcript } = payload ?? {};
	if (!clientSlug) return jsonCors({ error: 'clientSlug is required' }, 400);
	if (!whatsapp && !email) return jsonCors({ error: 'whatsapp or email required' }, 400);

	// Resolve the tenant.
	const { data: client } = await supabase
		.from('clients')
		.select('id, name, lead_email, is_active')
		.eq('slug', clientSlug)
		.maybeSingle();

	if (!client || !client.is_active) return jsonCors({ error: 'client not found' }, 404);

	// 1. Save the lead — the part that must not fail silently.
	const { error: insertErr } = await supabase.from('leads').insert({
		client_id: client.id,
		name: name ?? null,
		whatsapp: whatsapp ?? null,
		email: email ?? null,
		interest: interest ?? null,
		transcript: Array.isArray(transcript) ? transcript : null
	});

	if (insertErr) {
		console.error('[api/leads] insert failed:', insertErr.message);
		return jsonCors({ error: 'could not save lead' }, 500);
	}

	// 2. Best-effort notify the operator. Never fails the request.
	try {
		await sendLeadEmail({
			to: client.lead_email,
			businessName: client.name,
			lead: { name, whatsapp, email, interest }
		});
	} catch (err) {
		console.error('[api/leads] email failed (lead still saved):', err?.message ?? err);
	}

	return jsonCors({ ok: true });
}
