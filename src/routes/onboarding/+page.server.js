// Public self-serve signup: creates a tenant (client) + its operator login on
// the free/default plan, then signs the new operator in. Mirrors the admin
// create-client logic so both paths behave identically.
import { fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { hashPassword } from '$lib/server/password.js';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth.js';

const slugify = (s) => (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const randSuffix = () => Math.random().toString(36).slice(2, 6);

export function load({ locals }) {
	// Already signed in? Skip signup and go to the workspace.
	if (locals.user) throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');
	return {};
}

export const actions = {
	signup: async ({ request, cookies, locals }) => {
		if (locals.user) throw redirect(303, '/portal');
		const form = await request.formData();

		// Honeypot — real users never fill this hidden field; bots do.
		if (String(form.get('company_website') ?? '').trim()) throw redirect(303, '/portal');

		const brandName = String(form.get('brandName') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const region = String(form.get('region') ?? '').trim();
		const tourFocus = String(form.get('tourFocus') ?? '').trim();
		const currency = (String(form.get('currency') ?? 'USD').trim().toUpperCase() || 'USD').slice(0, 8);
		const whatsapp = String(form.get('whatsapp') ?? '').trim();
		const fullName = String(form.get('fullName') ?? '').trim();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');

		const values = { brandName, description, region, tourFocus, currency, whatsapp, fullName, email };
		if (!brandName) return fail(400, { error: 'Please enter your business name.', values });
		if (!email || !/.+@.+\..+/.test(email)) return fail(400, { error: 'Please enter a valid email address.', values });
		if (password.length < 8) return fail(400, { error: 'Password must be at least 8 characters.', values });

		// Login email must be unique across the platform.
		const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
		if (existing) return fail(400, { error: 'That email already has an account — try signing in instead.', values });

		// New tenants start on the free/default plan.
		const { data: plan } = await supabase.from('plans').select('key, monthly_conversation_cap').eq('is_default', true).eq('is_active', true).maybeSingle();
		const planKey = plan?.key ?? 'free';
		const cap = plan?.monthly_conversation_cap ?? 30;

		// Unique slug from the business name.
		let slug = slugify(brandName) || 'operator';
		const { data: taken } = await supabase.from('clients').select('id').eq('slug', slug).maybeSingle();
		if (taken) slug = `${slug}-${randSuffix()}`;

		const context = [description, region ? `Based in ${region}.` : '', tourFocus ? `Tour focus: ${tourFocus}.` : ''].filter(Boolean).join(' ');

		const { data: client, error } = await supabase
			.from('clients')
			.insert({
				slug,
				name: brandName,
				business_type: 'tour operator',
				business_context: context || null,
				whatsapp_number: whatsapp || null,
				lead_email: email,
				default_currency: currency,
				plan: planKey,
				monthly_conversation_cap: cap,
				is_active: true
			})
			.select('id, slug')
			.single();
		if (error) {
			const msg = error.code === '23505' ? 'That business name is taken — try a slightly different one.' : `Could not create your workspace: ${error.message}`;
			return fail(400, { error: msg, values });
		}

		const { error: userErr } = await supabase.from('users').insert({
			email,
			password_hash: hashPassword(password),
			name: fullName || null,
			role: 'operator',
			client_id: client.id
		});
		if (userErr) {
			// Roll back so a failed login doesn't leave an orphan tenant.
			await supabase.from('clients').delete().eq('id', client.id);
			return fail(400, { error: userErr.code === '23505' ? 'That email already has an account.' : `Could not create your login: ${userErr.message}`, values });
		}

		// Sign the new operator in and drop them into their workspace.
		const { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
		if (user) cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
		throw redirect(303, '/portal');
	}
};
