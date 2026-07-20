// WhatsAppConversationService + ConversationMemoryService.
// One thread per (customer number ↔ proposal). Stores the CRM history, AI memory,
// the 24h free-text window, and human-takeover/escalation state. FAILS OPEN before
// migration 020 (every read/write returns null/[] with tableMissing=true so the
// assistant just logs instead of crashing the webhook).
import { supabase } from './supabase.js';
import { log } from './whatsapp/logger.js';

const COLS = 'id, client_id, proposal_id, lead_id, customer_phone, phone_number_id, status, ai_enabled, assigned_to, window_expires_at, last_customer_at, last_ai_at, messages, meta, created_at, updated_at';
const WINDOW_MS = 24 * 60 * 60 * 1000;

export function isMissingWaTable(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	// Specific to a missing table: 42P01 (undefined_table), PGRST205 (no such table
	// in the schema cache), or the wa_conversations relation being absent. Avoid the
	// generic "does not exist" (that also matches column errors) so a transient error
	// isn't mis-shown as "run migration 020".
	return /\b42P01\b|PGRST205|could not find the table|relation "?wa_conversations"? does not exist/i.test(m);
}

export const normalizePhone = (v) => String(v ?? '').replace(/[^0-9]/g, '');

/** Create a thread for a proposal being sent to a customer. */
export async function createConversation({ clientId, proposalId, leadId = null, customerPhone, phoneNumberId = null }) {
	const row = {
		client_id: clientId,
		proposal_id: proposalId || null,
		lead_id: leadId,
		customer_phone: normalizePhone(customerPhone),
		phone_number_id: phoneNumberId,
		status: 'active',
		ai_enabled: true,
		messages: [],
		meta: { timeline: [] }
	};
	const { data, error } = await supabase.from('wa_conversations').insert(row).select(COLS).single();
	if (error) return { conversation: null, tableMissing: isMissingWaTable(error), error };
	return { conversation: data };
}

/** The active thread for a phone number (most recent, any tenant).
 *  NOTE: on a single shared WABA test number, inbound messages carry only the
 *  customer's phone — so if the SAME customer has open threads with two tenants,
 *  the most-recent wins. This is inherent to a shared number; per-tenant WhatsApp
 *  numbers (config.credentialsFor + resolveTenantByPhoneNumberId) disambiguate it
 *  in production. It never leaks data across tenants — the resolved thread's own
 *  client_id scopes everything downstream. */
export async function getByPhone(customerPhone) {
	const { data, error } = await supabase
		.from('wa_conversations')
		.select(COLS)
		.eq('customer_phone', normalizePhone(customerPhone))
		.not('status', 'eq', 'closed')
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) return { conversation: null, tableMissing: isMissingWaTable(error) };
	return { conversation: data ?? null };
}

/** Existing thread for a specific proposal + phone (avoid duplicates). */
export async function getForProposal(proposalId, customerPhone) {
	const { data, error } = await supabase
		.from('wa_conversations')
		.select(COLS)
		.eq('proposal_id', proposalId)
		.eq('customer_phone', normalizePhone(customerPhone))
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) return { conversation: null, tableMissing: isMissingWaTable(error) };
	return { conversation: data ?? null };
}

export async function getConversation(clientId, id) {
	const { data, error } = await supabase.from('wa_conversations').select(COLS).eq('id', id).eq('client_id', clientId).maybeSingle();
	if (error) return { conversation: null, tableMissing: isMissingWaTable(error) };
	return { conversation: data ?? null };
}

/** Admin list for a client (most recently active first). */
export async function listConversations(clientId, { limit = 100 } = {}) {
	const { data, error } = await supabase.from('wa_conversations').select(COLS).eq('client_id', clientId).order('updated_at', { ascending: false }).limit(limit);
	if (error) return { conversations: [], tableMissing: isMissingWaTable(error) };
	return { conversations: data ?? [] };
}

/** Append a message and bump the relevant timestamps. Opening the free-text window
 *  is a customer-message side effect (WhatsApp's 24h rule). */
export async function appendMessage(conv, { role, text, kind = 'text', meta = {} }) {
	const now = new Date();
	const messages = Array.isArray(conv.messages) ? conv.messages.slice(-200) : [];
	messages.push({ role, text: text ?? '', kind, at: now.toISOString(), meta });
	const patch = { messages, updated_at: now.toISOString() };
	if (role === 'customer') {
		patch.last_customer_at = now.toISOString();
		patch.window_expires_at = new Date(now.getTime() + WINDOW_MS).toISOString(); // (re)open the 24h window
	}
	if (role === 'ai' || role === 'agent') patch.last_ai_at = now.toISOString();
	const { data, error } = await supabase.from('wa_conversations').update(patch).eq('id', conv.id).select(COLS).single();
	if (error) {
		log.error('wa_append_failed', { convId: conv.id, error: error.message });
		return conv;
	}
	return data;
}

/** True if the WhatsApp 24-hour free-text window is currently open. */
export function windowOpen(conv) {
	return !!(conv?.window_expires_at && new Date(conv.window_expires_at).getTime() > Date.now());
}

/** Minutes left in the window (0 if closed). */
export function windowMinutesLeft(conv) {
	if (!conv?.window_expires_at) return 0;
	const ms = new Date(conv.window_expires_at).getTime() - Date.now();
	return ms > 0 ? Math.round(ms / 60000) : 0;
}

async function patchConversation(id, patch) {
	const { data, error } = await supabase.from('wa_conversations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(COLS).single();
	if (error) return null;
	return data;
}

export const setAiEnabled = (id, enabled) => patchConversation(id, { ai_enabled: !!enabled, status: enabled ? 'active' : 'paused' });
export const assignAgent = (id, userId) => patchConversation(id, { assigned_to: userId, ai_enabled: false, status: 'paused' });
export const closeConversation = (id) => patchConversation(id, { status: 'closed' });

/** Mark a thread escalated: stop the AI, flag for a human, record the reason. */
export async function escalate(conv, reason) {
	const meta = { ...(conv.meta || {}), escalation: { reason, at: new Date().toISOString() } };
	return patchConversation(conv.id, { status: 'escalated', ai_enabled: false, meta });
}

/** Append a CRM timeline entry (proposal sent, delivered, read, replied, modified…). */
export async function addTimeline(conv, type, meta = {}) {
	const timeline = Array.isArray(conv.meta?.timeline) ? conv.meta.timeline : [];
	timeline.push({ type, at: new Date().toISOString(), meta });
	return patchConversation(conv.id, { meta: { ...(conv.meta || {}), timeline } });
}
