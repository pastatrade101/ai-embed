// Portal ▸ WhatsApp Integration — where a tenant connects its own WhatsApp Business
// number via Meta Embedded Signup. The App ID / config id are public values sent to
// the browser SDK; the App Secret + tokens stay server-side.
import { fail } from '@sveltejs/kit';
import { getConnectionByClient, disconnectClient } from '$lib/server/whatsapp/connections.js';
import { metaAppConfig, embeddedSignupReady } from '$lib/server/whatsapp/config.js';
import { refreshConnection } from '$lib/server/whatsapp/embedded-signup.js';

export async function load({ locals }) {
	const clientId = locals.user.client_id;
	const { connection, tableMissing } = await getConnectionByClient(clientId);
	const m = metaAppConfig();
	return {
		connection: connection && connection.status !== 'disconnected' ? connection : null,
		needsMigration: !!tableMissing,
		ready: embeddedSignupReady(),
		meta: { appId: m.appId, configId: m.configId, graphVersion: m.graphVersion }
	};
}

export const actions = {
	disconnect: async ({ locals }) => {
		const res = await disconnectClient(locals.user.client_id);
		if (!res.ok) return fail(400, { error: 'Could not disconnect. Try again.' });
		return { ok: 'WhatsApp disconnected. Your customers now reach the platform number until you reconnect.' };
	},
	refresh: async ({ locals }) => {
		const res = await refreshConnection(locals.user.client_id);
		if (!res.ok) return fail(400, { error: 'Nothing to refresh — connect first.' });
		return { ok: 'Connection details refreshed.' };
	}
};
