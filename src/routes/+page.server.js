// Root: the public marketing landing page. Signed-in users skip it and go
// straight to their workspace.
import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
	if (locals.user) throw redirect(303, locals.user.role === 'super_admin' ? '/admin' : '/portal');
	return {};
}
