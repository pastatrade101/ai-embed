// Background auto-sync scheduler. A single long-lived timer in the Node server
// (adapter-node) periodically refreshes the website pages of operators who turned
// on auto-sync — reusing the exact change-monitoring path as the manual button,
// so only pages that actually changed get re-embedded.
//
// Inert by default: it only starts when WEBSITE_AUTOSYNC=on, and only touches
// clients who opted in (metadata.auto_sync) AND whose pages are stale. Assumes a
// single app instance (prod = one `app` service behind Caddy); with multiple
// replicas you'd want an external cron hitting a protected endpoint instead.
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { supabase } from '$lib/server/supabase.js';
import { resyncWebsitePages } from '$lib/server/website-sync.js';
import { planAllows, FEATURE } from '$lib/server/gating.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
let started = false;
let running = false; // a tick is in progress — don't let the next one overlap it

const intervalMs = () => Math.max(1, Number(env.AUTOSYNC_INTERVAL_HOURS) || 12) * HOUR;
const maxAgeMs = () => Math.max(1, Number(env.AUTOSYNC_MAX_AGE_DAYS) || 7) * DAY;

/**
 * Find clients with auto-sync on whose pages are older than the freshness window,
 * and re-sync them (change-detected). Bounded per run so one tick can't stampede.
 */
export async function runDueAutoSyncs({ maxClients = 25 } = {}) {
	const { data: items } = await supabase
		.from('knowledge_items')
		.select('client_id, metadata')
		.contains('metadata', { source: 'website', auto_sync: true });
	if (!items?.length) return { clients: 0, updated: 0 };

	// OLDEST last_synced per client — a client is due if ANY page is stale, so a
	// single recently-touched page can't mask the rest.
	const oldest = new Map();
	for (const it of items) {
		const t = it.metadata?.last_synced ?? null;
		if (!oldest.has(it.client_id)) oldest.set(it.client_id, t);
		else {
			const cur = oldest.get(it.client_id);
			if (!t || (cur && t < cur)) oldest.set(it.client_id, t);
		}
	}

	const now = Date.now();
	const dueIds = [...oldest.entries()]
		.filter(([, t]) => !t || now - new Date(t).getTime() >= maxAgeMs())
		.map(([id]) => id)
		.slice(0, maxClients);
	if (!dueIds.length) return { clients: 0, updated: 0 };

	// Entitlement check — a former-premium client who downgraded (but still has the
	// auto_sync flags on their items) must not keep getting background re-syncs.
	const { data: clients } = await supabase.from('clients').select('id, plan').in('id', dueIds);
	const planOf = new Map((clients ?? []).map((c) => [c.id, c.plan]));

	let updated = 0;
	let ran = 0;
	for (const clientId of dueIds) {
		if (!(await planAllows(planOf.get(clientId), FEATURE.WEBSITE_SYNC))) continue;
		try {
			const r = await resyncWebsitePages(clientId);
			updated += r.updated;
			ran++;
			console.log(`[autosync] ${clientId}: ${r.updated} updated, ${r.unchanged} unchanged, ${r.failed.length} failed`);
		} catch (e) {
			console.error('[autosync] failed for', clientId, e?.message ?? e);
		}
	}
	return { clients: ran, updated };
}

/** Start the periodic timer once. Safe to call on every server boot. */
export function startScheduler() {
	if (started || building) return;
	if (env.WEBSITE_AUTOSYNC !== 'on') return; // opt-in; off in dev and by default
	started = true;

	const tick = async () => {
		if (running) return; // previous run still going — skip this beat
		running = true;
		try {
			await runDueAutoSyncs();
		} catch (e) {
			console.error('[autosync] tick error', e?.message ?? e);
		} finally {
			running = false;
		}
	};
	const timer = setInterval(tick, intervalMs());
	if (timer.unref) timer.unref(); // never keep the process alive on its own
	const boot = setTimeout(tick, 60 * 1000); // first pass a minute after boot
	if (boot.unref) boot.unref();

	console.log(`[autosync] scheduler on — every ${intervalMs() / HOUR}h, refresh pages older than ${maxAgeMs() / DAY}d`);
}
