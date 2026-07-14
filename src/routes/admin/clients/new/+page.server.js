import { fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { hashPassword, generatePassword } from '$lib/server/password.js';

function slugify(s) {
	return (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function load() {
	const { data: plans } = await supabase.from('plans').select('*').eq('is_active', true).order('sort');
	const list = plans ?? [];
	const defaultPlan = list.find((p) => p.is_default)?.key ?? list[0]?.key ?? 'free';
	return { plans: list, defaultPlan };
}

export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = slugify(String(form.get('slug') ?? '') || name);
		const business_type = String(form.get('business_type') ?? '').trim() || null;
		const business_context = String(form.get('business_context') ?? '').trim() || null;
		const whatsapp_number = String(form.get('whatsapp_number') ?? '').trim() || null;
		const lead_email = String(form.get('lead_email') ?? '').trim() || null;
		let planKey = String(form.get('plan') ?? '').trim();
		if (!planKey) {
			const { data: def } = await supabase.from('plans').select('key').eq('is_default', true).eq('is_active', true).maybeSingle();
			planKey = def?.key ?? 'free';
		}

		// Operator login — now created with every client. The login email is the
		// username; the password is auto-generated when the admin leaves it blank.
		const opEmail = String(form.get('operator_email') ?? '').trim().toLowerCase();
		let opPassword = String(form.get('operator_password') ?? '');
		const opName = String(form.get('operator_name') ?? '').trim() || null;

		const values = { name, slug, business_type, business_context, whatsapp_number, lead_email, plan: planKey, operator_email: opEmail, operator_name: opName };

		if (!name || !slug) return fail(400, { error: 'Business name and slug are required.', values });
		if (!opEmail) return fail(400, { error: 'A login email (username) is required — the client signs in with it.', values });
		if (opPassword && opPassword.length < 8) return fail(400, { error: 'Password must be at least 8 characters (or leave it blank to auto-generate).', values });
		if (!opPassword) opPassword = generatePassword();

		// Reject a duplicate login up front so we don't create an orphan client.
		const { data: existing } = await supabase.from('users').select('id').eq('email', opEmail).maybeSingle();
		if (existing) return fail(400, { error: `The email "${opEmail}" is already in use by another login.`, values });

		// Cap follows the chosen plan.
		const { data: plan } = await supabase.from('plans').select('key, monthly_conversation_cap').eq('key', planKey).maybeSingle();

		const { data: client, error } = await supabase
			.from('clients')
			.insert({
				slug,
				name,
				business_type,
				business_context,
				whatsapp_number,
				lead_email,
				plan: plan?.key ?? planKey,
				monthly_conversation_cap: plan?.monthly_conversation_cap ?? 30
			})
			.select('id, slug, name')
			.single();

		if (error) {
			const msg = error.code === '23505' ? `Slug "${slug}" is already taken.` : error.message;
			return fail(400, { error: msg, values });
		}

		const { error: userErr } = await supabase.from('users').insert({
			email: opEmail,
			password_hash: hashPassword(opPassword),
			name: opName,
			role: 'operator',
			client_id: client.id
		});
		if (userErr) {
			// Roll back the client so a failed login doesn't leave a half-created tenant.
			await supabase.from('clients').delete().eq('id', client.id);
			const msg = userErr.code === '23505' ? `The email "${opEmail}" is already in use.` : `Login could not be created: ${userErr.message}`;
			return fail(400, { error: msg, values });
		}

		// Success — return the credentials so the admin can copy them ONCE
		// (the password is hashed and can't be shown again). No redirect.
		return {
			created: {
				slug: client.slug,
				name: client.name,
				email: opEmail,
				password: opPassword
			}
		};
	}
};
