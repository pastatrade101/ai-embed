// Generic operator image upload (tour photos, logos). Auth enforced by
// hooks.server.js for /portal/*; locals.user.client_id scopes the file.
import { json } from '@sveltejs/kit';
import { uploadImage } from '$lib/server/storage.js';

export async function POST({ request, locals }) {
	if (!locals.user?.client_id) return json({ error: 'Not signed in.' }, { status: 401 });
	try {
		const form = await request.formData();
		const url = await uploadImage(locals.user.client_id, form.get('file'));
		return json({ url });
	} catch (e) {
		return json({ error: e?.message ?? 'Upload failed.' }, { status: 400 });
	}
}
