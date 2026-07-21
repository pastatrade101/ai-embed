// POST /api/whatsapp/connect  { code, wabaId, phoneNumberId }
// Called by the Embedded Signup popup flow in the browser after Meta returns the
// authorization code. Operator session required (the cookie is the CSRF guard); the
// code is exchanged server-side and the token is stored encrypted — never returned.
import { json } from '@sveltejs/kit';
import { connectFromCode } from '$lib/server/whatsapp/embedded-signup.js';
import { embeddedSignupReady } from '$lib/server/whatsapp/config.js';

export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user || (user.role !== 'operator' && user.role !== 'super_admin') || !user.client_id) {
		return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	}
	if (!embeddedSignupReady()) {
		return json({ ok: false, error: 'WhatsApp Embedded Signup is not configured on the server (META_APP_ID / META_APP_SECRET / META_CONFIG_ID / WHATSAPP_ENC_KEY).' }, { status: 503 });
	}
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}
	// Only the code is required — the server discovers the WABA + phone number from the
	// token when the browser didn't provide them (e.g. Meta's "Reconnect" flow).
	if (!body.code) {
		return json({ ok: false, error: 'Missing authorization code (was the popup completed?).' }, { status: 422 });
	}
	const res = await connectFromCode({ clientId: user.client_id, code: body.code, wabaId: body.wabaId || null, phoneNumberId: body.phoneNumberId || null });
	return json(res, { status: res.ok ? 200 : res.status && res.status >= 400 ? 502 : 400 });
}
