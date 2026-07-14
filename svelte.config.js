import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Standalone Node server (build/) — runs in the Docker image via `node build`.
		adapter: adapter()
	}
};

export default config;
