// Served at /robots.txt — allow the marketing site, keep the private app out,
// and point crawlers at the sitemap.
export function GET({ url }) {
	const body = `User-agent: *
Allow: /
Disallow: /portal
Disallow: /admin
Disallow: /login
Disallow: /onboarding
Disallow: /logout

Sitemap: ${url.origin}/sitemap.xml
`;
	return new Response(body, {
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' }
	});
}
