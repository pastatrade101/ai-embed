import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/auth.js';

export const actions = {
	default: ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		throw redirect(303, '/login');
	}
};

export function load() {
	// Nothing to render — POST to this route to log out.
	throw redirect(303, '/login');
}
