// WhatsAppConnectionRepository — persistence for per-tenant WhatsApp credentials.
// Tokens are encrypted at rest; callers get the token only via the credential service.
// FAILS OPEN before migration 021 (returns null with tableMissing:true).
import { supabase } from '../supabase.js';
import { encrypt } from './crypto.js';
import { log } from './logger.js';

// Public (non-secret) columns — the encrypted token is NEVER returned to the UI/callers.
const PUBLIC_COLS = 'id, client_id, meta_business_id, whatsapp_business_account_id, phone_number_id, display_phone_number, verified_name, token_expires_at, status, connected_at, created_at, updated_at';

export const CONNECTION_STATUS = Object.freeze({
	CONNECTED: 'connected',
	DISCONNECTED: 'disconnected',
	PENDING_VERIFICATION: 'pending_verification',
	PERMISSION_REVOKED: 'permission_revoked',
	EXPIRED_TOKEN: 'expired_token',
	PHONE_NUMBER_REMOVED: 'phone_number_removed',
	WEBHOOK_ERROR: 'webhook_error'
});

export function isMissingConnections(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	return /\b42P01\b|PGRST205|could not find the table|relation "?whatsapp_connections"? does not exist/i.test(m);
}

/** Insert or update the connection for a phone number (unique). Token encrypted here. */
export async function upsertConnection(clientId, { metaBusinessId, wabaId, phoneNumberId, displayPhoneNumber, verifiedName, accessToken, tokenExpiresAt }) {
	const row = {
		client_id: clientId,
		meta_business_id: metaBusinessId || null,
		whatsapp_business_account_id: wabaId || null,
		phone_number_id: phoneNumberId,
		display_phone_number: displayPhoneNumber || null,
		verified_name: verifiedName || null,
		encrypted_access_token: encrypt(accessToken),
		token_expires_at: tokenExpiresAt || null,
		status: CONNECTION_STATUS.CONNECTED,
		connected_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};
	const { data, error } = await supabase.from('whatsapp_connections').upsert(row, { onConflict: 'phone_number_id' }).select(PUBLIC_COLS).single();
	if (error) return { connection: null, tableMissing: isMissingConnections(error), error };
	log.info('connection_upserted', { clientId, phoneNumberId, verifiedName });
	return { connection: data };
}

/** The active connection for a tenant (public fields only). */
export async function getConnectionByClient(clientId) {
	const { data, error } = await supabase.from('whatsapp_connections').select(PUBLIC_COLS).eq('client_id', clientId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
	if (error) return { connection: null, tableMissing: isMissingConnections(error) };
	return { connection: data ?? null };
}

/** Public connection for a phone number (routing/UI). */
export async function getConnectionByPhoneNumberId(phoneNumberId) {
	const { data, error } = await supabase.from('whatsapp_connections').select(PUBLIC_COLS).eq('phone_number_id', phoneNumberId).maybeSingle();
	if (error) return { connection: null, tableMissing: isMissingConnections(error) };
	return { connection: data ?? null };
}

/** INTERNAL: the encrypted token row for a phone number (credential service only). */
export async function getSecretRow({ clientId, phoneNumberId }) {
	let q = supabase.from('whatsapp_connections').select('client_id, phone_number_id, whatsapp_business_account_id, encrypted_access_token, status').limit(1);
	if (phoneNumberId) q = q.eq('phone_number_id', phoneNumberId);
	else if (clientId) q = q.eq('client_id', clientId).order('updated_at', { ascending: false });
	else return { row: null };
	const { data, error } = await q.maybeSingle();
	if (error) return { row: null, tableMissing: isMissingConnections(error) };
	return { row: data ?? null };
}

export async function setStatus(id, status) {
	const { data } = await supabase.from('whatsapp_connections').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select(PUBLIC_COLS).maybeSingle();
	return data ?? null;
}

/** Disconnect a tenant's connection (kept for audit; status flipped). */
export async function disconnectClient(clientId) {
	const { error } = await supabase.from('whatsapp_connections').update({ status: CONNECTION_STATUS.DISCONNECTED, updated_at: new Date().toISOString() }).eq('client_id', clientId);
	return { ok: !error };
}
