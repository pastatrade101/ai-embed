// The one and only place that talks HTTP to the Meta Graph API. Every sender goes
// through graphRequest() — no duplicated fetch/axios calls anywhere else. Handles
// timeouts, network failures, and 401/403/404/429/5xx with typed errors and
// exponential-backoff retries for the transient ones.
import { log } from './logger.js';

/** Typed error so callers can branch on status/code without string matching. */
export class WhatsAppApiError extends Error {
	constructor(message, { status = 0, code = null, details = null, retryable = false } = {}) {
		super(message);
		this.name = 'WhatsAppApiError';
		this.status = status;
		this.code = code;
		this.details = details;
		this.retryable = retryable;
	}
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function backoffDelay(attempt, retryAfterHeader) {
	const retryAfter = Number(retryAfterHeader);
	if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 30000);
	// 0.5s, 1s, 2s, 4s … capped, with jitter to avoid thundering herds.
	return Math.min(8000, 2 ** (attempt - 1) * 500) + Math.floor(Math.random() * 250);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Perform a Graph API request with retries.
 * @param {object} opts
 * @param {import('./config.js').WhatsAppCredentials} opts.credentials
 * @param {string} opts.path      e.g. `<phoneNumberId>/messages`
 * @param {string} [opts.method]  default POST
 * @param {object} [opts.body]
 * @param {number} [opts.retries] default 3 (transient failures only)
 * @param {number} [opts.timeoutMs] default 15000
 * @returns {Promise<object>} parsed JSON body on success
 * @throws {WhatsAppApiError}
 */
export async function graphRequest({ credentials, path, method = 'POST', body, retries = 3, timeoutMs = 15000 }) {
	if (!credentials?.accessToken || !credentials?.phoneNumberId) {
		throw new WhatsAppApiError('WhatsApp is not configured (missing access token / phone number id).', { code: 'not_configured' });
	}
	const url = `${credentials.graphBase}/${credentials.apiVersion}/${path}`;
	let lastError;

	for (let attempt = 1; attempt <= retries + 1; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, {
				method,
				headers: {
					Authorization: `Bearer ${credentials.accessToken}`,
					'Content-Type': 'application/json'
				},
				body: body ? JSON.stringify(body) : undefined,
				signal: controller.signal
			});
			// Read the body BEFORE clearing the timer — fetch() resolves on headers, so
			// the abort timer must still cover res.text() or a stalled body escapes timeoutMs.
			const rawText = await res.text();
			clearTimeout(timer);

			let json;
			try {
				json = rawText ? JSON.parse(rawText) : {};
			} catch {
				json = { raw: rawText };
			}

			if (res.ok) return json;

			const apiError = json?.error || {};
			const status = res.status;
			const retryable = RETRYABLE_STATUS.has(status);
			log.warn('graph_api_error', { status, code: apiError.code, subcode: apiError.error_subcode, message: apiError.message, attempt, path });

			if (retryable && attempt <= retries) {
				await sleep(backoffDelay(attempt, res.headers.get('retry-after')));
				continue;
			}
			// 401 (auth), 403 (permission), 404 (not found), non-retryable 4xx, or
			// retries exhausted — surface a typed error.
			throw new WhatsAppApiError(apiError.message || `WhatsApp API error (HTTP ${status})`, {
				status,
				code: apiError.code ?? null,
				details: apiError,
				retryable
			});
		} catch (err) {
			clearTimeout(timer);
			if (err instanceof WhatsAppApiError) throw err;
			const isTimeout = err?.name === 'AbortError';
			lastError = new WhatsAppApiError(isTimeout ? 'WhatsApp request timed out' : `Network error: ${err?.message || err}`, {
				code: isTimeout ? 'timeout' : 'network',
				retryable: true
			});
			log.warn('graph_transport_error', { kind: isTimeout ? 'timeout' : 'network', attempt, path });
			if (attempt <= retries) {
				await sleep(backoffDelay(attempt));
				continue;
			}
			throw lastError;
		}
	}
	throw lastError || new WhatsAppApiError('WhatsApp request failed', { code: 'unknown' });
}
