// Authenticated encryption for tenant access tokens (AES-256-GCM). The key is derived
// from WHATSAPP_ENC_KEY (any string — SHA-256'd to 32 bytes), so tokens are never
// stored in plaintext and tampering is detected via the GCM auth tag. Server-only.
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

function key() {
	const k = env.WHATSAPP_ENC_KEY || '';
	if (!k) return null;
	return crypto.createHash('sha256').update(k, 'utf8').digest(); // 32 bytes
}

export function hasEncryptionKey() {
	return !!key();
}

/** Encrypt a string → "v1.<iv>.<tag>.<ciphertext>" (all base64url). */
export function encrypt(plaintext) {
	const k = key();
	if (!k) throw new Error('WHATSAPP_ENC_KEY is not set — cannot store tenant tokens.');
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
	const ct = Buffer.concat([cipher.update(String(plaintext ?? ''), 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`;
}

/** Decrypt a blob produced by encrypt(). Throws on tamper / wrong key. */
export function decrypt(blob) {
	const k = key();
	if (!k) throw new Error('WHATSAPP_ENC_KEY is not set — cannot read tenant tokens.');
	const parts = String(blob ?? '').split('.');
	if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Malformed ciphertext.');
	const iv = Buffer.from(parts[1], 'base64url');
	const tag = Buffer.from(parts[2], 'base64url');
	const ct = Buffer.from(parts[3], 'base64url');
	const d = crypto.createDecipheriv('aes-256-gcm', k, iv);
	d.setAuthTag(tag);
	return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
