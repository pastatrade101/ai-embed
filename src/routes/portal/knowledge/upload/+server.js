// Operator image upload (tour photos). Auth is enforced by hooks.server.js for
// /portal/*, so locals.user.client_id scopes the upload. Returns { url }.
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
