// High-level message senders. Each builds the Graph payload for one message type and
// dispatches it through the shared client. Callers normally go through the
// NotificationService rather than importing these directly.
//
// Every function accepts an optional `credentials` (from config.credentialsFor(tenant))
// and falls back to the platform default — this is what makes it multi-tenant-ready.
import { graphRequest } from './client.js';
import { defaultCredentials } from './config.js';
import { log } from './logger.js';

/**
 * @typedef {Object} OutboundResult
 * @property {boolean} ok
 * @property {string|null} messageId
 * @property {string|null} waId
 * @property {string} to
 * @property {string} type
 * @property {object} raw
 */

function normalize(res, to, type) {
	const messageId = res?.messages?.[0]?.id ?? null;
	const waId = res?.contacts?.[0]?.wa_id ?? null;
	return { ok: !!messageId, messageId, waId, to, type, raw: res };
}

async function dispatch(payload, { credentials, to, type }) {
	const creds = credentials || defaultCredentials();
	const res = await graphRequest({ credentials: creds, path: `${creds.phoneNumberId}/messages`, body: { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload } });
	const out = normalize(res, to, type);
	log.info('message_sent', { to, type, messageId: out.messageId });
	return out;
}

/** 3. Plain text. */
export function sendText({ to, text, previewUrl = false, credentials } = {}) {
	return dispatch({ to, type: 'text', text: { body: String(text ?? ''), preview_url: !!previewUrl } }, { credentials, to, type: 'text' });
}

/**
 * 4. Template message.
 * @param {object} p
 * @param {string} p.to
 * @param {string} p.name              template name registered in Meta
 * @param {string} [p.language]        BCP-47 code, default 'en_US'
 * @param {Array}  [p.components]      full components array (advanced)
 * @param {Array}  [p.parameters]      shortcut: body text params (strings or {type,...})
 */
export function sendTemplate({ to, name, language = 'en_US', components, parameters, credentials } = {}) {
	const template = { name, language: { code: language } };
	if (Array.isArray(components) && components.length) template.components = components;
	else if (Array.isArray(parameters) && parameters.length) {
		template.components = [{ type: 'body', parameters: parameters.map((p) => (typeof p === 'string' ? { type: 'text', text: p } : p)) }];
	}
	return dispatch({ to, type: 'template', template }, { credentials, to, type: 'template' });
}

/** 5. Image — by hosted `link` (https) or previously-uploaded media `id`. */
export function sendImage({ to, link, id, caption, credentials } = {}) {
	const image = id ? { id } : { link };
	if (caption) image.caption = caption;
	return dispatch({ to, type: 'image', image }, { credentials, to, type: 'image' });
}

/** 7. Document (PDF, docx, xlsx…) — by `link` or media `id`, with an optional filename. */
export function sendDocument({ to, link, id, filename, caption, credentials } = {}) {
	const document = id ? { id } : { link };
	if (filename) document.filename = filename;
	if (caption) document.caption = caption;
	return dispatch({ to, type: 'document', document }, { credentials, to, type: 'document' });
}

/** 6. PDF — a thin wrapper over sendDocument used for quotations/invoices. */
export function sendPdf({ to, link, id, filename = 'document.pdf', caption, credentials } = {}) {
	const name = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
	return sendDocument({ to, link, id, filename: name, caption, credentials });
}

/**
 * 8. Interactive reply buttons (max 3).
 * @param {object} p
 * @param {Array<{id?:string,title:string}>} p.buttons
 */
export function sendInteractiveButtons({ to, body, buttons = [], header, footer, credentials } = {}) {
	const action = {
		buttons: buttons.slice(0, 3).map((b, i) => ({ type: 'reply', reply: { id: b.id || `btn_${i + 1}`, title: String(b.title ?? '').slice(0, 20) } }))
	};
	const interactive = { type: 'button', body: { text: String(body ?? '') }, action };
	if (header) interactive.header = { type: 'text', text: String(header).slice(0, 60) };
	if (footer) interactive.footer = { text: String(footer).slice(0, 60) };
	return dispatch({ to, type: 'interactive', interactive }, { credentials, to, type: 'interactive.buttons' });
}

/**
 * 9. List message.
 * @param {object} p
 * @param {string} p.button   the list-opener label (≤20 chars)
 * @param {Array<{title:string, rows:Array<{id:string,title:string,description?:string}>}>} p.sections
 */
export function sendList({ to, body, button = 'Choose', sections = [], header, footer, credentials } = {}) {
	const interactive = { type: 'list', body: { text: String(body ?? '') }, action: { button: String(button).slice(0, 20), sections } };
	if (header) interactive.header = { type: 'text', text: String(header).slice(0, 60) };
	if (footer) interactive.footer = { text: String(footer).slice(0, 60) };
	return dispatch({ to, type: 'interactive', interactive }, { credentials, to, type: 'interactive.list' });
}

/** Mark an inbound message as read (nice-to-have for the AI-reply flow later). */
export function markRead({ messageId, credentials } = {}) {
	const creds = credentials || defaultCredentials();
	return graphRequest({ credentials: creds, path: `${creds.phoneNumberId}/messages`, body: { messaging_product: 'whatsapp', status: 'read', message_id: messageId } });
}
