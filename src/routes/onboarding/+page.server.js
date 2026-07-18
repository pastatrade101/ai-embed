// Public self-serve signup — step 1 of 2. Validates the form, then emails a
// signed verification link. NO tenant is created here: the whole signup payload
// (with the password already hashed) rides inside a short-lived HMAC token, so
// unverified attempts leave nothing behind. The tenant is provisioned only when
// the link is clicked — see ./verify/+page.server.js.
import { fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase.js';
import { hashPassword } from '$lib/server/password.js';
import { createSignupToken } from '$lib/server/signup-token.js';
import { sendEmail } from '$lib/server/email.js';
import { industryKeyOf } from '$lib/industries.js';

export function load({ locals }) {
	// Already signed in? Skip signup and go to the workspace.
	if (locals.user) throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');
	return {};
}

export const actions = {
	signup: async ({ request, locals, url }) => {
		if (locals.user) throw redirect(303, '/portal');
		const form = await request.formData();

		// Honeypot — real users never fill this hidden field; bots do.
		if (String(form.get('company_website') ?? '').trim()) throw redirect(303, '/portal');

		// Unknown/missing industry keys resolve to the default (tourism), so old
		// forms and tampered values can never break provisioning.
		const industry = industryKeyOf(String(form.get('industry') ?? '').trim());
		const brandName = String(form.get('brandName') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const region = String(form.get('region') ?? '').trim();
		const tourFocus = String(form.get('tourFocus') ?? '').trim();
		const currency = (String(form.get('currency') ?? 'USD').trim().toUpperCase() || 'USD').slice(0, 8);
		const whatsapp = String(form.get('whatsapp') ?? '').trim();
		const fullName = String(form.get('fullName') ?? '').trim();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');

		const values = { industry, brandName, description, region, tourFocus, currency, whatsapp, fullName, email };
		if (!brandName) return fail(400, { error: 'Please enter your business name.', values });
		if (!email || !/.+@.+\..+/.test(email)) return fail(400, { error: 'Please enter a valid email address.', values });
		if (password.length < 8) return fail(400, { error: 'Password must be at least 8 characters.', values });

		// Login email must be unique across the platform. (Re-checked at verify
		// time too, in case someone claims it during the link's lifetime.)
		const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
		if (existing) return fail(400, { error: 'That email already has an account — try signing in instead.', values });

		// The token carries everything needed to provision the tenant on click.
		// The password is hashed NOW so plaintext never touches the token/URL.
		const token = createSignupToken({
			industry,
			brandName,
			description,
			region,
			tourFocus,
			currency,
			whatsapp,
			fullName,
			email,
			passwordHash: hashPassword(password)
		});
		const link = `${url.origin}/onboarding/verify?token=${encodeURIComponent(token)}`;

		const res = await sendEmail({
			to: email,
			subject: 'Confirm your email to finish setting up Makutano',
			text: [
				`Hi${fullName ? ' ' + fullName : ''},`,
				'',
				`You're one click away from launching your AI assistant for ${brandName}.`,
				'Confirm your email address to activate your workspace:',
				'',
				link,
				'',
				"This link expires in 24 hours. If you didn't request this, you can safely ignore this email.",
				'',
				'— Makutano AI'
			].join('\n')
		});

		// If the email couldn't be delivered (Resend unconfigured, or a send
		// error), signup must not dead-end: log the link server-side AND return it
		// so the person who just filled in the form can confirm directly. When
		// email works, `delivered` is true and no link is exposed — the secure
		// email-only flow. The moment Resend is configured, the fallback vanishes.
		const delivered = res.ok === true;
		if (!delivered) console.log(`[signup] verification link for ${email}: ${link}`);

		return { sent: true, email, delivered, verifyLink: delivered ? null : link };
	}
};
