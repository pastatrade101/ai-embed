// First-run guided setup wizard. Reuses the same settings-patch logic as the
// settings page (only submitted fields are updated), so /portal/settings stays
// the place for ongoing edits — this is just a smoother first-run flow.
import { updateClientSettings } from '$lib/server/tenant.js';

export const actions = {
	save: async ({ request, locals }) => {
		return updateClientSettings(locals.user.client_id, await request.formData(), { allowAdmin: false });
	}
};
