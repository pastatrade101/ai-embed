// AI Order Extraction — turns a natural-language message ("I need 20 bags of cement
// tomorrow, deliver to Mikocheni") into a structured draft order: customer, items,
// quantities, delivery date/address, notes and a confidence score. Prices are taken
// from the tenant's real catalogue (never invented); the operator always confirms.
// Metered + gated via ai.js (AI.ORDER). Industry-agnostic.
import { askJSON, AI, SONNET } from './ai.js';
import { supabase } from './supabase.js';
import { serverIndustry } from './industries.js';
import { catalogueText } from './proposal-ai.js';
import { createOrder } from './orders.js';

const ORDER_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['is_order', 'customer_name', 'items', 'delivery_date', 'delivery_address', 'notes', 'confidence', 'reasoning'],
	properties: {
		is_order: { type: 'boolean', description: 'true only if the message is genuinely placing/requesting an order for goods or services. A question, greeting or complaint is NOT an order.' },
		customer_name: { type: ['string', 'null'], description: 'The customer name if stated, else null.' },
		items: {
			type: 'array',
			description: 'The items the customer wants. Match names to the CATALOGUE where possible; otherwise use the customer’s own words.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['description', 'qty', 'unit_price'],
				properties: {
					description: { type: 'string', description: 'Item/product name, matched to the catalogue if it exists there.' },
					qty: { type: 'integer', description: 'Quantity requested (default 1).' },
					unit_price: { type: 'number', description: 'Per-unit price from the CATALOGUE only; 0 if the item is not in the catalogue or has no price.' }
				}
			}
		},
		delivery_date: { type: ['string', 'null'], description: 'Requested delivery/pickup date as YYYY-MM-DD if you can resolve it (e.g. "tomorrow" → the date), else null.' },
		delivery_address: { type: ['string', 'null'], description: 'Delivery address / area if mentioned, else null.' },
		notes: { type: ['string', 'null'], description: 'Any special instructions, else null.' },
		confidence: { type: 'integer', description: '0–100: how confident you are this is a complete, actionable order.' },
		reasoning: { type: 'string', description: 'One short sentence: what you understood.' }
	}
};

/** Resolve relative dates the model returns loosely; keep only real YYYY-MM-DD. */
function cleanDate(v) {
	if (!v || typeof v !== 'string') return null;
	const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
	if (Number.isNaN(d.getTime())) return null;
	// Reject impossible dates that V8 silently rolls over (e.g. 2026-02-30 → Mar 2).
	// getFullYear/Month/Date are local, matching the local-time construction above.
	if (d.getFullYear() !== +m[1] || d.getMonth() + 1 !== +m[2] || d.getDate() !== +m[3]) return null;
	return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Extract a structured order from a free-text message. Grounds prices in the
 * catalogue. Returns { data, error, quota } from the metered layer.
 * @param {object} p
 * @param {object} p.client   the tenant row
 * @param {string} p.message  the customer's message
 * @param {string} [p.today]  ISO date used to resolve "tomorrow" etc. (defaults to now)
 */
export async function extractOrder({ client, message, today = new Date().toISOString().slice(0, 10) }) {
	const ind = serverIndustry(client);
	const cat = await catalogueText(client.id);
	const system = `You are an order-taking assistant for ${client.name || `a ${ind.businessType}`}, a ${ind.businessType}. Read the customer message and extract a structured order.
Rules:
- Only set is_order=true if the customer is actually placing or requesting an order. Questions, greetings, small talk or complaints are NOT orders.
- Match items to the CATALOGUE by name where possible and copy the catalogue unit_price EXACTLY. If an item isn't in the catalogue, keep the customer's wording and set unit_price to 0 (the operator will price it).
- NEVER invent prices, products or quantities you weren't given. Default qty to 1 only when the customer clearly wants one.
- Resolve relative dates against TODAY (${today}) into YYYY-MM-DD. If no date is mentioned, use null.
- confidence reflects how complete and unambiguous the order is.
Return the structured object only.`;
	const user = `TODAY: ${today}\n\nCATALOGUE (the only prices you may use):\n${cat || '(no catalogue items yet — set all unit_price to 0)'}\n\nCUSTOMER MESSAGE:\n${String(message || '').slice(0, 2000)}`;

	return askJSON({
		clientId: client.id,
		planKey: client.plan,
		feature: AI.ORDER,
		model: SONNET,
		schema: ORDER_SCHEMA,
		maxTokens: 900,
		system,
		messages: [{ role: 'user', content: user }]
	});
}

/** Re-price extracted items against the catalogue (defence-in-depth: the stored price
 *  wins over whatever the model returned, so a draft can never carry an invented price). */
async function priceAgainstCatalogue(clientId, items) {
	const list = Array.isArray(items) ? items : [];
	if (!list.length) return [];
	let priced = [];
	try {
		const { data } = await supabase.from('knowledge_items').select('title, price_amount').eq('client_id', clientId).limit(300);
		// Require a real title too — a blank-title row would `includes('')`-match every
		// item and misprice the whole order.
		priced = (data || []).filter((i) => i.price_amount != null && i.price_amount !== '' && String(i.title || '').trim() !== '');
	} catch {
		/* no catalogue → prices stay 0, operator prices manually */
	}
	return list
		.map((it) => {
			const name = String(it.description || '').toLowerCase().trim();
			if (!name) return null;
			const match = priced.find((i) => {
				const t = String(i.title || '').toLowerCase().trim();
				return t && (t === name || t.includes(name) || name.includes(t));
			});
			// Money-safety invariant: ONLY a catalogue match may carry a price. A non-match
			// is priced 0 (the operator sets it on review) — the AI can never inject a price.
			const unit = match ? Math.max(0, Number(match.price_amount) || 0) : 0;
			return { description: match ? match.title : String(it.description || '').trim(), qty: Math.max(1, Number(it.qty) || 1), unit_price: unit };
		})
		.filter(Boolean);
}

/**
 * Extract + persist a draft order from a message. Confidence decides the entry status:
 *   ≥ 70 → pending_confirmation (a clean order, awaiting the operator's OK)
 *   < 70 → ai_parsed            (needs review)
 * Returns { order, extraction, skipped }.
 */
export async function draftOrderFromMessage({ client, message, from = null, leadId = null, conversationId = null, source = 'whatsapp' }) {
	const res = await extractOrder({ client, message });
	if (res.error || !res.data) return { order: null, extraction: null, skipped: res.error || 'ai_failed' };
	const ex = res.data;
	if (!ex.is_order || !Array.isArray(ex.items) || ex.items.length === 0) return { order: null, extraction: ex, skipped: 'not_an_order' };

	const items = await priceAgainstCatalogue(client.id, ex.items);
	if (!items.length) return { order: null, extraction: ex, skipped: 'no_items' };

	const confidence = Math.max(0, Math.min(100, Number(ex.confidence) || 0));
	const { order } = await createOrder(client.id, {
		lead_id: leadId,
		conversation_id: conversationId,
		source,
		status: confidence >= 70 ? 'pending_confirmation' : 'ai_parsed',
		customer_name: ex.customer_name || null,
		customer_phone: from || null,
		currency: client.default_currency || 'USD',
		items,
		delivery_date: cleanDate(ex.delivery_date),
		delivery_address: ex.delivery_address || null,
		notes: ex.notes || null,
		confidence,
		meta: { extracted: true, reasoning: ex.reasoning || '', raw_message: String(message || '').slice(0, 500) }
	});
	return { order, extraction: ex, skipped: order ? null : 'create_failed' };
}
