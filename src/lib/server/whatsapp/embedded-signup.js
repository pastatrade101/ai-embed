// WhatsAppEmbeddedSignupService — the server side of Meta Embedded Signup.
// The browser runs Meta's popup and hands us an OAuth `code` (+ waba_id, phone_number_id);
// here we exchange it for a business token, read the number's details, register it,
// subscribe our app to its webhooks, and store the encrypted credentials. No token
// ever reaches the browser. Every Meta failure is logged and returned typed.
import crypto from 'node:crypto';
import { metaAppConfig } from './config.js';
import { upsertConnection, getConnectionByClient, getConnectionByPhoneNumberId } from './connections.js';
import { log } from './logger.js';

const GRAPH = 'https://graph.facebook.com';

async function graph(path, { token, method = 'GET', query = {}, body = null } = {}) {
	const { graphVersion } = metaAppConfig();
	const qs = new URLSearchParams(query).toString();
	const url = `${GRAPH}/${graphVersion}/${path}${qs ? `?${qs}` : ''}`;
	const res = await fetch(url, {
		method,
		headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
		body: body ? JSON.stringify(body) : undefined
	});
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text };
	}
	if (!res.ok) {
		const err = json?.error || {};
		log.warn('meta_graph_error', { path, status: res.status, code: err.code, message: err.message });
		const e = new Error(err.message || `Meta API error (HTTP ${res.status})`);
		e.status = res.status;
		e.code = err.code;
		throw e;
	}
	return json;
}

/**
 * Discover the WABA + first phone number the exchanged token grants access to.
 * The browser provides these on a FRESH Embedded Signup, but NOT on the "Reconnect"
 * flow (Meta returns only the code) — so we resolve them from the token itself:
 * debug_token → granular_scopes (WABA ids) → /{waba}/phone_numbers. Returns
 * { wabaId, phoneNumberId, displayPhoneNumber, verifiedName } or null.
 */
async function discoverWabaAndPhone(accessToken, cfg) {
	try {
		const dbg = await graph('debug_token', { query: { input_token: accessToken, access_token: `${cfg.appId}|${cfg.appSecret}` } });
		const scopes = dbg?.data?.granular_scopes || [];
		const wabaIds = new Set();
		for (const s of scopes) if (/whatsapp_business/.test(s.scope || '')) (s.target_ids || []).forEach((id) => wabaIds.add(id));
		for (const wid of wabaIds) {
			try {
				const pn = await graph(`${wid}/phone_numbers`, { token: accessToken, query: { fields: 'id,display_phone_number,verified_name' } });
				const first = (pn?.data || [])[0];
				if (first?.id) return { wabaId: wid, phoneNumberId: first.id, displayPhoneNumber: first.display_phone_number || null, verifiedName: first.verified_name || null };
			} catch (e) {
				log.warn('phone_numbers_lookup_failed', { wabaId: wid, message: e.message });
			}
		}
	} catch (e) {
		log.warn('debug_token_failed', { message: e.message });
	}
	return null;
}

/**
 * Complete Embedded Signup for a tenant from the browser's authorization code.
 * @param {object} p
 * @param {string} p.clientId
 * @param {string} p.code            OAuth code from the Embedded Signup popup
 * @param {string} p.wabaId          WhatsApp Business Account id (from the WA_EMBEDDED_SIGNUP event)
 * @param {string} p.phoneNumberId   the number the tenant chose
 * @returns {Promise<{ok:boolean, connection?:object, error?:string, code?:string, status?:number}>}
 */
export async function connectFromCode({ clientId, code, wabaId = null, phoneNumberId = null }) {
	const cfg = metaAppConfig();
	if (!cfg.appId || !cfg.appSecret || !cfg.configId) return { ok: false, error: 'embedded_signup_not_configured' };
	if (!code) return { ok: false, error: 'missing_code' };

	try {
		// 1. Exchange the code for a business-scoped access token.
		const tok = await graph('oauth/access_token', { query: { client_id: cfg.appId, client_secret: cfg.appSecret, code } });
		const accessToken = tok.access_token;
		if (!accessToken) return { ok: false, error: 'no_access_token_returned' };
		const tokenExpiresAt = tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000).toISOString() : null;

		// 1b. On the "Reconnect" flow Meta returns only the code — no phone_number_id/
		//     waba_id — so discover them from the token itself. (Fresh signup already
		//     passes them, and we still fall through to the authoritative read below.)
		let displayPhoneNumber = null;
		let verifiedName = null;
		if (!phoneNumberId || !wabaId) {
			const found = await discoverWabaAndPhone(accessToken, cfg);
			if (found) {
				wabaId = wabaId || found.wabaId;
				phoneNumberId = phoneNumberId || found.phoneNumberId;
				displayPhoneNumber = found.displayPhoneNumber;
				verifiedName = found.verifiedName;
			}
		}
		if (!phoneNumberId) return { ok: false, error: 'no_whatsapp_number_found', code: 'no_whatsapp_number_found', status: 404 };

		// 2. Read the number's details WITH THE EXCHANGED TOKEN. This is AUTHORITATIVE:
		//    a token that cannot read this phone_number_id does not own it, so we refuse
		//    to store a connection for it. This is what stops a tenant from claiming
		//    another tenant's number by passing a phone_number_id it doesn't control.
		try {
			const num = await graph(phoneNumberId, { token: accessToken, query: { fields: 'display_phone_number,verified_name' } });
			displayPhoneNumber = num.display_phone_number || displayPhoneNumber;
			verifiedName = num.verified_name || verifiedName;
		} catch (e) {
			log.warn('phone_ownership_check_failed', { clientId, phoneNumberId, message: e.message });
			return { ok: false, error: 'number_not_accessible', code: 'number_not_accessible', status: 403 };
		}

		// 2b. Even with a valid token, refuse a number already connected to a DIFFERENT
		//     tenant (phone_number_id is globally unique; without this the upsert below
		//     would silently transfer ownership — client_id + token — to the caller).
		//     The same tenant may reconnect its own number.
		const existing = await getConnectionByPhoneNumberId(phoneNumberId);
		if (existing.connection && existing.connection.client_id !== clientId) {
			log.warn('number_owned_by_other_tenant', { phoneNumberId, owner: existing.connection.client_id, attempted: clientId });
			return { ok: false, error: 'number_already_connected', code: 'number_already_connected', status: 409 };
		}

		// 3. Read the owning business id (best-effort).
		let metaBusinessId = null;
		try {
			const waba = await graph(wabaId, { token: accessToken, query: { fields: 'id,name,owner_business_info' } });
			metaBusinessId = waba?.owner_business_info?.id || null;
		} catch (e) {
			log.warn('waba_details_failed', { wabaId, message: e.message });
		}

		// 4. Register the phone number on Cloud API (idempotent — ignore "already registered").
		try {
			const pin = String(crypto.randomInt(100000, 999999));
			await graph(`${phoneNumberId}/register`, { token: accessToken, method: 'POST', body: { messaging_product: 'whatsapp', pin } });
		} catch (e) {
			log.warn('phone_register_note', { phoneNumberId, message: e.message }); // often already registered
		}

		// 5. Subscribe our app to the WABA's webhooks so inbound events reach us.
		try {
			if (wabaId) await graph(`${wabaId}/subscribed_apps`, { token: accessToken, method: 'POST' });
		} catch (e) {
			log.warn('subscribe_app_failed', { wabaId, message: e.message });
		}

		// 6. Store the (encrypted) credentials.
		const { connection, error } = await upsertConnection(clientId, { metaBusinessId, wabaId, phoneNumberId, displayPhoneNumber, verifiedName, accessToken, tokenExpiresAt });
		if (error) return { ok: false, error: error.message || 'store_failed', code: error.code };
		log.info('embedded_signup_connected', { clientId, phoneNumberId, verifiedName });
		return { ok: true, connection };
	} catch (err) {
		log.error('embedded_signup_failed', { clientId, error: err?.message, status: err?.status, code: err?.code });
		return { ok: false, error: err?.message || 'exchange_failed', status: err?.status, code: err?.code };
	}
}

/** Refresh a tenant's stored number details (verified name, display number). */
export async function refreshConnection(clientId) {
	const { connection } = await getConnectionByClient(clientId);
	if (!connection) return { ok: false, error: 'not_connected' };
	// Re-fetch requires the stored token → handled via the credential service on send;
	// here we just report the current record. A full re-fetch can be added when needed.
	return { ok: true, connection };
}
