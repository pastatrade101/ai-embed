// Portal ▸ Modules — the marketplace. Enable/disable business modules without
// re-onboarding or reconnecting WhatsApp. Core modules are always on; roadmap
// modules show as "coming soon".
import { fail } from '@sveltejs/kit';
import { getClientById } from '$lib/server/tenant.js';
import { moduleCatalog, setModuleEnabled } from '$lib/server/modules.js';

export async function load({ parent }) {
	const { client } = await parent();
	return { modules: moduleCatalog(client) };
}

export const actions = {
	toggle: async ({ request, locals }) => {
		const form = await request.formData();
		const key = String(form.get('key') || '');
		const enabled = String(form.get('enabled') || '') === 'true';
		const res = await setModuleEnabled(locals.user.client_id, key, enabled);
		if (!res.ok) {
			if (res.tableMissing) return fail(400, { error: 'Run db/022_platform_modules.sql to enable modules.' });
			return fail(400, { error: 'Could not update that module.' });
		}
		// Return fresh catalog so the toggle reflects immediately.
		const client = await getClientById(locals.user.client_id);
		return { ok: `${enabled ? 'Enabled' : 'Disabled'}.`, modules: moduleCatalog(client) };
	}
};
