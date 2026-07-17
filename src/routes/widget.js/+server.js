// Served at /widget.js — the embeddable site-assistant script. Delivered through a
// route (not the static dir) so we can set a real Cache-Control header: static-dir
// files ship with only ETag/Last-Modified, which browsers cache heuristically for
// hours, so widget updates wouldn't reach customers' sites. A short max-age +
// stale-while-revalidate keeps it fast while letting changes propagate quickly.
import widgetSrc from '$lib/widget.client.js?raw';

export const prerender = false;

export function GET() {
	return new Response(widgetSrc, {
		headers: {
			'content-type': 'application/javascript; charset=utf-8',
			'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
			'access-control-allow-origin': '*'
		}
	});
}
