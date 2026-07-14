// Pure password hashing (scrypt). No SvelteKit / env imports, so this module
// can also be imported from a plain Node script (scripts/create-user.mjs).
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

// Unambiguous alphabet (no 0/O/1/l/I) so generated passwords are easy to read
// aloud or type when handing them to an operator.
const PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Generate a readable strong password. */
export function generatePassword(len = 14) {
	const bytes = randomBytes(len);
	let out = '';
	for (let i = 0; i < len; i++) out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length];
	return out;
}

/** Hash a plaintext password. Returns "salt:derivedHex". */
export function hashPassword(plain) {
	const salt = randomBytes(16).toString('hex');
	const derived = scryptSync(plain, salt, KEYLEN).toString('hex');
	return `${salt}:${derived}`;
}

/** Constant-time verify against a stored "salt:derivedHex". */
export function verifyPassword(plain, stored) {
	if (!stored || !stored.includes(':')) return false;
	const [salt, derivedHex] = stored.split(':');
	const expected = Buffer.from(derivedHex, 'hex');
	const actual = scryptSync(plain, salt, KEYLEN);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}
