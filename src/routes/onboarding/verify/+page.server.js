// Public self-serve signup — step 2 of 2. The email link lands here. We verify
// the signed token, provision the tenant (client + operator login) on the free
// plan, sign the operator in, and drop them into their workspace. Because the
// account is created only now, a confirmed email is a hard prerequisite.
import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { readSignupToken } from '$lib/server/signup-token.js';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth.js';
import { industryOf } from '$lib/industries.js';

const slugify = (s) => (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const randSuffix = () => Math.random().toString(36).slice(2, 6);

export async function load({ url, cookies, locals }) {
	if (locals.user) throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');

	const payload = readSignupToken(url.searchParams.get('token'));
	if (!payload) {
		return { error: 'This confirmation link is invalid or has expired. Please sign up again to get a fresh link.' };
	}

	const { brandName, description, region, tourFocus, currency, whatsapp, fullName, email, passwordHash } = payload;
	if (!brandName || !email || !passwordHash) {
		return { error: 'This confirmation link is missing information. Please sign up again.' };
	}
	// Industry chosen at signup; tokens from before the industry step (or with an
	// unknown key) resolve to the default (tourism) exactly as before.
	const ind = industryOf(payload.industry);

	// If they already confirmed (double-click, re-open) or the email got claimed
	// meanwhile, don't create a duplicate — send them to sign in.
	const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
	if (existing) throw redirect(303, '/login?verified=1');

	// New tenants start on the free/default plan.
	const { data: plan } = await supabase
		.from('plans')
		.select('key, monthly_conversation_cap')
		.eq('is_default', true)
		.eq('is_active', true)
		.maybeSingle();
	const planKey = plan?.key ?? 'free';
	const cap = plan?.monthly_conversation_cap ?? 30;

	// Unique slug from the business name.
	let slug = slugify(brandName) || 'operator';
	const { data: taken } = await supabase.from('clients').select('id').eq('slug', slug).maybeSingle();
	if (taken) slug = `${slug}-${randSuffix()}`;

	const context = [description, region ? `Based in ${region}.` : '', tourFocus ? `${ind.onboarding.contextLabel}: ${tourFocus}.` : '']
		.filter(Boolean)
		.join(' ');

	const row = {
		slug,
		name: brandName,
		business_type: ind.businessType,
		business_context: context || null,
		whatsapp_number: whatsapp || null,
		lead_email: email,
		default_currency: (String(currency || 'USD').toUpperCase() || 'USD').slice(0, 8),
		plan: planKey,
		monthly_conversation_cap: cap,
		is_active: true
	};
	// Include the industry key when the column exists (migration 016); retry
	// without it ONLY on the missing-column error so signup keeps working on
	// databases that haven't migrated yet — a transient failure on a migrated DB
	// must surface rather than silently provisioning the default industry.
	const missingColumn = (e) => e && (e.code === 'PGRST204' || /industry|schema cache/i.test(e.message ?? ''));
	let { data: client, error } = await supabase
		.from('clients')
		.insert({ ...row, industry: ind.key })
		.select('id')
		.single();
	if (missingColumn(error)) {
		({ data: client, error } = await supabase.from('clients').insert(row).select('id').single());
	}
	if (error) {
		return { error: `We couldn't finish setting up your workspace: ${error.message}. Please try signing up again.` };
	}

	const { data: user, error: userErr } = await supabase
		.from('users')
		.insert({
			email,
			password_hash: passwordHash, // already hashed at signup time
			name: fullName || null,
			role: 'operator',
			client_id: client.id
		})
		.select('id')
		.single();
	if (userErr || !user) {
		// Roll back so a failed login doesn't leave an orphan tenant.
		await supabase.from('clients').delete().eq('id', client.id);
		if (userErr?.code === '23505') throw redirect(303, '/login?verified=1');
		return { error: `We couldn't finish creating your login: ${userErr?.message ?? 'unknown error'}. Please try signing up again.` };
	}

	// Email confirmed and tenant live — sign them in.
	cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
	throw redirect(303, '/portal');
}
