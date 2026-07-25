// Chunk retrieval with breadth control.
//
// `match_chunks` is a plain nearest-neighbour search: it returns the N chunks
// whose vectors sit closest to the question. On a large, lopsided knowledge base
// — e.g. a government tenant whose corpus is dominated by hundreds of regulation
// clauses — the closest N for almost any question are all from that one dominant
// source, so the assistant looks like it "only knows the regulations" even when
// the Act, guidelines and other material are indexed too.
//
// This module over-fetches a candidate pool, then greedily selects the final set
// under two caps: at most `perItem` chunks from a single knowledge item, and at
// most `perCategory` from a single category. That keeps the genuinely-best match
// on top while reserving room for other documents to surface. If the caps leave
// us short (e.g. a corpus with only one category), we top up by pure similarity
// so we never return fewer than the model's budget allows.
import { supabase } from './supabase.js';

const CAT_KEY = (c) => (c == null || c === '' ? '∅' : String(c));

/**
 * Retrieve diversified chunks for a query embedding, tenant-scoped.
 * @param {string} clientId
 * @param {number[]} queryEmbedding
 * @param {{ want?: number, perItem?: number, perCategory?: number }} [opts]
 * @returns {Promise<Array<{ chunk_id:string, item_id:string, content:string, similarity:number, category:string|null }>>}
 */
export async function retrieveChunks(clientId, queryEmbedding, opts = {}) {
	const want = opts.want ?? 12;
	const perItem = opts.perItem ?? 3;
	const perCategory = opts.perCategory ?? Math.max(2, Math.ceil(want * 0.6));

	// Over-fetch a candidate pool so the caps have room to pick from other
	// documents instead of just the tight cluster around the single best match.
	const poolSize = Math.max(want * 4, 40);
	const { data, error } = await supabase.rpc('match_chunks', {
		p_client_id: clientId,
		p_query_embedding: queryEmbedding,
		p_match_count: poolSize
	});
	if (error) throw new Error(`match_chunks failed: ${error.message}`);
	const candidates = data ?? [];
	if (candidates.length <= want) return candidates.map((c) => ({ ...c, category: null }));

	// Look up each candidate item's category in one query so we can spread across
	// documents. A failure here is non-fatal — we simply fall back to item-only
	// diversity (category treated as unknown for every row).
	const itemIds = [...new Set(candidates.map((c) => c.item_id).filter(Boolean))];
	const catById = new Map();
	if (itemIds.length) {
		const { data: rows, error: catErr } = await supabase
			.from('knowledge_items')
			.select('id, category')
			.in('id', itemIds);
		// Non-fatal: category is only the diversity signal. If the lookup fails we
		// degrade to item-level diversity rather than break retrieval — but log it,
		// because a silent failure here reinstates the "only one source" symptom.
		if (catErr) console.warn(`[retrieval] category lookup failed; degrading to item-only diversity: ${catErr.message}`);
		for (const r of rows ?? []) catById.set(r.id, r.category ?? null);
	}

	const withCat = candidates.map((c) => ({ ...c, category: catById.get(c.item_id) ?? null }));
	return diversify(withCat, { want, perItem, perCategory });
}

/**
 * Pure selection: pick up to `want` chunks from a similarity-ordered candidate
 * list, capping how many come from any one item (`perItem`) or category
 * (`perCategory`), then topping up by similarity if the caps leave slots empty.
 * Split out from the I/O so it can be unit-tested without a database.
 * @param {Array<{ chunk_id?:string, item_id?:string, content?:string, similarity?:number, category?:string|null }>} candidates similarity-ordered (closest first)
 * @param {{ want:number, perItem:number, perCategory:number }} caps
 */
export function diversify(candidates, { want, perItem, perCategory }) {
	const chosen = [];
	const itemCount = new Map();
	const catCount = new Map();
	const used = new Set();

	// Greedy pass: honour both caps, walking candidates in similarity order.
	for (let i = 0; i < candidates.length; i++) {
		if (chosen.length >= want) break;
		const c = candidates[i];
		const ck = CAT_KEY(c.category);
		if ((itemCount.get(c.item_id) ?? 0) >= perItem) continue;
		if ((catCount.get(ck) ?? 0) >= perCategory) continue;
		chosen.push(c);
		used.add(i);
		itemCount.set(c.item_id, (itemCount.get(c.item_id) ?? 0) + 1);
		catCount.set(ck, (catCount.get(ck) ?? 0) + 1);
	}

	// Top-up pass: if the caps left us short (e.g. everything is one category),
	// fill the remaining slots by pure similarity so we never starve the model.
	// Indexed by position so duplicate/missing chunk_ids can't collide.
	if (chosen.length < want) {
		for (let i = 0; i < candidates.length; i++) {
			if (chosen.length >= want) break;
			if (used.has(i)) continue;
			chosen.push(candidates[i]);
			used.add(i);
		}
	}

	return chosen;
}
