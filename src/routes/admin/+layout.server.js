// hooks.server.js already guards /admin to super_admin. Expose the user to the shell.
export function load({ locals }) {
	return { user: locals.user };
}
