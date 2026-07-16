// Plan feature gating. Two semantics so that when gating is OFF everything keeps
// today's behaviour exactly:
//   planAllows(...)  — RESTRICTIVE gate (widget, email, tours, summaries, import).
//                      Default ON. Gating can turn it off for a plan.
//   planUnlocks(...) — ADDITIVE upgrade (Sonnet model, remove-badge, branding).
//                      Default OFF. Gating can turn it on for a plan.
//
// Gating is inert unless FEATURE_GATING=on, so deploying this changes nothing until
// you (a) configure each plan's features via the Plans console (or run db/009) and
// (b) flip FEATURE_GATING=on. An unconfigured plan (no features) also fails open.
import { env } from '$env/dynamic/private';
import { supabase } from './supabase.js';

export const FEATURE = {
	HOSTED: 'Hosted AI page + QR code',
	WIDGET: 'Website chat widget',
	WHATSAPP: 'WhatsApp lead handoff',
	EMAIL_ALERTS: 'Email lead alerts',
	QUALIFIED_LEADS: 'AI-qualified leads',
	SUMMARIES: 'Conversation history & summaries',
	TOURS: 'Structured tours & pricing',
	BULK_IMPORT: 'Bulk knowledge import (CSV/JSON)',
	WEBSITE_SYNC: 'Website Knowledge Sync',
	PRIORITY: 'Priority responses',
	SONNET: 'Advanced (Sonnet) AI model',
	ATTACHMENTS: 'Chat file attachments (photos & PDFs)',
	BRANDING: 'Custom branding & logo',
	NO_BADGE: 'Remove "Powered by Makutano" badge',
	MULTI_SITE: 'Multiple websites',
	SUPPORT: 'Dedicated support'
};

export function gatingOn() {
	const v = String(env.FEATURE_GATING ?? '').toLowerCase();
	return v === 'on' || v === 'true' || v === '1';
}

// Cache plan → feature set for a minute (plans change rarely).
let _cache = { at: 0, map: null };
async function featureMap() {
	if (_cache.map && Date.now() - _cache.at < 60000) return _cache.map;
	const { data } = await supabase.from('plans').select('key, features');
	const map = new Map();
	for (const p of data ?? []) map.set(p.key, new Set(Array.isArray(p.features) ? p.features : []));
	_cache = { at: Date.now(), map };
	return map;
}

export async function planFeatureSet(planKey) {
	return (await featureMap()).get(planKey) ?? new Set();
}

/** Restrictive gate — returns true (allowed) unless gating is on and the plan omits it. */
export async function planAllows(planKey, feature) {
	if (!gatingOn()) return true;
	const feats = await planFeatureSet(planKey);
	if (!feats.size) return true; // unconfigured plan → don't restrict
	return feats.has(feature);
}

/** Additive upgrade — returns true only when gating is on and the plan includes it. */
export async function planUnlocks(planKey, feature) {
	if (!gatingOn()) return false;
	const feats = await planFeatureSet(planKey);
	return feats.has(feature);
}
