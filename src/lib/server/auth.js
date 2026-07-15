// Session auth: a signed, stateless cookie carrying the user id. Each request
// re-loads the user from the DB, so role / client / status changes take effect
// immediately and accounts can be revoked by deletion.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { supabase } from './supabase.js';
import { verifyPassword } from './password.js';

export const SESSION_COOKIE = 'mk_session';
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function secret() {
	return env.AUTH_SECRET || 'dev-insecure-secret-change-me';
}

function sign(body) {
	return createHmac('sha256', secret()).update(body).digest('base64url');
}

/** Build a signed token for a user id. */
export function createSessionToken(userId) {
	const exp = Date.now() + TTL_MS;
	const body = `${Buffer.from(userId).toString('base64url')}.${exp}`;
	return `${body}.${sign(body)}`;
}

/** Verify a token and return the user id, or null. */
export function readSessionToken(token) {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [uidB64, exp, sig] = parts;
	const body = `${uidB64}.${exp}`;
	const good = sign(body);
	if (good.length !== sig.length) return null;
	if (!timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
	if (Number(exp) < Date.now()) return null;
	return Buffer.from(uidB64, 'base64url').toString();
}

/** Cookie options for setting the session. */
export function sessionCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !env.NODE_ENV || env.NODE_ENV === 'production',
		maxAge: TTL_MS / 1000
	};
}

/** Load the current user (safe fields only) by id. */
export async function loadUser(userId) {
	const { data } = await supabase
		.from('users')
		.select('id, email, name, role, client_id')
		.eq('id', userId)
		.maybeSingle();
	return data ?? null;
}

/**
 * Verify email + password. Returns the user row (incl. id) on success, else null.
 * Updates last_login_at as a side effect.
 */
export async function authenticate(email, password) {
	const clean = (email ?? '').trim().toLowerCase();
	if (!clean || !password) return null;

	const { data: user } = await supabase
		.from('users')
		.select('id, email, name, role, client_id, password_hash')
		.eq('email', clean)
		.maybeSingle();

	if (!user || !verifyPassword(password, user.password_hash)) return null;

	// Fire-and-forget "last seen" stamp. MUST swallow rejections: supabase-js
	// rejects on a network blip, and an unhandled rejection crashes the Node
	// process (Node 22 default) — which behind a proxy looks like a login 500.
	supabase
		.from('users')
		.update({ last_login_at: new Date().toISOString() })
		.eq('id', user.id)
		.then(() => {}, () => {});

	const { password_hash, ...safe } = user;
	return safe;
}
