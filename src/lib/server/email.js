// Best-effort lead notification via Resend. A failed email must never lose a
// saved lead, so callers should treat any error here as non-fatal.
import { env } from '$env/dynamic/private';

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Generic send. Returns { ok, skipped?, status? }; callers treat failures as
 * non-fatal. `replyTo` lets the operator's own address receive replies.
 * @param {{ to:string, subject:string, text:string, replyTo?:string }} args
 */
export async function sendEmail({ to, subject, text, replyTo }) {
	if (!env.RESEND_API_KEY || !to) return { ok: false, skipped: true };
	const res = await fetch(RESEND_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${env.RESEND_API_KEY}`
		},
		body: JSON.stringify({
			from: 'Makutano <hello@makutano.digital>',
			to: [to],
			subject,
			text,
			...(replyTo ? { reply_to: replyTo } : {})
		})
	});
	return { ok: res.ok, status: res.status };
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

	const res = await fetch(RESEND_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${env.RESEND_API_KEY}`
		},
		body: JSON.stringify({
			from: 'Makutano <leads@makutano.digital>',
			to: [to],
			subject: `New lead — ${businessName}`,
			text: lines.join('\n')
		})
	});

	return { ok: res.ok, status: res.status };
}
