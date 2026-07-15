// Stateless email-verification token for self-serve signup. The whole (already
// password-hashed) signup payload is carried in a short-lived HMAC-signed token
// — so no unverified/orphan rows exist until the link is clicked. Signed with
// AUTH_SECRET, same as session tokens.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

const TTL_MS = 24 * 60 * 60 * 1000; // links expire after 24h

function secret() {
	return env.AUTH_SECRET || 'dev-insecure-secret-change-me';
}
function sign(body) {
	return createHmac('sha256', secret()).update(body).digest('base64url');
}

/** Sign a signup payload into a token. */
export function createSignupToken(payload) {
	const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TTL_MS })).toString('base64url');
	return `${body}.${sign(body)}`;
}

/** Verify a token and return its payload, or null if invalid/expired/tampered. */
export function readSignupToken(token) {
	if (!token) return null;
	const parts = String(token).split('.');
	if (parts.length !== 2) return null;
	const [body, sig] = parts;
	const good = sign(body);
	if (good.length !== sig.length) return null;
	if (!timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
	let data;
	try {
		data = JSON.parse(Buffer.from(body, 'base64url').toString());
	} catch {
		return null;
	}
	if (!data || Number(data.exp) < Date.now()) return null;
	return data;
}
