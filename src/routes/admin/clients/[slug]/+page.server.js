import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { hashPassword } from '$lib/server/password.js';
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
	return { client, ...workspace, plans: plansRes.data ?? [], operators: usersRes.data ?? [] };
}

export const actions = {
	updateClient: async ({ request, params }) => {
		const client = await requireClient(params.slug);
		return updateClientSettings(client.id, await request.formData(), { allowAdmin: true });
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
