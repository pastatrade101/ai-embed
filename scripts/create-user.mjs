// Create a login account from the command line — use it to bootstrap your first
// super-admin, since there's no signup page.
//
//   node scripts/create-user.mjs super_admin you@example.com "your-password" "Your Name"
//   node scripts/create-user.mjs operator jane@biz.com "temp-pass" "Jane" biz-slug
//
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env (or the environment).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../src/lib/server/password.js';

// --- load .env (simple parser; no dotenv dependency) ---
const env = { ...process.env };
try {
	const text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
	for (const line of text.split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
		if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
	}
} catch {
	/* no .env file — rely on real env vars */
}

const [, , role, email, password, name, clientSlug] = process.argv;

function die(msg) {
	console.error('Error: ' + msg);
	console.error('\nUsage:\n  node scripts/create-user.mjs <super_admin|operator> <email> <password> [name] [clientSlug]');
	process.exit(1);
}

if (!['super_admin', 'operator'].includes(role)) die('role must be super_admin or operator');
if (!email || !password) die('email and password are required');
if (password.length < 8) die('password must be at least 8 characters');
if (role === 'operator' && !clientSlug) die('operator requires a clientSlug (the client this login manages)');
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) die('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (add them to .env)');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false }
});

let client_id = null;
if (role === 'operator') {
	const { data: client } = await supabase.from('clients').select('id').eq('slug', clientSlug).maybeSingle();
	if (!client) die(`no client with slug "${clientSlug}"`);
	client_id = client.id;
}

const { error } = await supabase.from('users').insert({
	email: email.trim().toLowerCase(),
	password_hash: hashPassword(password),
	name: name ?? null,
	role,
	client_id
});

if (error) die(error.code === '23505' ? `email "${email}" is already in use` : error.message);

console.log(`✓ Created ${role} account: ${email}`);
if (role === 'super_admin') console.log('  Sign in at /login → you land on /admin');
else console.log(`  Sign in at /login → you land on /portal (managing ${clientSlug})`);
