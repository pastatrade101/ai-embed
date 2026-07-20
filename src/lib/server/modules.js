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
	// ---- Core (always on) ----
	{ key: 'assistant', name: 'AI Assistant', group: 'Core', core: true, href: '/portal', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', desc: 'The AI that answers customers on WhatsApp, your website and more.' },
	{ key: 'knowledge', name: 'Knowledge Base', group: 'Core', core: true, href: '/portal/knowledge', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', desc: 'Products, prices, FAQs and documents the AI answers from.' },
	{ key: 'crm', name: 'CRM & Leads', group: 'Core', core: true, href: '/portal/leads', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', desc: 'Customers, pipeline stages and AI-qualified leads.' },
	{ key: 'quotations', name: 'Quotations', group: 'Core', core: true, href: '/portal/proposals', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6M9 17h6', desc: 'AI-drafted quotes & proposals customers accept in one tap.' },
	{ key: 'conversations', name: 'Conversations', group: 'Core', core: true, href: '/portal/conversations', icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z', desc: 'Every chat across channels in one timeline.' },
	{ key: 'insights', name: 'AI Insights', group: 'Core', core: true, href: '/portal/insights', icon: 'M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z M9 21h6', desc: 'AI reads your numbers and tells you what to do next.' },

	// ---- Operations (toggleable) ----
	{ key: 'orders', name: 'Order Management', group: 'Operations', defaultOn: false, href: '/portal/orders', icon: 'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6', desc: 'Turn a WhatsApp message into a confirmed order. Kanban, table & calendar views.' },

	{ key: 'inventory', name: 'Products & Inventory', group: 'Operations', defaultOn: false, href: '/portal/products', icon: 'M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.11-1.79V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.79 0z M2.32 6.16 12 11l9.68-4.84 M12 22.76V11', desc: 'Products, stock ledger, warehouses, reservations & low-stock alerts.' },

	// ---- Roadmap (coming soon — visible so tenants see where this is going) ----
	{ key: 'invoicing', name: 'Invoices', group: 'Finance', comingSoon: true, icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8', desc: 'Auto invoices with tax, partial payments & WhatsApp delivery.' },
	{ key: 'payments', name: 'Payments', group: 'Finance', comingSoon: true, icon: 'M2 5h20v14H2z M2 10h20', desc: 'Cash, bank, mobile money & cards — paid, partial, overdue.' },
	{ key: 'delivery', name: 'Delivery', group: 'Operations', comingSoon: true, icon: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', desc: 'Drivers, routes, proof of delivery & customer signatures.' },
	{ key: 'reports', name: 'Reports', group: 'Finance', comingSoon: true, icon: 'M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3', desc: 'Daily → yearly reports, exported to PDF, Excel & CSV.' },
	{ key: 'automation', name: 'Automation', group: 'Operations', comingSoon: true, icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z', desc: 'When order confirmed → reserve stock → invoice → notify. Configurable.' },
	{ key: 'team', name: 'Team & Roles', group: 'Workspace', comingSoon: true, icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', desc: 'Invite staff with granular per-module permissions.' },
	{ key: 'helpdesk', name: 'Help Desk', group: 'Workspace', comingSoon: true, icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M4.93 4.93l4.24 4.24 M14.83 14.83l4.24 4.24 M14.83 9.17l4.24-4.24 M9.17 14.83l-4.24 4.24 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', desc: 'Tickets, SLAs and AI-assisted support replies.' }
];

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

/** Modules a fresh tenant gets before any explicit toggle. Core is always included.
 *  Industry can nudge sensible defaults (e.g. goods sellers get Orders). */
export function defaultModuleState(client) {
	const industry = client?.industry || 'tourism';
	// Industries that sell physical goods benefit from Orders out of the box.
	const goodsIndustries = new Set(['retail', 'restaurant', 'pharmacy']);
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
