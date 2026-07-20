// NotificationService — the single entry point every module uses to reach a
// customer or operator. Modules and the AI must call NotificationService.send()
// rather than any channel SDK directly, so channels, retries, logging and (future)
// per-tenant routing live in one place.
//
// Channels: WhatsApp is implemented now; Email delegates to the existing Resend
// helper; SMS / Push / In-App are declared and stubbed for later.
import { env } from '$env/dynamic/private';
import * as whatsapp from '$lib/server/whatsapp/index.js';
import { isConfigured as whatsappConfigured } from '$lib/server/whatsapp/config.js';
import { log } from '$lib/server/whatsapp/logger.js';
import { sendEmail } from '$lib/server/email.js';

export const Channel = Object.freeze({
	WHATSAPP: 'whatsapp',
	EMAIL: 'email',
	SMS: 'sms',
	PUSH: 'push',
	IN_APP: 'in_app'
});

// Map a notification `type` to the right WhatsApp sender. Keeps the switch in one spot.
function sendWhatsApp(payload) {
	const { type = 'text' } = payload;
	switch (type) {
		case 'text':
			return whatsapp.sendText(payload);
		case 'template':
			return whatsapp.sendTemplate(payload);
		case 'image':
			return whatsapp.sendImage(payload);
		case 'document':
			return whatsapp.sendDocument(payload);
		case 'pdf':
			return whatsapp.sendPdf(payload);
		case 'interactive':
		case 'buttons':
			return whatsapp.sendInteractiveButtons(payload);
		case 'list':
			return whatsapp.sendList(payload);
		default:
			throw new Error(`Unsupported WhatsApp notification type: ${type}`);
	}
}

export const NotificationService = {
	/**
	 * Send a notification on a channel.
	 * @param {object} msg
	 * @param {import('./whatsapp/types.js').NotificationChannel} [msg.channel]
	 * @returns {Promise<{ok:boolean, channel:string, skipped?:boolean, reason?:string, messageId?:string|null, error?:string}>}
	 */
	async send({ channel = Channel.WHATSAPP, ...payload } = {}) {
		try {
			switch (channel) {
				case Channel.WHATSAPP: {
					if (!whatsappConfigured()) {
						log.warn('skip_whatsapp_unconfigured', { to: payload.to, type: payload.type });
						return { ok: false, channel, skipped: true, reason: 'whatsapp_not_configured' };
					}
					const res = await sendWhatsApp(payload);
					return { ok: res.ok, channel, messageId: res.messageId, result: res };
				}
				case Channel.EMAIL: {
					const res = await sendEmail({ to: payload.to, subject: payload.subject, text: payload.text, html: payload.html, replyTo: payload.replyTo });
					return { ok: !!res?.ok, channel, skipped: res?.skipped, result: res };
				}
				case Channel.SMS:
				case Channel.PUSH:
				case Channel.IN_APP:
					// Declared surface; implement when those providers are wired.
					log.info('channel_not_implemented', { channel });
					return { ok: false, channel, skipped: true, reason: 'channel_not_implemented' };
				default:
					return { ok: false, channel, error: `Unknown channel: ${channel}` };
			}
		} catch (err) {
			log.error('notification_failed', { channel, type: payload.type, error: err?.message, code: err?.code, status: err?.status });
			return { ok: false, channel, error: err?.message, code: err?.code, status: err?.status };
		}
	}
};

/** Guard for the manual /api/notifications/* endpoints: a logged-in operator/admin,
 *  or a server-to-server call carrying the shared INTERNAL_API_KEY. */
export function notifyAuthorized(event) {
	const user = event?.locals?.user;
	if (user && (user.role === 'operator' || user.role === 'super_admin')) return true;
	const key = event?.request?.headers?.get('x-internal-key');
	return !!(env.INTERNAL_API_KEY && key && key === env.INTERNAL_API_KEY);
}
