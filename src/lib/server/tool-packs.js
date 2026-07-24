// Institution tool packs — the scaling seam for government (and other) live-data
// tools. Each pack bundles ONE institution's tools + guidance; a super admin
// assigns packs to a specific client and can shut them down per client, so the
// same toolset is not hardwired to an industry for every tenant.
//
// A client's effective packs = the industry DEFAULT packs (backward-compat) merged
// with the per-client overrides stored in `clients.tool_packs` (a { packKey: bool }
// map): true = assigned/on, false = shut down. Absent → the industry default.

import { serverIndustry, TAUSI_PUBLIC_TOOLS, TAUSI_PUBLIC_QUALIFY, NEST_PUBLIC_TOOLS, NEST_PUBLIC_QUALIFY } from './industries.js';
import { industryKeyOf } from '$lib/industries.js';

/** The registry. Add a pack per institution. `defaultFor` is the industry that
 *  gets the pack automatically (so nothing breaks for existing tenants); omit it
 *  for a pack that a super admin assigns explicitly per client. */
export const TOOL_PACKS = {
	tausi: {
		key: 'tausi',
		label: 'TAUSI — land, parking, licences, property tax',
		institution: 'PMO-RALG / TAMISEMI',
		defaultFor: 'government',
		tools: TAUSI_PUBLIC_TOOLS,
		qualify: TAUSI_PUBLIC_QUALIFY
	},
	nest: {
		key: 'nest',
		label: 'NeST — public tender notices (e-procurement)',
		institution: 'PPRA — National e-Procurement System',
		// No defaultFor: assigned explicitly by a super admin to the procurement
		// client, so existing government (land) tenants are unaffected.
		defaultFor: null,
		tools: NEST_PUBLIC_TOOLS,
		qualify: NEST_PUBLIC_QUALIFY
	}
};

// Client-SAFE metadata (no tool JSON-schemas) for the super-admin UI.
export const TOOL_PACK_META = Object.values(TOOL_PACKS).map((p) => ({
	key: p.key,
	label: p.label,
	institution: p.institution,
	defaultFor: p.defaultFor,
	toolCount: p.tools.length,
	tools: p.tools.map((t) => ({ name: t.name, description: t.description }))
}));

// tool name → owning pack key (for execution-time authorization).
const TOOL_TO_PACK = {};
for (const p of Object.values(TOOL_PACKS)) for (const t of p.tools) TOOL_TO_PACK[t.name] = p.key;
export const packOfTool = (name) => (Object.prototype.hasOwnProperty.call(TOOL_TO_PACK, name) ? TOOL_TO_PACK[name] : null);

/** Set of pack keys active for a client: industry defaults ± per-client overrides. */
export function effectivePacks(client) {
	const industry = industryKeyOf(client);
	const overrides = client && typeof client.tool_packs === 'object' && client.tool_packs ? client.tool_packs : {};
	const active = new Set();
	for (const p of Object.values(TOOL_PACKS)) if (p.defaultFor === industry) active.add(p.key);
	for (const [k, on] of Object.entries(overrides)) {
		if (!Object.prototype.hasOwnProperty.call(TOOL_PACKS, k)) continue; // ignore unknown keys (incl. __proto__)
		if (on) active.add(k);
		else active.delete(k); // explicit shutdown, even of a default pack
	}
	return active;
}

/**
 * Per-client toolset: the industry server entry with the assigned packs' tools +
 * qualify merged in. Drop-in replacement for serverIndustry(client) at the chat
 * seam — hasLeadTool, leadsEnabled, the persona qualify all follow automatically.
 */
export function clientToolset(client) {
	const base = serverIndustry(client);
	const packs = [...effectivePacks(client)].map((k) => TOOL_PACKS[k]).filter(Boolean);
	if (!packs.length) return base;
	return {
		...base,
		tools: [...base.tools, ...packs.flatMap((p) => p.tools)],
		qualify: base.qualify + packs.map((p) => (p.qualify ? ' ' + p.qualify : '')).join('')
	};
}

/** Execution-time gate: is this client allowed to run `name`? Non-pack tools
 *  (search_knowledge, create_lead, tours) are always allowed; a pack tool requires
 *  the pack to be active. Defence-in-depth — an un-assigned tool is never OFFERED,
 *  but this makes a per-client shutdown authoritative at the executor too. */
export function clientAllowsTool(client, name) {
	const pack = packOfTool(name);
	if (!pack) return true;
	return effectivePacks(client).has(pack);
}

/** Sanitise a raw tool_packs value (from the admin form) into a clean
 *  { knownPackKey: boolean } map — drops unknown keys and non-boolean values. */
export function sanitizeToolPacks(raw) {
	let obj = raw;
	if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch { return {}; } }
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
	const out = {};
	for (const [k, v] of Object.entries(obj)) if (Object.prototype.hasOwnProperty.call(TOOL_PACKS, k)) out[k] = !!v;
	return out;
}

/** For the admin UI: the pack state for one client (assigned/on, and why). */
export function clientPackState(client) {
	const industry = industryKeyOf(client);
	const overrides = client && typeof client.tool_packs === 'object' && client.tool_packs ? client.tool_packs : {};
	const active = effectivePacks(client);
	return TOOL_PACK_META.map((p) => ({
		...p,
		isDefault: p.defaultFor === industry,
		active: active.has(p.key),
		override: Object.prototype.hasOwnProperty.call(overrides, p.key) ? !!overrides[p.key] : null // null = following default
	}));
}
