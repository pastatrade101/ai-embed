import { fail, redirect } from '@sveltejs/kit';
import {
	authenticate,
	createSessionToken,
	SESSION_COOKIE,
	sessionCookieOptions
} from '$lib/server/auth.js';

export function load({ locals, url }) {
	// Already signed in? Bounce to the right home.
	if (locals.user) {
		throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');
	}
	return { next: url.searchParams.get('next') ?? null };
}

export const actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');

		const user = await authenticate(email, password);
		if (!user) return fail(400, { error: 'Invalid email or password.', email });

		cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions(url));

		const next = url.searchParams.get('next');
		const home = user.role === 'super_admin' ? '/admin' : '/portal';
		throw redirect(303, next && next.startsWith('/') ? next : home);
	}
};
