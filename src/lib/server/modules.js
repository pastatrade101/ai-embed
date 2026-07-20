// Module Registry — the spine of the AI Business OS. Each tenant enables a set of
// business modules (Orders, Inventory, Invoicing…) on top of the always-on core
// (AI assistant, knowledge, CRM, quotations, conversations, insights). The sidebar,
// dashboard and (later) AI action layer are all DERIVED from what's enabled.
//
// State lives in clients.modules (jsonb, migration 022) as explicit on/off overrides
// merged over per-industry defaults. FAILS OPEN: before 022, client.modules is
// undefined → treated as {} → defaults apply, so nothing changes until a tenant
// toggles a module.
import { supabase } from './supabase.js';

// group: how the marketplace + sidebar cluster modules.
// core:  always on, cannot be disabled (the product you already have).
// comingSoon: shown in the marketplace as a roadmap tile, not yet toggleable.
// defaultOn: enabled by default for a fresh tenant (unless industry overrides).
// icon: a 24×24 stroke-path `d` (lucide-style) rendered by the marketplace/nav.
export const MODULES = [
	{ key: 'orders', name: 'Order Management', group: 'Commerce', defaultOn: false, href: '/portal/orders', icon: 'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6', desc: 'Turn a WhatsApp message into a confirmed order — review and confirm in the Inbox.' },
	{ key: 'inventory', name: 'Products', group: 'Commerce', defaultOn: false, href: '/portal/products', icon: 'M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.11-1.79V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.79 0z M2.32 6.16 12 11l9.68-4.84 M12 22.76V11', desc: 'Prices the AI remembers from your orders, plus optional stock to know if you can fulfill.' }
];

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

/** Modules a fresh tenant gets before any explicit toggle. Core is always included.
 *  Industry can nudge sensible defaults (e.g. goods sellers get Orders). */
export function defaultModuleState(client) {
	const industry = client?.industry || 'tourism';
	// Industries that sell physical goods benefit from Orders out of the box.
	// (Keys must match src/lib/industries.js — 'pharmacy' isn't one; it's 'healthcare'.)
	const goodsIndustries = new Set(['retail', 'restaurant']);
	const state = {};
	for (const m of MODULES) {
		if (m.core) continue;
		if (m.comingSoon) continue;
		state[m.key] = m.key === 'orders' ? goodsIndustries.has(industry) : !!m.defaultOn;
	}
	return state;
}

/** The tenant's explicit overrides (jsonb map), safe before migration 022. */
function overridesOf(client) {
	const raw = client?.modules;
	return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** Is a module enabled for this tenant? Core is always on; roadmap is never on. */
export function isModuleEnabled(client, key) {
	const m = BY_KEY.get(key);
	if (!m) return false;
	if (m.core) return true;
	if (m.comingSoon) return false;
	const ov = overridesOf(client);
	if (key in ov) return !!ov[key];
	return !!defaultModuleState(client)[key];
}

/** All enabled module keys (core + enabled optional), in registry order. */
export function enabledModuleKeys(client) {
	return MODULES.filter((m) => isModuleEnabled(client, m.key)).map((m) => m.key);
}

/** Marketplace view model: every module + its state + whether it can be toggled. */
export function moduleCatalog(client) {
	return MODULES.map((m) => ({
		key: m.key,
		name: m.name,
		group: m.group,
		desc: m.desc,
		icon: m.icon,
		href: m.href || null,
		core: !!m.core,
		comingSoon: !!m.comingSoon,
		enabled: isModuleEnabled(client, m.key),
		toggleable: !m.core && !m.comingSoon
	}));
}

/** Persist a single on/off override. Ignores core/coming-soon/unknown keys.
 *  Read-modify-write on the jsonb map; fails soft (returns ok:false) before 022. */
export async function setModuleEnabled(clientId, key, enabled) {
	const m = BY_KEY.get(key);
	if (!m || m.core || m.comingSoon) return { ok: false, error: 'not_toggleable' };
	const { data: row, error: readErr } = await supabase.from('clients').select('modules').eq('id', clientId).maybeSingle();
	if (readErr) return { ok: false, error: readErr.message, tableMissing: /modules/.test(readErr.message || '') };
	const modules = row?.modules && typeof row.modules === 'object' ? { ...row.modules } : {};
	modules[key] = !!enabled;
	const { error } = await supabase.from('clients').update({ modules }).eq('id', clientId);
	if (error) return { ok: false, error: error.message };
	return { ok: true, modules };
}
