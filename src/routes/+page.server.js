// Root: send everyone to the right place based on their session.
import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
	if (!locals.user) throw redirect(303, '/login');
	throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');
}
