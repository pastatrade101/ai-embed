// Served at /sitemap.xml — the marketing page plus every live operator's public
// hosted page, so search engines discover them all.
import { supabase } from '$lib/server/supabase.js';

export async function GET({ url }) {
	const pages = [{ path: '/', changefreq: 'weekly', priority: '1.0' }];

	const { data: clients } = await supabase
		.from('clients')
		.select('slug, subscription_status')
		.eq('is_active', true)
		.order('name');
	for (const c of clients ?? []) {
		if (c.subscription_status === 'canceled' || !c.slug) continue;
		pages.push({ path: `/c/${c.slug}`, changefreq: 'weekly', priority: '0.7' });
	}

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
	.map(
		(p) =>
			`  <url><loc>${url.origin}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
	)
	.join('\n')}
</urlset>`;
	return new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' }
	});
}
