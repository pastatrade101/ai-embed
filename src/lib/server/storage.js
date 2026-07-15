// Image uploads → Supabase Storage. Used for tour/knowledge photos that show on
// the hosted concierge page. The bucket is public (these are marketing images),
// created on first use so no manual setup is needed. service_role only.
import { supabase } from './supabase.js';
import { env } from '$env/dynamic/private';

const BUCKET = 'tour-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

let ensured = false;
async function ensureBucket() {
	if (ensured) return;
	const { data } = await supabase.storage.getBucket(BUCKET);
	if (!data) {
		const { error } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
		// Ignore "already exists" races; surface anything else.
		if (error && !/exist/i.test(error.message)) throw new Error(error.message);
	}
	ensured = true;
}

/**
 * Upload an image File (from a multipart form) and return its public URL.
 * @param {string} clientId  tenant scope — files live under this prefix
 * @param {File} file
 */
export async function uploadImage(clientId, file) {
	if (!file || typeof file.arrayBuffer !== 'function' || !file.size) throw new Error('No file received.');
	if (!/^image\//.test(file.type || '')) throw new Error('Please choose an image file (JPG, PNG, WebP).');
	if (file.size > MAX_BYTES) throw new Error('Image is too large — keep it under 5 MB.');

	await ensureBucket();

	const ext = (String(file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
	const rand = Math.random().toString(36).slice(2, 8);
	const path = `${clientId}/${Date.now()}-${rand}.${ext}`;
	const buf = Buffer.from(await file.arrayBuffer());

	const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
	if (error) throw new Error(error.message);

	const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
	return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}
