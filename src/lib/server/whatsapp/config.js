// WhatsApp Cloud API configuration. Reads everything from environment variables —
// nothing is hardcoded. Server-only ($lib/server), so access tokens never reach the
// browser. Designed for a multi-tenant / multi-WABA future: callers ask for the
// credentials of a given tenant, which fall back to the platform default here.
import { env } from '$env/dynamic/private';

export const DEFAULT_API_VERSION = 'v21.0';
export const GRAPH_BASE = 'https://graph.facebook.com';

/** Raw platform config from env. */
export function whatsappConfig() {
	return {
		accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
		phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
		businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
		verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
		appSecret: env.WHATSAPP_APP_SECRET || '',
		apiVersion: env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION,
		graphBase: GRAPH_BASE
	};
}

/** True once the minimum secrets to SEND are present. Notifications no-op until then. */
export function isConfigured() {
	const c = whatsappConfig();
	return !!(c.accessToken && c.phoneNumberId);
}

/**
 * @typedef {Object} WhatsAppCredentials
 * @property {string} accessToken
 * @property {string} phoneNumberId
 * @property {string} businessAccountId
 * @property {string} apiVersion
 * @property {string} graphBase
 */

/** The platform's default sending credentials (single WABA today). */
export function defaultCredentials() {
	const c = whatsappConfig();
	return {
		accessToken: c.accessToken,
		phoneNumberId: c.phoneNumberId,
		businessAccountId: c.businessAccountId,
		apiVersion: c.apiVersion,
		graphBase: c.graphBase
	};
}

/**
 * Resolve the WhatsApp credentials for a tenant. Store per-tenant overrides in
 * `clients.meta.whatsapp` ({ phone_number_id, access_token, business_account_id,
 * api_version }); anything missing falls back to the platform default. This is the
 * single seam that makes the module multi-tenant without touching callers.
 * @param {object|null} tenant
 * @returns {WhatsAppCredentials}
 */
export function credentialsFor(tenant = null) {
	const d = defaultCredentials();
	const wa = tenant?.meta?.whatsapp || tenant?.whatsapp || null;
	if (!wa) return d;
	return {
		accessToken: wa.access_token || d.accessToken,
		phoneNumberId: wa.phone_number_id || d.phoneNumberId,
		businessAccountId: wa.business_account_id || d.businessAccountId,
		apiVersion: wa.api_version || d.apiVersion,
		graphBase: d.graphBase
	};
}

/**
 * Reverse lookup for inbound webhooks in a multi-WABA future: map the incoming
 * `phone_number_id` to the owning tenant so replies use the right credentials.
 * Single-account today → null (dispatch uses the default). Wire this to a
 * `clients` lookup on `meta.whatsapp.phone_number_id` when you go multi-number.
 * @param {string} _phoneNumberId
 * @returns {Promise<object|null>}
 */
export async function resolveTenantByPhoneNumberId(_phoneNumberId) {
	return null;
}
