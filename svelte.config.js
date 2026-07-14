import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Deploys to Cloudflare / Vercel / Node depending on the host.
		adapter: adapter()
	}
};

export default config;
