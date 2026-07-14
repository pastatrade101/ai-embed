import { fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { PLAN_FEATURES } from '$lib/plans.js';

function slugKey(s) {
	return (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// Only accept feature labels from the known catalogue (checkbox values).
function pickFeatures(form) {
	const known = new Set(PLAN_FEATURES);
	return form.getAll('features').map(String).filter((f) => known.has(f));
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
			price_currency: (String(form.get('price_currency') ?? 'USD').trim().toUpperCase() || 'USD'),
			monthly_conversation_cap: Number(form.get('monthly_conversation_cap') ?? 0) || 0,
			features: pickFeatures(form),
			is_active: form.get('is_active') === 'on'
		};
		if (!key || !patch.name) return fail(400, { error: 'Name is required.' });

		// Update cap on all clients currently on this plan so enforcement stays in sync.
		const { error } = await supabase.from('plans').update(patch).eq('key', key);
		if (error) return fail(400, { error: error.message });
		await supabase.from('clients').update({ monthly_conversation_cap: patch.monthly_conversation_cap }).eq('plan', key);

		// Checking "default for new clients" makes THIS plan the sole default.
		if (form.get('is_default') === 'on') {
			await supabase.from('plans').update({ is_default: false }).neq('key', key);
			await supabase.from('plans').update({ is_default: true }).eq('key', key);
		}
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
			price_currency: (String(form.get('price_currency') ?? 'USD').trim().toUpperCase() || 'USD'),
			monthly_conversation_cap: Number(form.get('monthly_conversation_cap') ?? 200) || 200,
			features: pickFeatures(form),
			sort: 99
		});
		if (error) return fail(400, { section: 'new', error: error.code === '23505' ? `Key "${key}" already exists.` : error.message });
		return { section: 'new', ok: `Created ${name}.` };
	}
};
