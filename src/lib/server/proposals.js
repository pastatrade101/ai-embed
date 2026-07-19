// Proposal Engine — industry-agnostic core. Backs quotations, proposals,
// estimates, offers, invoices… through one table + one set of functions. Nothing
// here branches on doc type or industry; callers pass whatever the Industry
// Registry (proposalConfig) and the operator chose.
//
// FAILS OPEN before migration 018: every read is wrapped so a missing table
// returns empty/null with `tableMissing:true`, and the UI shows a "run 018"
// state instead of erroring.
import { randomBytes } from 'node:crypto';
import { supabase } from './supabase.js';

const COLS =
	'id, client_id, lead_id, conversation_id, number, doc_type, status, title, customer_name, customer_email, customer_phone, currency, intro, summary, terms, notes, line_items, subtotal, discount, tax, total, valid_until, public_token, version, meta, created_at, updated_at, sent_at, first_viewed_at, viewed_count, accepted_at, declined_at';

const PREFIX = {
	quotation: 'QUO', proposal: 'PRO', estimate: 'EST', offer: 'OFF', booking: 'BKG',
	invoice: 'INV', payment_request: 'PAY', agreement: 'AGR', contract: 'CON', custom: 'DOC'
};

/** True when the error is "proposals table doesn't exist yet" (migration 018). */
export function isMissingProposals(error) {
	if (!error) return false;
	const m = `${error.code ?? ''} ${error.message ?? ''}`;
	return /42P01|PGRST205|PGRST20[0-9]|does not exist|schema cache|could not find the table/i.test(m);
}

const n2 = (v) => {
	const x = Number(v);
	return Number.isFinite(x) ? x : 0;
};

/** Normalise line items and compute money. Amounts are in the proposal currency.
 *  discount and tax are absolute amounts. total never goes below zero. */
export function computeTotals(lineItems = [], discount = 0, tax = 0) {
	const items = (Array.isArray(lineItems) ? lineItems : [])
		.map((li) => {
			// Blank/missing qty defaults to 1; an explicit 0 stays 0 — matching the
			// editor's live math so the operator's total equals the customer's.
			const qty = li.qty == null || li.qty === '' ? 1 : n2(li.qty);
			const unit = n2(li.unit_price);
			const amount = li.amount != null && li.amount !== '' ? n2(li.amount) : qty * unit;
			return {
				description: String(li.description ?? '').trim(),
				detail: String(li.detail ?? '').trim() || null,
				qty,
				unit_price: unit,
				amount: Math.round(amount * 100) / 100
			};
		})
		.filter((li) => li.description || li.amount);
	const subtotal = Math.round(items.reduce((a, li) => a + li.amount, 0) * 100) / 100;
	const total = Math.max(0, Math.round((subtotal - n2(discount) + n2(tax)) * 100) / 100);
	return { items, subtotal, total };
}

function token() {
	return randomBytes(9).toString('base64url'); // ~12 url-safe chars
}

/** Human-friendly reference, e.g. QUO-2026-0007. Best-effort sequence per client. */
async function nextNumber(clientId, docType) {
	const prefix = PREFIX[docType] ?? 'DOC';
	const year = new Date().getFullYear();
	let seq = 1;
	try {
		const { count } = await supabase
			.from('proposals')
			.select('*', { count: 'exact', head: true })
			.eq('client_id', clientId);
		seq = (count ?? 0) + 1;
	} catch {
		/* fall back to 1 */
	}
	return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

/** Append a timeline event (non-fatal). */
export async function addEvent(proposalId, clientId, type, meta = {}) {
	try {
		await supabase.from('proposal_events').insert({ proposal_id: proposalId, client_id: clientId, type, meta });
	} catch {
		/* timeline is best-effort */
	}
}

/**
 * Create a proposal from a partial (customer info, doc type, line items, terms…).
 * Computes totals, assigns a number + public token, records a `created` event.
 */
export async function createProposal(clientId, data = {}) {
	const { items, subtotal, total } = computeTotals(data.line_items, data.discount, data.tax);
	const docType = data.doc_type || 'quotation';
	const row = {
		client_id: clientId,
		lead_id: data.lead_id || null,
		conversation_id: data.conversation_id || null,
		number: await nextNumber(clientId, docType),
		doc_type: docType,
		status: 'draft',
		title: (data.title ?? '').trim() || null,
		customer_name: (data.customer_name ?? '').trim() || null,
		customer_email: (data.customer_email ?? '').trim().toLowerCase() || null,
		customer_phone: (data.customer_phone ?? '').trim() || null,
		currency: (data.currency || 'USD').toUpperCase().slice(0, 8),
		intro: data.intro ?? null,
		summary: data.summary ?? null,
		terms: data.terms ?? null,
		notes: data.notes ?? null,
		line_items: items,
		subtotal,
		discount: n2(data.discount),
		tax: n2(data.tax),
		total,
		valid_until: data.valid_until || null,
		public_token: token(),
		meta: data.meta ?? {}
	};
	const { data: created, error } = await supabase.from('proposals').insert(row).select(COLS).single();
	if (error) return { proposal: null, error, tableMissing: isMissingProposals(error) };
	await addEvent(created.id, clientId, data.aiGenerated ? 'generated' : 'created', {});
	return { proposal: created, error: null };
}

/** Patch a proposal (scoped). Recomputes totals when line items/discount/tax change. */
export async function updateProposal(clientId, id, patch = {}) {
	const set = { updated_at: new Date().toISOString() };
	for (const k of ['title', 'doc_type', 'customer_name', 'customer_email', 'customer_phone', 'currency', 'intro', 'summary', 'terms', 'notes', 'valid_until'])
		if (k in patch) set[k] = patch[k];
	// meta is a jsonb blob (AI upsell/cross-sell/CTA, sync state…) — persist it on
	// UPDATE too, not just INSERT, or generated intelligence is silently dropped.
	if ('meta' in patch) set.meta = patch.meta;
	if ('currency' in set && set.currency) set.currency = String(set.currency).toUpperCase().slice(0, 8);
	if ('customer_email' in set && set.customer_email) set.customer_email = String(set.customer_email).trim().toLowerCase();
	if ('line_items' in patch || 'discount' in patch || 'tax' in patch) {
		const { items, subtotal, total } = computeTotals(patch.line_items, patch.discount, patch.tax);
		set.line_items = items;
		set.subtotal = subtotal;
		set.discount = n2(patch.discount);
		set.tax = n2(patch.tax);
		set.total = total;
	}
	const { data, error } = await supabase.from('proposals').update(set).eq('id', id).eq('client_id', clientId).select(COLS).single();
	if (error) return { proposal: null, error };
	await addEvent(id, clientId, 'edited', {});
	return { proposal: data, error: null };
}

/** Single proposal, scoped to the client. */
export async function getProposal(clientId, id) {
	const { data, error } = await supabase.from('proposals').select(COLS).eq('id', id).eq('client_id', clientId).maybeSingle();
	if (error && isMissingProposals(error)) return { proposal: null, tableMissing: true };
	return { proposal: data ?? null };
}

/** Public lookup by token (hosted page) — no client scope, token is the secret. */
export async function getProposalByToken(tok) {
	if (!tok) return { proposal: null };
	const { data, error } = await supabase.from('proposals').select(COLS).eq('public_token', tok).maybeSingle();
	if (error && isMissingProposals(error)) return { proposal: null, tableMissing: true };
	return { proposal: data ?? null };
}

/** List proposals for a client (optionally filtered to one lead). */
export async function listProposals(clientId, { leadId = null, limit = 100 } = {}) {
	let q = supabase.from('proposals').select(COLS).eq('client_id', clientId).order('created_at', { ascending: false }).limit(limit);
	if (leadId) q = q.eq('lead_id', leadId);
	const { data, error } = await q;
	if (error) return { proposals: [], tableMissing: isMissingProposals(error) };
	return { proposals: data ?? [] };
}

/** Timeline for a proposal. */
export async function proposalTimeline(proposalId, clientId) {
	const { data, error } = await supabase.from('proposal_events').select('type, at, meta').eq('proposal_id', proposalId).eq('client_id', clientId).order('at', { ascending: true });
	if (error) return [];
	return data ?? [];
}

/** Set status explicitly (operator), with a timeline event. */
export async function setStatus(clientId, id, status) {
	const set = { status, updated_at: new Date().toISOString() };
	if (status === 'accepted') set.accepted_at = new Date().toISOString();
	if (status === 'declined') set.declined_at = new Date().toISOString();
	const { data, error } = await supabase.from('proposals').update(set).eq('id', id).eq('client_id', clientId).select('id, status').single();
	if (!error) await addEvent(id, clientId, status, {});
	return { ok: !error, error };
}

/** Mark a proposal sent (records sent_at + status, and a channel on the event). */
export async function markSent(clientId, id, channel) {
	const now = new Date().toISOString();
	const { data: current } = await supabase.from('proposals').select('status').eq('id', id).eq('client_id', clientId).maybeSingle();
	const patch = { updated_at: now };
	// Don't downgrade an already-viewed/accepted proposal back to "sent".
	if (!current || ['draft', 'sent'].includes(current.status)) patch.status = 'sent';
	if (!current || current.status === 'draft') patch.sent_at = now;
	await supabase.from('proposals').update(patch).eq('id', id).eq('client_id', clientId);
	await addEvent(id, clientId, 'sent', { channel });
}

/** Record a public view (hosted page). Advances draft/sent → viewed, counts views. */
export async function recordView(proposal, meta = {}) {
	if (!proposal) return;
	// Don't count views of a decided proposal (also prevents a recount on the
	// load re-run right after the customer accepts/declines).
	if (['accepted', 'declined', 'converted'].includes(proposal.status)) return;
	const patch = { viewed_count: (proposal.viewed_count ?? 0) + 1, updated_at: new Date().toISOString() };
	if (!proposal.first_viewed_at) patch.first_viewed_at = new Date().toISOString();
	if (['draft', 'sent'].includes(proposal.status)) patch.status = 'viewed';
	try {
		await supabase.from('proposals').update(patch).eq('id', proposal.id);
		await addEvent(proposal.id, proposal.client_id, proposal.first_viewed_at ? 'viewed_again' : 'viewed', meta);
	} catch {
		/* non-fatal */
	}
}

/** Public accept/decline by token (from the hosted page). */
export async function respondByToken(tok, decision) {
	const { proposal } = await getProposalByToken(tok);
	if (!proposal) return { ok: false, notFound: true };
	// Only an open proposal can be responded to — accepted/declined/converted stay put.
	if (!['draft', 'sent', 'viewed'].includes(proposal.status)) return { ok: true, proposal, already: true };
	// An expired proposal can't be accepted.
	if (decision === 'accept' && proposal.valid_until && new Date(proposal.valid_until) < new Date(new Date().toDateString())) {
		return { ok: false, expired: true, proposal };
	}
	const now = new Date().toISOString();
	const status = decision === 'accept' ? 'accepted' : 'declined';
	const patch = { status, updated_at: now };
	patch[decision === 'accept' ? 'accepted_at' : 'declined_at'] = now;
	await supabase.from('proposals').update(patch).eq('id', proposal.id);
	await addEvent(proposal.id, proposal.client_id, status, {});
	return { ok: true, proposal: { ...proposal, status } };
}

export async function deleteProposal(clientId, id) {
	const { error } = await supabase.from('proposals').delete().eq('id', id).eq('client_id', clientId);
	return { ok: !error, error };
}
