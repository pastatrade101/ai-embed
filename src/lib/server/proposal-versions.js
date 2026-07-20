// ProposalVersionService — apply a validated modification to a proposal, snapshot the
// prior state as a version in meta.versions, recompute totals, bump the version number.
// Every modification is auditable: who (ai/agent), when, why, the diff summary, old→new total.
import { supabase } from './supabase.js';
import { computeTotals, addEvent } from './proposals.js';

const round = (n) => Math.round(Number(n) || 0);

function describeMod(mod) {
	const parts = [];
	if (mod.remove_items?.length) parts.push(`removed item(s) ${mod.remove_items.join(', ')}`);
	if (mod.add_items?.length) parts.push(`added ${mod.add_items.map((a) => a.description).join(', ')}`);
	if (mod.discount_percent != null) parts.push(`${mod.discount_percent}% discount`);
	else if (mod.discount_amount != null) parts.push(`discount set`);
	return parts.join('; ') || 'updated';
}

/**
 * Apply a modification and create a new version.
 * @param {string} clientId
 * @param {object} proposal            the current proposal row
 * @param {object} mod                 { remove_items:[idx], add_items:[{description,qty,unit_price,detail}], discount_percent?, discount_amount?, summary? }
 * @param {object} opts                { by:'ai'|'agent', reason, maxDiscountPercent }
 * @returns {Promise<{proposal?:object, version?:number, oldTotal?:number, newTotal?:number, diff?:number, summary?:string, error?:any}>}
 */
export async function applyModification(clientId, proposal, mod = {}, { by = 'ai', reason = '', maxDiscountPercent = 100 } = {}) {
	let items = Array.isArray(proposal.line_items) ? [...proposal.line_items] : [];

	// Remove by the 1-based index the AI sees in the ITEMS list.
	const removeIdx = new Set((mod.remove_items || []).map((x) => Number(x)).filter(Number.isFinite));
	if (removeIdx.size) items = items.filter((_, i) => !removeIdx.has(i + 1));

	// Add items. The caller (orchestrator) has ALREADY validated these against the
	// catalogue and replaced unit_price with the stored catalogue price; here we only
	// defensively clamp to a non-negative price/qty.
	for (const a of mod.add_items || []) {
		if (!a?.description) continue;
		items.push({ description: String(a.description), detail: a.detail || null, qty: Math.max(1, Number(a.qty) || 1), unit_price: Math.max(0, Number(a.unit_price) || 0) });
	}

	// Discount: percent (clamped to policy) or absolute; otherwise keep existing.
	const { subtotal: preSub } = computeTotals(items, 0, proposal.tax);
	let discount = Number(proposal.discount) || 0;
	if (mod.discount_percent != null) {
		const pct = Math.min(Math.max(0, Number(mod.discount_percent) || 0), maxDiscountPercent);
		discount = round((preSub * pct) / 100);
	} else if (mod.discount_amount != null) {
		discount = Math.max(0, round(mod.discount_amount));
	}
	// Re-clamp the (possibly retained) discount against the NEW subtotal so removing
	// items can never push the effective discount past the policy ceiling.
	const discountCeiling = round((preSub * maxDiscountPercent) / 100);
	if (discount > discountCeiling) discount = discountCeiling;

	const { items: normItems, subtotal, total } = computeTotals(items, discount, proposal.tax);
	const oldTotal = round(proposal.total);
	const newVersion = (Number(proposal.version) || 1) + 1;
	const summary = mod.summary || describeMod(mod);

	const versions = Array.isArray(proposal.meta?.versions) ? [...proposal.meta.versions] : [];
	versions.push({ version: newVersion, at: new Date().toISOString(), by, reason: reason || mod.reason || '', summary, oldTotal, newTotal: total });
	const meta = { ...(proposal.meta || {}), versions };

	// Optimistic-lock on the version we read, so two concurrent modifications can't
	// clobber each other or produce duplicate version numbers.
	const { data, error } = await supabase
		.from('proposals')
		.update({ line_items: normItems, subtotal, discount, total, version: newVersion, meta, updated_at: new Date().toISOString() })
		.eq('id', proposal.id)
		.eq('client_id', clientId)
		.eq('version', Number(proposal.version) || 1)
		.select('*')
		.maybeSingle();
	if (error) return { error };
	if (!data) return { error: { message: 'version_conflict' } }; // someone else modified it first

	await addEvent(proposal.id, clientId, 'modified', { by, version: newVersion, summary, oldTotal, newTotal: total });
	return { proposal: data, version: newVersion, oldTotal, newTotal: total, diff: total - oldTotal, summary };
}
