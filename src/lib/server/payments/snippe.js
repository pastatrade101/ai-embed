// Snippe adapter (https://docs.snippe.sh, API version 2026-01-25). Ported from
// the Pastatrade backend. Uses hosted Payment Sessions so Makutano never handles
// card / mobile-money credentials. Config comes from env at runtime:
//   SNIPPE_API_KEY, SNIPPE_WEBHOOK_SECRET, SNIPPE_BASE_URL (default api.snippe.sh)
//   PUBLIC_APP_URL / ORIGIN — public origin, used to build the webhook callback.
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const PAID = new Set(['completed', 'paid', 'success', 'successful', 'succeeded']);

/** Fresh config each call (dynamic runtime env). */
function cfg() {
	const publicUrl = (env.PUBLIC_APP_URL || env.ORIGIN || '').replace(/\/+$/, '');
	return {
		apiKey: env.SNIPPE_API_KEY || '',
		webhookSecret: env.SNIPPE_WEBHOOK_SECRET || '',
		baseUrl: (env.SNIPPE_BASE_URL || 'https://api.snippe.sh').replace(/\/+$/, ''),
		webhookUrl: publicUrl ? `${publicUrl}/api/payments/webhook/snippe` : ''
	};
}

export function snippeConfigured() {
	return Boolean(env.SNIPPE_API_KEY);
}

function err(message, status = 400) {
	const e = new Error(message);
	e.status = status;
	return e;
}

export const snippeProvider = {
	name: 'snippe',

	/**
	 * Create a hosted checkout session.
	 * @param {{ clientId:string, userId:string, planKey:string, planName:string,
	 *   amount:number, currency:string, interval:string,
	 *   customer:{name?:string,email?:string,phone?:string}, successUrl:string }} input
	 * @returns {Promise<{ provider:string, reference:string, checkout_url:string }>}
	 */
	async createCheckout(input) {
		const s = cfg();
		const amount = Math.round(input.amount);
		// Snippe's minimum is 500 (TZS). A plan priced in USD (e.g. 49) trips this —
		// surface a clear message instead of a raw provider error.
		if (amount < 500) {
			throw err(
				`Snippe requires a minimum amount of 500. This plan is ${amount} ${input.currency} — price it in TZS to sell it via Snippe.`,
				400
			);
		}

		const isPack = input.kind === 'credit_pack';
		const payload = {
			amount,
			currency: input.currency,
			customer: { name: input.customer.name, email: input.customer.email, phone: input.customer.phone },
			redirect_url: input.successUrl,
			description: isPack ? `Makutano AI Credits — ${input.planName}` : `Makutano ${input.planName} (${input.interval})`,
			// Echoed back on the webhook so we know who/what to activate or credit.
			metadata: isPack
				? { client_id: input.clientId, user_id: input.userId, kind: 'credit_pack', pack_key: input.packKey }
				: { client_id: input.clientId, user_id: input.userId, plan_key: input.planKey, interval: input.interval, kind: 'subscription' },
			expires_in: 3600
		};
		// Snippe rejects non-public webhook URLs. In dev (http://localhost) omit it
		// and rely on the webhook configured in the Snippe dashboard.
		if (s.webhookUrl.startsWith('https://')) payload.webhook_url = s.webhookUrl;

		let res, text = '';
		try {
			res = await fetch(`${s.baseUrl}/api/v1/sessions`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${s.apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			text = await res.text();
		} catch (e) {
			console.error('[snippe] network error creating session:', e);
			throw err('Could not reach Snippe to start checkout.', 502);
		}

		let jsonBody = {};
		try {
			jsonBody = text ? JSON.parse(text) : {};
		} catch {
			/* non-JSON response body */
		}

		if (!res.ok || !jsonBody?.data?.checkout_url) {
			const detail = jsonBody?.message || jsonBody?.error || jsonBody?.data?.message || text || `HTTP ${res.status}`;
			console.error(`[snippe] session create failed (${res.status}):`, detail);
			throw err(`Snippe checkout failed (${res.status}): ${detail}`, 502);
		}

		return { provider: 'snippe', reference: jsonBody.data.reference ?? '', checkout_url: jsonBody.data.checkout_url };
	},

	/**
	 * Verify a webhook via HMAC-SHA256 over `{timestamp}.{rawBody}`. Rejects events
	 * older than 5 minutes (replay protection). rawBody MUST be the exact bytes.
	 */
	verifyWebhook(rawBody, headers) {
		const s = cfg();
		const signature = headers['x-webhook-signature'];
		const timestamp = headers['x-webhook-timestamp'];
		if (!s.webhookSecret || !signature || !timestamp) return false;

		const ts = Number(timestamp);
		if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

		const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
		const expected = crypto.createHmac('sha256', s.webhookSecret).update(`${timestamp}.${body}`).digest('hex');
		const a = Buffer.from(signature, 'utf8');
		const b = Buffer.from(expected, 'utf8');
		return a.length === b.length && crypto.timingSafeEqual(a, b);
	},

	/** Normalize a Snippe event to a provider-agnostic shape. */
	parseEvent(body) {
		const e = body ?? {};
		return {
			id: e.id ?? '',
			type: e.type ?? 'unknown',
			status: e.data?.status ?? '',
			reference: e.data?.reference ?? '',
			amount: e.data?.amount?.value ?? null,
			currency: e.data?.amount?.currency ?? null,
			metadata: e.data?.metadata ?? {},
			raw: body
		};
	},

	/** Pull the live session status (used by the "verify my payment" fallback). */
	async fetchStatus(reference) {
		if (!reference) return null;
		const s = cfg();
		try {
			const res = await fetch(`${s.baseUrl}/api/v1/sessions/${encodeURIComponent(reference)}`, {
				headers: { Authorization: `Bearer ${s.apiKey}`, accept: 'application/json' }
			});
			const text = await res.text();
			if (!res.ok) return null;
			const jsonBody = text ? JSON.parse(text) : {};
			const status = (jsonBody?.data?.status ?? '').toLowerCase();
			return { reference, status, paid: PAID.has(status), metadata: jsonBody?.data?.metadata ?? {} };
		} catch {
			return null;
		}
	}
};
