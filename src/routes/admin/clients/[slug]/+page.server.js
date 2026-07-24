import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { hashPassword } from '$lib/server/password.js';
import { AVG_COST_PER_CONVERSATION } from '$lib/server/credits.js';
import { clientPackState, sanitizeToolPacks } from '$lib/server/tool-packs.js';
import {
	getClientBySlug,
	loadWorkspace,
	addKnowledge,
	updateKnowledge,
	deleteKnowledge,
	importKnowledge,
	addDeparture,
	deleteDeparture,
	updateClientSettings
} from '$lib/server/tenant.js';

async function requireClient(slug) {
	const client = await getClientBySlug(slug);
	if (!client) throw error(404, 'Client not found');
	return client;
}

export async function load({ params }) {
	const client = await requireClient(params.slug);
	const [workspace, plansRes, usersRes] = await Promise.all([
		loadWorkspace(client.id),
		supabase.from('plans').select('*').order('sort'),
		supabase.from('users').select('id, email, name, role, last_login_at, created_at').eq('client_id', client.id).order('created_at')
	]);
	return {
		client,
		...workspace,
		plans: plansRes.data ?? [],
		operators: usersRes.data ?? [],
		costPerConversation: AVG_COST_PER_CONVERSATION,
		// Institution tool packs (assign/shut down live-data connectors per client).
		toolPacks: clientPackState(client)
	};
}

export const actions = {
	updateClient: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return updateClientSettings(client.id, await request.formData(), { allowAdmin: true });
	},

	// Dedicated one-click plan change (upgrade or downgrade to ANY plan). Sets the
	// plan + its conversation cap and activates the subscription.
	changePlan: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		const form = await request.formData();
		const planKey = String(form.get('plan') ?? '').trim();
		const { data: plan } = await supabase.from('plans').select('key, name, monthly_conversation_cap').eq('key', planKey).maybeSingle();
		if (!plan) return fail(400, { section: 'plan', error: 'Unknown plan.' });

		const { error: err } = await supabase
			.from('clients')
			.update({ plan: plan.key, monthly_conversation_cap: plan.monthly_conversation_cap, subscription_status: 'active' })
			.eq('id', client.id);
		if (err) return fail(400, { section: 'plan', error: err.message });

		// Audit trail (best-effort; needs db/007_payments.sql).
		await supabase.from('payment_events').insert({
			client_id: client.id,
			provider: 'manual',
			event_type: 'plan_changed_by_admin',
			status: 'active',
			event_payload: { plan_key: plan.key, from: client.plan }
		});
		return { section: 'plan', ok: `${client.name} is now on ${plan.name}.` };
	},
	// Assign / shut down institution tool packs for this client (super-admin only —
	// the whole /admin tree is guarded to super_admin in hooks.server.js).
	updateToolPacks: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		const form = await request.formData();
		const packs = sanitizeToolPacks(form.get('tool_packs'));
		const { error: err } = await supabase.from('clients').update({ tool_packs: packs }).eq('id', client.id);
		if (err) {
			const pending = /(column|schema cache)/i.test(err.message); // migration 030 not run yet
			return fail(400, { section: 'tools', error: pending ? 'Run db/030_tool_packs.sql in Supabase to enable per-client tool assignment.' : err.message });
		}
		return { section: 'tools', ok: 'Tool access updated.' };
	},
	addItem: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return addKnowledge(client.id, await request.formData());
	},
	updateItem: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return updateKnowledge(client.id, await request.formData());
	},
	deleteItem: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return deleteKnowledge(client.id, await request.formData());
	},
	bulkImport: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return importKnowledge(client.id, await request.formData());
	},
	addDeparture: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return addDeparture(client.id, await request.formData());
	},
	deleteDeparture: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return deleteDeparture(client.id, await request.formData());
	},

	// ---- Operator login administration ----
	addOperator: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const name = String(form.get('name') ?? '').trim() || null;
		if (!email) return fail(400, { section: 'access', error: 'Email is required.' });
		if (password.length < 8) return fail(400, { section: 'access', error: 'Password must be at least 8 characters.' });

		const { error: err } = await supabase.from('users').insert({
			email,
			password_hash: hashPassword(password),
			name,
			role: 'operator',
			client_id: client.id
		});
		if (err) return fail(400, { section: 'access', error: err.code === '23505' ? `Email "${email}" is already in use.` : err.message });
		return { section: 'access', ok: `Login created for ${email}.` };
	},
	resetPassword: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const password = String(form.get('password') ?? '');
		if (password.length < 8) return fail(400, { section: 'access', error: 'Password must be at least 8 characters.' });
		const { error: err } = await supabase
			.from('users')
			.update({ password_hash: hashPassword(password) })
			.eq('id', id)
			.eq('client_id', client.id);
		if (err) return fail(400, { section: 'access', error: err.message });
		return { section: 'access', ok: 'Password reset.' };
	},
	deleteOperator: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const { error: err } = await supabase.from('users').delete().eq('id', id).eq('client_id', client.id);
		if (err) return fail(400, { section: 'access', error: err.message });
		return { section: 'access', ok: 'Login removed.' };
	}
};
