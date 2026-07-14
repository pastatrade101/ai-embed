// Shared tenant workspace logic, used by both the admin client page and the
// operator portal. Keeps the two surfaces in sync and enforces scoping by
// client_id in one place.
import { fail } from '@sveltejs/kit';
import { supabase } from './supabase.js';
import { reingestItem } from './rag.js';
import { parseDetails, parseKnowledgeInput } from './knowledge.js';
import { departuresByItem } from './tours.js';

const ITEM_COLS = 'id, client_id, title, body, category, price_amount, price_currency, metadata';

export function monthStartISO() {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export async function getClientById(id) {
	const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
	return data ?? null;
}

export async function getClientBySlug(slug) {
	const { data } = await supabase.from('clients').select('*').eq('slug', slug).maybeSingle();
	return data ?? null;
}

/**
 * Aggregate this month's AI usage for a client. Resilient: returns zeros if the
 * usage_records table isn't present yet (migration 004 not run).
 */
export async function usageThisMonth(clientId) {
	const zero = { turns: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, cost: 0 };
	const { data, error } = await supabase
		.from('usage_records')
		.select('input_tokens, cached_tokens, output_tokens, estimated_cost')
		.eq('client_id', clientId)
		.gte('created_at', monthStartISO());
	if (error || !data) return zero;
	return data.reduce(
		(a, r) => ({
			turns: a.turns + 1,
			inputTokens: a.inputTokens + (r.input_tokens || 0),
			cachedTokens: a.cachedTokens + (r.cached_tokens || 0),
			outputTokens: a.outputTokens + (r.output_tokens || 0),
			cost: a.cost + Number(r.estimated_cost || 0)
		}),
		zero
	);
}

/** Count conversations for a client in the current calendar month. */
export async function conversationsThisMonth(clientId) {
	const { count } = await supabase
		.from('conversations')
		.select('*', { count: 'exact', head: true })
		.eq('client_id', clientId)
		.gte('created_at', monthStartISO());
	return count ?? 0;
}

/** Load everything the client workspace needs (items, leads, conversations, stats). */
export async function loadWorkspace(clientId) {
	const since = monthStartISO();
	const [itemsRes, leadsRes, convRes, convCount, convMonthCount, leadCount] = await Promise.all([
		supabase.from('knowledge_items').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }),
		supabase.from('leads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
		supabase.from('conversations').select('id, messages, summary, created_at, updated_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(30),
		supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
		supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('created_at', since),
		supabase.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId)
	]);

	const items = itemsRes.data ?? [];
	const tourIds = items.filter((i) => (i.category ?? '').toLowerCase().includes('tour')).map((i) => i.id);
	const departures = await departuresByItem(clientId, tourIds);

	return {
		items,
		itemsError: itemsRes.error?.message ?? null,
		departures,
		leads: leadsRes.data ?? [],
		conversations: convRes.data ?? [],
		stats: {
			items: items.length,
			conversations: convCount.count ?? 0,
			conversationsMonth: convMonthCount.count ?? 0,
			leads: leadCount.count ?? 0
		}
	};
}

// ---- Knowledge item actions (chunk + embed on every change) ---------------
export async function addKnowledge(clientId, form) {
	const title = String(form.get('title') ?? '').trim();
	const body = String(form.get('body') ?? '').trim();
	const category = String(form.get('category') ?? '').trim() || null;
	const price_currency = String(form.get('price_currency') ?? '').trim().toUpperCase() || 'USD';
	const metadata = parseDetails(form.get('details'));
	const priceRaw = String(form.get('price_amount') ?? '').trim();
	const price_amount = priceRaw ? Number(priceRaw) : null;

	if (!title) return fail(400, { section: 'item', error: 'Title is required.' });
	if (priceRaw && Number.isNaN(price_amount)) return fail(400, { section: 'item', error: 'Price must be a number.' });

	const { data: item, error } = await supabase
		.from('knowledge_items')
		.insert({ client_id: clientId, title, body, category, price_amount, price_currency, metadata })
		.select(ITEM_COLS)
		.single();
	if (error) return fail(400, { section: 'item', error: error.message });

	try {
		await reingestItem(item);
	} catch (e) {
		return fail(500, { section: 'item', error: `Saved, but embedding failed: ${e.message}` });
	}
	return { section: 'item', ok: `Added "${title}".` };
}

export async function updateKnowledge(clientId, form) {
	const id = String(form.get('id') ?? '');
	const title = String(form.get('title') ?? '').trim();
	const body = String(form.get('body') ?? '').trim();
	const category = String(form.get('category') ?? '').trim() || null;
	const price_currency = String(form.get('price_currency') ?? '').trim().toUpperCase() || 'USD';
	const metadata = parseDetails(form.get('details'));
	const priceRaw = String(form.get('price_amount') ?? '').trim();
	const price_amount = priceRaw ? Number(priceRaw) : null;

	if (!id || !title) return fail(400, { section: 'item', error: 'Title is required.' });
	if (priceRaw && Number.isNaN(price_amount)) return fail(400, { section: 'item', error: 'Price must be a number.' });

	const { data: item, error } = await supabase
		.from('knowledge_items')
		.update({ title, body, category, price_amount, price_currency, metadata, updated_at: new Date().toISOString() })
		.eq('id', id)
		.eq('client_id', clientId) // scoping guard
		.select(ITEM_COLS)
		.single();
	if (error) return fail(400, { section: 'item', error: error.message });

	try {
		await reingestItem(item);
	} catch (e) {
		return fail(500, { section: 'item', error: `Saved, but re-embedding failed: ${e.message}` });
	}
	return { section: 'item', ok: `Updated "${title}".` };
}

/**
 * Bulk import knowledge from pasted CSV or JSON. Creates one item per row and
 * embeds each. Returns a per-row summary so partial failures are visible.
 */
export async function importKnowledge(clientId, form) {
	const { items, errors } = parseKnowledgeInput(form.get('input'));
	if (!items.length) {
		return fail(400, { section: 'import', error: errors[0] ?? 'No valid rows found.' });
	}

	let created = 0;
	const failed = [...errors];
	for (const row of items) {
		const { data: item, error } = await supabase
			.from('knowledge_items')
			.insert({
				client_id: clientId,
				title: row.title,
				body: row.body,
				category: row.category,
				price_amount: row.price_amount,
				price_currency: row.price_currency ?? 'USD',
				metadata: row.metadata ?? {}
			})
			.select(ITEM_COLS)
			.single();
		if (error) {
			failed.push(`"${row.title}": ${error.message}`);
			continue;
		}
		try {
			await reingestItem(item);
			created++;
		} catch (e) {
			failed.push(`"${row.title}": saved but embedding failed — ${e.message}`);
		}
	}

	return {
		section: 'import',
		ok: `Imported ${created} item${created === 1 ? '' : 's'}${failed.length ? ` · ${failed.length} skipped` : ''}.`,
		failed
	};
}

export async function deleteKnowledge(clientId, form) {
	const id = String(form.get('id') ?? '');
	if (!id) return fail(400, { section: 'item', error: 'Missing item id.' });
	const { error } = await supabase
		.from('knowledge_items')
		.delete()
		.eq('id', id)
		.eq('client_id', clientId);
	if (error) return fail(400, { section: 'item', error: error.message });
	return { section: 'item', ok: 'Item deleted.' };
}

// ---- Tour departures (structured dates/pricing/availability) ---------------
export async function addDeparture(clientId, form) {
	const item_id = String(form.get('item_id') ?? '');
	const start_date = String(form.get('start_date') ?? '').trim();
	if (!item_id || !start_date) return fail(400, { section: 'departure', error: 'Tour and start date are required.' });

	// Scoping guard: the tour must belong to this client.
	const { data: item } = await supabase.from('knowledge_items').select('id').eq('id', item_id).eq('client_id', clientId).maybeSingle();
	if (!item) return fail(400, { section: 'departure', error: 'Unknown tour.' });

	const priceRaw = String(form.get('price_amount') ?? '').trim();
	const seatsRaw = String(form.get('seats_available') ?? '').trim();
	const { error } = await supabase.from('tour_departures').insert({
		client_id: clientId,
		item_id,
		start_date,
		end_date: String(form.get('end_date') ?? '').trim() || null,
		price_amount: priceRaw ? Number(priceRaw) : null,
		currency: String(form.get('currency') ?? '').trim().toUpperCase() || 'USD',
		seats_available: seatsRaw ? Number(seatsRaw) : null,
		status: String(form.get('status') ?? 'open').trim() || 'open'
	});
	if (error) return fail(400, { section: 'departure', error: error.message });
	return { section: 'departure', ok: 'Departure added.' };
}

export async function deleteDeparture(clientId, form) {
	const id = String(form.get('id') ?? '');
	if (!id) return fail(400, { section: 'departure', error: 'Missing departure id.' });
	const { error } = await supabase.from('tour_departures').delete().eq('id', id).eq('client_id', clientId);
	if (error) return fail(400, { section: 'departure', error: error.message });
	return { section: 'departure', ok: 'Departure removed.' };
}

// Text columns any settings form may carry. We only patch a column when the
// submitting form actually contains that field (form.has), so the admin's
// smaller form never wipes operator-only fields, and vice-versa.
const SETTINGS_TEXT_COLS = [
	// General
	'business_type', 'logo_url', 'brand_color',
	// Contact
	'phone', 'whatsapp_number', 'contact_email', 'website_url', 'address',
	// Assistant (business_context = system instructions)
	'assistant_name', 'tone', 'welcome_message', 'business_context', 'languages',
	// Booking
	'default_currency', 'lead_destination', 'lead_email', 'business_hours',
	// AI
	'escalation'
];

/**
 * Update client settings. Only fields present in the submitted form are patched.
 * `allowAdmin` gates fields only the super-admin may change (plan, status, active).
 */
export async function updateClientSettings(clientId, form, { allowAdmin }) {
	const patch = {};

	if (form.has('name')) {
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { section: 'client', error: 'Business name is required.' });
		patch.name = name;
	}

	for (const col of SETTINGS_TEXT_COLS) {
		if (form.has(col)) patch[col] = String(form.get(col) ?? '').trim() || null;
	}
	if ('brand_color' in patch && !patch.brand_color) patch.brand_color = '#0f6e56';
	if (patch.default_currency) patch.default_currency = patch.default_currency.toUpperCase();

	// Checkbox: a hidden `_auto_lead_capture` marker tells us the field is on the
	// form (an unchecked box submits nothing on its own).
	if (form.has('_auto_lead_capture')) patch.auto_lead_capture = form.get('auto_lead_capture') === 'on';

	if (form.has('suggested_questions')) {
		patch.suggested_questions = String(form.get('suggested_questions') ?? '')
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, 8);
	}

	if (allowAdmin) {
		// The admin settings form always carries the is_active checkbox, so an
		// unchecked box (which submits nothing) correctly means "paused".
		patch.is_active = form.get('is_active') === 'on';
		const status = String(form.get('subscription_status') ?? '').trim();
		if (['active', 'trialing', 'past_due', 'canceled'].includes(status)) patch.subscription_status = status;

		const planKey = String(form.get('plan') ?? '').trim();
		if (planKey) {
			const { data: plan } = await supabase.from('plans').select('key, monthly_conversation_cap').eq('key', planKey).maybeSingle();
			if (plan) {
				patch.plan = plan.key;
				patch.monthly_conversation_cap = plan.monthly_conversation_cap; // cap follows the plan
			}
		}
	}

	if (Object.keys(patch).length === 0) return { section: 'client', ok: 'No changes to save.' };

	const { error } = await supabase.from('clients').update(patch).eq('id', clientId);
	if (error) return fail(400, { section: 'client', error: error.message });
	return { section: 'client', ok: 'Settings saved.' };
}
