// WhatsAppCredentialService + WhatsAppTenantResolver.
// The single place that turns "a tenant / a phone number" into ready-to-use sending
// credentials (decrypting the stored token), and that maps an inbound phone_number_id
// to its owning tenant. Everything degrades gracefully to the platform's single
// default number when a tenant hasn't connected its own (or migration 021 isn't run).
import { defaultCredentials, whatsappConfig } from './config.js';
import { getSecretRow, getConnectionByPhoneNumberId } from './connections.js';
import { decrypt } from './crypto.js';
import { log } from './logger.js';

/**
 * Resolve outbound credentials for a tenant (by clientId) or a specific number.
 * @returns {Promise<import('./config.js').WhatsAppCredentials>}
 */
export async function resolveCredentials({ clientId = null, phoneNumberId = null } = {}) {
	try {
		const { row, tableMissing } = await getSecretRow({ clientId, phoneNumberId });
		if (tableMissing || !row || row.status !== 'connected' || !row.encrypted_access_token) return defaultCredentials();
		// Defense-in-depth: getSecretRow resolves by phone_number_id first. If a caller
		// passed BOTH a number and a tenant, the row that number belongs to MUST be that
		// tenant — otherwise routing state is inconsistent and we must not send from
		// another tenant's number/token. Fall back to the platform default instead.
		if (clientId && phoneNumberId && row.client_id !== clientId) {
			log.warn('resolve_credentials_tenant_mismatch', { phoneNumberId, rowClient: row.client_id, wantClient: clientId });
			return defaultCredentials();
		}
		const cfg = whatsappConfig();
		return {
			accessToken: decrypt(row.encrypted_access_token),
			phoneNumberId: row.phone_number_id,
			businessAccountId: row.whatsapp_business_account_id || '',
			apiVersion: cfg.apiVersion,
			graphBase: cfg.graphBase
		};
	} catch (err) {
		log.warn('resolve_credentials_fallback', { error: err?.message });
		return defaultCredentials();
	}
}

/**
 * Which tenant owns an inbound number? Returns { clientId, connection } or null
 * (null → single-number mode; use the default routing).
 */
export async function resolveTenantByPhoneNumberId(phoneNumberId) {
	if (!phoneNumberId) return null;
	const { connection } = await getConnectionByPhoneNumberId(phoneNumberId);
	if (connection && connection.status === 'connected') return { clientId: connection.client_id, connection };
	return null;
}
