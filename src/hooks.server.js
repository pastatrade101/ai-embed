// Populate event.locals.user on every request and enforce role-based access.
// Runtime API routes (/api/*) stay public for the widget.
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, readSessionToken, loadUser } from '$lib/server/auth.js';
import { startScheduler } from '$lib/server/scheduler.js';

// Kick off background auto-sync once, at server start (inert unless enabled).
startScheduler();

// Safety net: a single stray promise rejection would otherwise crash the whole
// Node process (Node 22 exits on unhandled rejections) — which behind a reverse
// proxy shows up as an unexplained 500 with the container silently restarting.
// Log and keep serving instead.
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));

// Make every server error visible in `docker compose logs` with its route, so a
// future 500 names itself instead of hiding.
export function handleError({ error, event }) {
	console.error(`[500] ${event.request.method} ${event.url.pathname} —`, error?.stack || error);
	return { message: 'Internal error' };
}

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
