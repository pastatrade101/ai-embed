// Public: live values for a tenant's featured cards on the hosted welcome screen.
// The page renders the card shells from its own load (instant) and calls this after
// mount to fill the LIVE numbers, so the page never blocks on TAUSI. resolveFeatured
// is cached + fail-open, so this can be hit by public traffic safely.
import { json } from '@sveltejs/kit';
import { getClientBySlug } from '$lib/server/tenant.js';
import { resolveFeatured } from '$lib/server/featured-cards.js';

export async function GET({ url, setHeaders }) {
	const slug = String(url.searchParams.get('client') || '').trim();
	if (!slug) return json({ cards: [] });
	try {
		const client = await getClientBySlug(slug);
		if (!client || client.is_active === false) return json({ cards: [] });
		const cards = await resolveFeatured(client);
		setHeaders({ 'cache-control': 'public, max-age=60' }); // countdown ticks client-side
		return json({ cards });
	} catch {
		return json({ cards: [] }); // never break the public page
	}
}
