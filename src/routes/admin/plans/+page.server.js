import { fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';

function slugKey(s) {
	return (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function parseFeatures(s) {
	return String(s ?? '')
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
}

export async function load() {
	const [plansRes, clientsRes] = await Promise.all([
		supabase.from('plans').select('*').order('sort'),
		supabase.from('clients').select('plan')
	]);
	// Count clients on each plan.
	const counts = {};
	for (const c of clientsRes.data ?? []) counts[c.plan] = (counts[c.plan] ?? 0) + 1;
	return { plans: plansRes.data ?? [], counts, loadError: plansRes.error?.message ?? null };
}

export const actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const key = String(form.get('key') ?? '').trim();
		const patch = {
			name: String(form.get('name') ?? '').trim(),
			price_amount: Number(form.get('price_amount') ?? 0) || 0,
			monthly_conversation_cap: Number(form.get('monthly_conversation_cap') ?? 0) || 0,
			features: parseFeatures(form.get('features')),
			is_active: form.get('is_active') === 'on'
		};
		if (!key || !patch.name) return fail(400, { error: 'Name is required.' });

		// Update cap on all clients currently on this plan so enforcement stays in sync.
		const { error } = await supabase.from('plans').update(patch).eq('key', key);
		if (error) return fail(400, { error: error.message });
		await supabase.from('clients').update({ monthly_conversation_cap: patch.monthly_conversation_cap }).eq('plan', key);
		return { ok: `Saved ${patch.name}.` };
	},

	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const key = slugKey(String(form.get('key') ?? '') || name);
		if (!name || !key) return fail(400, { section: 'new', error: 'Name is required.' });
		const { error } = await supabase.from('plans').insert({
			key,
			name,
			price_amount: Number(form.get('price_amount') ?? 0) || 0,
			monthly_conversation_cap: Number(form.get('monthly_conversation_cap') ?? 200) || 200,
			features: parseFeatures(form.get('features')),
			sort: 99
		});
		if (error) return fail(400, { section: 'new', error: error.code === '23505' ? `Key "${key}" already exists.` : error.message });
		return { section: 'new', ok: `Created ${name}.` };
	}
};
