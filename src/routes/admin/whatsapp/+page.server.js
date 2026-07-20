// Admin ▸ WhatsApp — a test bench to fire a real WhatsApp notification and see the
// exact Meta result. Super-admin only (enforced by hooks for /admin/*). Sends go
// through the NotificationService like everything else — this proves the whole chain.
import { fail } from '@sveltejs/kit';
import { whatsappConfig, isConfigured } from '$lib/server/whatsapp/config.js';
import { NotificationService, Channel } from '$lib/server/notifications.js';

// Config status WITHOUT leaking secret values — booleans + non-secret ids only.
function status() {
	const c = whatsappConfig();
	return {
		configured: isConfigured(),
		accessToken: !!c.accessToken,
		phoneNumberId: c.phoneNumberId || null, // an id, not a secret — helps confirm the number
		businessAccountId: !!c.businessAccountId,
		verifyToken: !!c.verifyToken,
		appSecret: !!c.appSecret,
		apiVersion: c.apiVersion
	};
}

export function load() {
	return { status: status() };
}

const cleanPhone = (v) => String(v ?? '').replace(/[^0-9]/g, '');

export const actions = {
	// Free-text message. Works inside the 24h customer-service window; outside it,
	// Meta requires a template (use the template action below).
	sendText: async ({ request }) => {
		const form = await request.formData();
		const to = cleanPhone(form.get('to'));
		const text = String(form.get('text') ?? '').trim();
		if (!to) return fail(422, { section: 'text', error: 'Enter a recipient number in international format (e.g. 255700000000).' });
		if (!text) return fail(422, { section: 'text', error: 'Enter a message.' });
		const result = await NotificationService.send({ channel: Channel.WHATSAPP, type: 'text', to, text });
		return { section: 'text', to, result };
	},

	// Template message — the reliable first test on the Meta test number. `hello_world`
	// is the default approved template on every WABA.
	sendTemplate: async ({ request }) => {
		const form = await request.formData();
		const to = cleanPhone(form.get('to'));
		const name = String(form.get('name') ?? 'hello_world').trim() || 'hello_world';
		const language = String(form.get('language') ?? 'en_US').trim() || 'en_US';
		if (!to) return fail(422, { section: 'template', error: 'Enter a recipient number in international format (e.g. 255700000000).' });
		const result = await NotificationService.send({ channel: Channel.WHATSAPP, type: 'template', to, name, language });
		return { section: 'template', to, result };
	}
};
