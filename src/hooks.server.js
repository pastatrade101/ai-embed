// Populate event.locals.user on every request and enforce role-based access.
// Runtime API routes (/api/*) stay public for the widget.
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, readSessionToken, loadUser } from '$lib/server/auth.js';

export async function handle({ event, resolve }) {
	const uid = readSessionToken(event.cookies.get(SESSION_COOKIE));
	event.locals.user = uid ? await loadUser(uid) : null;

	const path = event.url.pathname;
	const user = event.locals.user;

	if (path.startsWith('/admin')) {
		if (!user) throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
		if (user.role !== 'super_admin') throw redirect(303, '/portal');
	}

	if (path.startsWith('/portal')) {
		if (!user) throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
		if (user.role !== 'operator') throw redirect(303, '/admin');
	}

	return resolve(event);
}
