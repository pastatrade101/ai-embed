// Resolve a tenant's featured-card config into render-ready cards, filling LIVE
// values (plots available, councils with land, on-preview countdown) from TAUSI.
//
// SAFE BY DESIGN:
//  • Live gov card types resolve ONLY for the government tenant (server-side gate) —
//    a non-gov tenant can never drive its public page into the TAUSI government API.
//  • Cached per (tenant + exact config), with SINGLE-FLIGHT: concurrent cold-cache
//    requests share ONE resolution, and an admin edit changes the key so live values
//    can never land on the wrong card. Public traffic never translates 1:1 into
//    upstream load; the TAUSI calls also go through govdata's cache + limiter + breaker.
//  • Every live lookup is fail-open: a null value never throws; the UI hides a live
//    card whose value is missing. No PII — only counts and public opening times.

import { normalizeFeatured } from '$lib/featured-cards.js';
import { industryKeyOf } from '$lib/industries.js';
import { landAvailableStats, landProjectPreview } from './govdata.js';

const CACHE = new Map(); // key → { at, promise }
const TTL = 5 * 60 * 1000;

function prune() {
	if (CACHE.size < 200) return;
	const now = Date.now();
	for (const [k, v] of CACHE) if (now - v.at >= TTL) CACHE.delete(k);
}

async function compute(cfg) {
	const needStats = cfg.some((c) => c.type === 'plots_available' || c.type === 'councils_with_land');
	const previewIds = [...new Set(cfg.filter((c) => c.type === 'preview_countdown').map((c) => c.projectId))];

	const [stats, previewPairs] = await Promise.all([
		needStats ? landAvailableStats() : Promise.resolve(null), // both fail-open → null
		Promise.all(previewIds.map(async (id) => [id, await landProjectPreview(id)]))
	]);
	const previews = Object.fromEntries(previewPairs);

	return cfg.map((c) => {
		if (c.type === 'plots_available') return { ...c, live: { value: stats ? stats.plots : null } };
		if (c.type === 'councils_with_land') return { ...c, live: { value: stats ? stats.councils : null } };
		if (c.type === 'preview_countdown') {
			const pv = previews[c.projectId];
			return {
				...c,
				live:
					pv && pv.opening
						? { value: pv.previewCount, projectName: pv.projectName, council: pv.council, openingAtISO: pv.opening.atISO, openingLabel: pv.opening.label, availableCount: pv.availableCount }
						: { value: null }
			};
		}
		return c; // static text card — no live lookup
	});
}

/**
 * @param client the client row (needs `featured_cards`, an id/slug, and `industry`)
 * @returns array of cards; live cards carry a `live` object, or `live:{value:null}`
 *          (→ hidden) when TAUSI could not be reached.
 */
export function resolveFeatured(client) {
	// Server-side gate: live gov types only for the government tenant (the client-side
	// editor gate is not trusted). The hosted page load applies the SAME gate, so the
	// config the page renders and the array this returns always align by index.
	const allowGov = industryKeyOf(client) === 'government';
	const cfg = normalizeFeatured(client?.featured_cards, { allowGov });
	if (!cfg.length) return Promise.resolve([]);

	// Key on tenant + EXACT config, so a reorder/edit re-resolves (no stale index
	// mapping) and identical configs share one entry.
	const key = `${client?.id || client?.slug || 'anon'}:${JSON.stringify(cfg)}`;
	const hit = CACHE.get(key);
	if (hit && Date.now() - hit.at < TTL) return hit.promise; // may be in-flight — single-flight

	const promise = compute(cfg); // never rejects (fail-open) — safe to cache the promise
	CACHE.set(key, { at: Date.now(), promise });
	prune();
	return promise;
}
