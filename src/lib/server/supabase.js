// Server-only Supabase client using the service_role key.
// This key bypasses RLS — it must NEVER reach the browser. Because this module
// lives under $lib/server, SvelteKit will refuse to import it into client code.
//
// The client is built lazily on first use (via a Proxy) so that importing this
// module during `vite build` — when no .env is present — never constructs it.
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

let _client;

function client() {
	if (_client) return _client;
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — check your .env');
	}
	_client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false }
	});
	return _client;
}

// Proxy defers construction until the first property access at request time.
export const supabase = new Proxy(
	{},
	{
		get(_t, prop) {
			const c = client();
			const value = c[prop];
			return typeof value === 'function' ? value.bind(c) : value;
		}
	}
);
