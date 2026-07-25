// Super-admin image upload for a specific client (logo). Mirrors /portal/upload
// but scopes the file to the client in the URL instead of the signed-in
// operator's own client — so a super-admin can set a logo while editing ANY
// client. Auth: hooks.server.js restricts the whole /admin tree to super_admin.
import { json } from '@sveltejs/kit';
import { uploadImage } from '$lib/server/storage.js';
import { getClientBySlug } from '$lib/server/tenant.js';

export async function POST({ request, params }) {
	const client = await getClientBySlug(params.slug);
	if (!client) return json({ error: 'Client not found.' }, { status: 404 });
	try {
		const form = await request.formData();
		const url = await uploadImage(client.id, form.get('file'));
		return json({ url });
	} catch (e) {
		return json({ error: e?.message ?? 'Upload failed.' }, { status: 400 });
	}
}
