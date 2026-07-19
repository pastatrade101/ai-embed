// Best-effort lead notification via Resend. A failed email must never lose a
// saved lead, so callers should treat any error here as non-fatal.
import { env } from '$env/dynamic/private';

const RESEND_URL = 'https://api.resend.com/emails';

// Resend only accepts a `from` on a domain you've VERIFIED in your account.
// Set RESEND_FROM to a sender on your verified domain (e.g. "Makutano
// <notifications@makutano.co.tz>"); the default below matches the platform's.
function fromAddress() {
	return env.RESEND_FROM || 'Makutano <notifications@makutano.co.tz>';
}

/**
 * Generic send. Returns { ok, skipped?, status? }; callers treat failures as
 * non-fatal. `html` renders a rich email (with `text` as the plain-text
 * fallback); `replyTo` lets the operator's own address receive replies.
 * @param {{ to:string, subject:string, text:string, html?:string, replyTo?:string }} args
 */
export async function sendEmail({ to, subject, text, html, replyTo }) {
	if (!env.RESEND_API_KEY || !to) return { ok: false, skipped: true };
	// Non-fatal: a network error must never bubble out and 500 the caller.
	try {
		const res = await fetch(RESEND_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				'user-agent': 'Makutano/1.0'
			},
			body: JSON.stringify({
				from: fromAddress(),
				to: [to],
				subject,
				text,
				...(html ? { html } : {}),
				...(replyTo ? { reply_to: replyTo } : {})
			})
		});
		return { ok: res.ok, status: res.status };
	} catch (e) {
		return { ok: false, error: true, message: String(e?.message ?? e) };
	}
}

/** Escape user-supplied values before interpolating into email HTML. */
export function escapeHtml(s) {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * A clean, on-brand HTML email — table layout + inline styles so it renders in
 * Gmail, Outlook, Apple Mail, etc. Pass a call-to-action `button` and the raw
 * link is tucked away as a small copy-paste fallback instead of a giant URL.
 * @param {{ preheader?:string, heading:string, body?:string[], button?:{label:string,url:string}, footer?:string }} args
 */
export function brandedEmail({ preheader = '', heading, body = [], button = null, footer = '' }) {
	const paras = body
		.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#33433d;">${p}</p>`)
		.join('');
	const btn = button
		? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td align="center" bgcolor="#0f6e56" style="border-radius:10px;">` +
			`<a href="${button.url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(button.label)}</a>` +
			`</td></tr></table>`
		: '';
	const fallback = button
		? `<p style="margin:0 0 4px;font-size:12px;color:#9aa79f;">Or paste this link into your browser:</p>` +
			`<p style="margin:0 0 8px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${button.url}" style="color:#0f6e56;">${button.url}</a></p>`
		: '';
	return (
		`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>` +
		`<body style="margin:0;padding:0;background:#f4f2ee;">` +
		`<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:32px 16px;"><tr><td align="center">` +
		`<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e6e3dc;overflow:hidden;">` +
		`<tr><td style="background:#10362a;padding:20px 32px;"><span style="font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">Makutano <span style="color:#e0b24c;">AI</span></span></td></tr>` +
		`<tr><td style="padding:30px 32px 26px;font-family:Helvetica,Arial,sans-serif;">` +
		`<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#12332a;font-weight:800;">${escapeHtml(heading)}</h1>` +
		paras +
		btn +
		fallback +
		(footer ? `<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#9aa79f;border-top:1px solid #eef0ec;padding-top:16px;">${footer}</p>` : '') +
		`</td></tr></table>` +
		`<p style="margin:18px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#a9b4ac;">© Makutano AI · Your AI sales assistant</p>` +
		`</td></tr></table></body></html>`
	);
}

/**
 * Notify the operator that a new lead came in.
 * @param {{ to:string, businessName:string, lead:{name?:string,whatsapp?:string,email?:string,interest?:string} }} args
 */
export async function sendLeadEmail({ to, businessName, lead }) {
	if (!env.RESEND_API_KEY || !to) return { ok: false, skipped: true };

	const lines = [
		`New lead for ${businessName}:`,
		'',
		`Name:     ${lead.name ?? '—'}`,
		`WhatsApp: ${lead.whatsapp ?? '—'}`,
		`Email:    ${lead.email ?? '—'}`,
		`Interest: ${lead.interest ?? '—'}`
	];

	try {
		const res = await fetch(RESEND_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${env.RESEND_API_KEY}`,
				'user-agent': 'Makutano/1.0'
			},
			body: JSON.stringify({
				from: fromAddress(),
				to: [to],
				subject: `New lead — ${businessName}`,
				text: lines.join('\n')
			})
		});
		return { ok: res.ok, status: res.status };
	} catch (e) {
		return { ok: false, error: true };
	}
}
