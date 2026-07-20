// Admin ▸ WhatsApp ▸ Conversations — the live WhatsApp Proposal Assistant threads
// across all tenants. View the conversation, its linked proposal, AI/human status and
// 24-hour window, and take over (pause AI) or resume. Super-admin only (hooks).
import { fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { isMissingWaTable, setAiEnabled, closeConversation } from '$lib/server/wa-conversations.js';

const SELECT =
	'id, client_id, proposal_id, customer_phone, status, ai_enabled, assigned_to, window_expires_at, last_customer_at, last_ai_at, messages, meta, created_at, updated_at, clients(name), proposals(number, total, currency, status, version)';

export async function load() {
	const { data, error } = await supabase.from('wa_conversations').select(SELECT).order('updated_at', { ascending: false }).limit(100);
	if (error) return { conversations: [], needsMigration: isMissingWaTable(error) };
	const conversations = (data ?? []).map((c) => ({
		id: c.id,
		clientName: c.clients?.name || '—',
		proposalNumber: c.proposals?.number || null,
		proposalTotal: c.proposals?.total ?? null,
		proposalCurrency: c.proposals?.currency || '',
		proposalVersion: c.proposals?.version ?? 1,
		customerPhone: c.customer_phone,
		status: c.status,
		aiEnabled: c.ai_enabled,
		windowExpiresAt: c.window_expires_at,
		lastCustomerAt: c.last_customer_at,
		updatedAt: c.updated_at,
		escalation: c.meta?.escalation || null,
		messages: Array.isArray(c.messages) ? c.messages.slice(-40) : [],
		timeline: Array.isArray(c.meta?.timeline) ? c.meta.timeline.slice(-20) : []
	}));
	return { conversations, needsMigration: false };
}

export const actions = {
	toggleAi: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const enabled = String(form.get('enabled') ?? '') === 'true';
		if (!id) return fail(400, { error: 'Missing conversation.' });
		const res = await setAiEnabled(id, enabled);
		return { ok: enabled ? 'AI resumed.' : 'You’ve taken over — AI paused.', updated: !!res };
	},
	close: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing conversation.' });
		await closeConversation(id);
		return { ok: 'Conversation closed.' };
	}
};
