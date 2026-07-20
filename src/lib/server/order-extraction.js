// AI Order Extraction (v2) — the product's core: turn a messy WhatsApp message into a
// structured order the owner can confirm with almost no typing. The AI scores EVERY
// field's confidence, names what's missing, and writes the exact clarification question
// to ask the customer — so the review UI can highlight ONLY the uncertain fields.
// Prices come from the tenant's catalogue (never invented). Metered via ai.js (AI.ORDER).
import { askJSON, AI, SONNET } from './ai.js';
import { supabase } from './supabase.js';
import { serverIndustry } from './industries.js';
import { catalogueText } from './proposal-ai.js';
import { createOrder } from './orders.js';
import { matchProduct, listCatalogueForMatching } from './products.js';
import { fromMinor } from './money.js';

const clampInt = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

const ORDER_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['is_order', 'overall_confidence', 'customer_name', 'customer_confidence', 'items', 'delivery_address', 'delivery_date', 'delivery_confidence', 'notes', 'missing_fields', 'clarification_question', 'reasoning'],
	properties: {
		is_order: { type: 'boolean', description: 'true ONLY if the customer is genuinely placing/requesting an order for goods or services. A greeting, a price/stock/delivery enquiry, small talk or a complaint is NOT an order.' },
		overall_confidence: { type: 'integer', description: '0–100: overall confidence this is a complete, actionable order.' },
		customer_name: { type: ['string', 'null'], description: 'The customer’s name if stated in the message, else null.' },
		customer_confidence: { type: 'integer', description: '0–100 confidence in the customer identity (0 if not given).' },
		items: {
			type: 'array',
			description: 'Each distinct item the customer wants. Understand mixed Swahili/English (e.g. "mifuko 20 ya cement" = 20 bags of cement; "chaja mbili" = 2 chargers).',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['raw_text', 'description', 'qty', 'unit', 'unit_price', 'confidence'],
				properties: {
					raw_text: { type: 'string', description: 'The exact words the customer used for this item.' },
					description: { type: 'string', description: 'Normalised item name; use the CATALOGUE name if it matches one.' },
					qty: { type: 'integer', description: 'Quantity requested. Default to 1 only if the customer clearly wants one.' },
					unit: { type: ['string', 'null'], description: 'Unit if stated (bag, box, piece, kg…), else null.' },
					unit_price: { type: 'number', description: 'Per-unit price from the CATALOGUE only; 0 if the item is not in the catalogue.' },
					confidence: { type: 'integer', description: '0–100 confidence you correctly understood this item AND its quantity.' }
				}
			}
		},
		delivery_address: { type: ['string', 'null'], description: 'Delivery address/area if mentioned, else null.' },
		delivery_date: { type: ['string', 'null'], description: 'Requested date as YYYY-MM-DD, resolving "kesho"/"tomorrow"/"leo" against TODAY; null if none stated.' },
		delivery_confidence: { type: 'integer', description: '0–100 confidence in the delivery details (0 if none given).' },
		notes: { type: ['string', 'null'], description: 'Any special instructions, else null.' },
		missing_fields: { type: 'array', items: { type: 'string', enum: ['customer_name', 'delivery_address', 'delivery_date', 'quantity', 'item', 'price'] }, description: 'Important fields the customer did NOT provide and that the owner would need.' },
		clarification_question: { type: ['string', 'null'], description: 'ONE short, friendly question in the CUSTOMER’S language to fill the single most important gap; null if nothing important is missing.' },
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
	// Reject impossible dates V8 silently rolls over (e.g. 2026-02-30 → Mar 2).
	if (d.getFullYear() !== +m[1] || d.getMonth() + 1 !== +m[2] || d.getDate() !== +m[3]) return null;
	return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Extract a structured order (with per-field confidence) from a free-text message.
 * Returns { data, error, quota } from the metered layer.
 */
export async function extractOrder({ client, message, today = new Date().toISOString().slice(0, 10) }) {
	const ind = serverIndustry(client);
	const cat = await catalogueText(client.id);
	const system = `You turn a customer's WhatsApp message to ${client.name || `a ${ind.businessType}`} (a ${ind.businessType}) into a structured order. Customers write informally, often mixing Swahili and English, with typos and shorthand — understand them.

Rules:
- is_order = true ONLY if they are actually placing/requesting an order. A greeting, a "how much?"/"do you have?"/"where are you?" enquiry, or a complaint is NOT an order.
- Extract every distinct item with its quantity and unit. Match item names to the CATALOGUE where possible and copy the catalogue unit_price EXACTLY; if an item isn't in the catalogue, keep the customer's wording and set unit_price = 0.
- NEVER invent prices, products, quantities, names or addresses. If something isn't in the message, leave it null/0 and list it in missing_fields.
- Score confidence HONESTLY per field (customer_confidence, delivery_confidence, and each item's confidence) and overall. Low confidence is fine and useful — it tells the owner what to check.
- Resolve relative dates against TODAY (${today}) to YYYY-MM-DD.
- If an important field is missing, write ONE short, friendly clarification_question in the customer's own language to ask for it (the most important gap only).
Return the structured object only.`;
	const user = `TODAY: ${today}\n\nCATALOGUE (the only prices you may use):\n${cat || '(no catalogue yet — set all unit_price to 0)'}\n\nCUSTOMER MESSAGE:\n${String(message || '').slice(0, 2000)}`;

	return askJSON({
		clientId: client.id,
		planKey: client.plan,
		feature: AI.ORDER,
		model: SONNET,
		schema: ORDER_SCHEMA,
		maxTokens: 1100,
		system,
		messages: [{ role: 'user', content: user }]
	});
}

/** Re-price extracted items against the catalogue (the stored price always wins, so a
 *  draft can never carry an invented price) and carry per-item extraction signals
 *  (raw_text, confidence, alternatives) through for the review UI. */
async function priceAgainstCatalogue(clientId, items) {
	const list = Array.isArray(items) ? items : [];
	if (!list.length) return [];

	if (await listCatalogueForMatching(clientId)) {
		const out = [];
		for (const it of list) {
			const name = String(it.description || '').trim();
			if (!name) continue;
			const base = { qty: Math.max(1, Number(it.qty) || 1), unit: it.unit || undefined, raw_text: it.raw_text || name, item_confidence: clampInt(it.confidence) };
			const { product, confidence, alternatives } = await matchProduct(clientId, name);
			if (product) {
				out.push({ ...base, description: product.name, unit: it.unit || product.unit || undefined, unit_price: fromMinor(product.price_minor, product.currency), product_id: product.id, match_confidence: confidence, alternatives: alternatives || [] });
			} else {
				out.push({ ...base, description: name, unit_price: 0, product_id: null, unmatched: true });
			}
		}
		return out;
	}

	// Fallback: knowledge_items catalogue (no products module / empty catalogue).
	let priced = [];
	try {
		const { data } = await supabase.from('knowledge_items').select('title, price_amount').eq('client_id', clientId).limit(300);
		priced = (data || []).filter((i) => i.price_amount != null && i.price_amount !== '' && String(i.title || '').trim() !== '');
	} catch {
		/* no catalogue → prices stay 0 */
	}
	return list
		.map((it) => {
			const name = String(it.description || '').toLowerCase().trim();
			if (!name) return null;
			const match = priced.find((i) => {
				const t = String(i.title || '').toLowerCase().trim();
				return t && (t === name || t.includes(name) || name.includes(t));
			});
			return {
				description: match ? match.title : String(it.description || '').trim(),
				qty: Math.max(1, Number(it.qty) || 1),
				unit: it.unit || undefined,
				unit_price: match ? Math.max(0, Number(match.price_amount) || 0) : 0,
				raw_text: it.raw_text || name,
				item_confidence: clampInt(it.confidence),
				unmatched: !match
			};
		})
		.filter(Boolean);
}

/**
 * Extract + persist a DRAFT order from a message. Stores per-field confidence, the
 * missing fields and the clarification question in meta.extraction so the transformation
 * workspace can highlight only what's uncertain. Never auto-confirms.
 * Returns { order, extraction, skipped }.
 */
export async function draftOrderFromMessage({ client, message, from = null, leadId = null, conversationId = null, source = 'whatsapp' }) {
	const res = await extractOrder({ client, message });
	if (res.error || !res.data) return { order: null, extraction: null, skipped: res.error || 'ai_failed' };
	const ex = res.data;
	if (!ex.is_order || !Array.isArray(ex.items) || ex.items.length === 0) return { order: null, extraction: ex, skipped: 'not_an_order' };

	const items = await priceAgainstCatalogue(client.id, ex.items);
	if (!items.length) return { order: null, extraction: ex, skipped: 'no_items' };

	const overall = clampInt(ex.overall_confidence);
	const { order } = await createOrder(client.id, {
		lead_id: leadId,
		conversation_id: conversationId,
		source,
		status: 'draft',
		customer_name: ex.customer_name || null,
		customer_phone: from || null,
		currency: client.default_currency || 'USD',
		items,
		delivery_date: cleanDate(ex.delivery_date),
		delivery_address: ex.delivery_address || null,
		notes: ex.notes || null,
		confidence: overall,
		meta: {
			extracted: true,
			reasoning: ex.reasoning || '',
			raw_message: String(message || '').slice(0, 1000),
			extraction: {
				overall,
				customer_confidence: clampInt(ex.customer_confidence),
				delivery_confidence: clampInt(ex.delivery_confidence),
				missing_fields: Array.isArray(ex.missing_fields) ? ex.missing_fields : [],
				clarification_question: ex.clarification_question || null
			}
		}
	});
	return { order, extraction: ex, skipped: order ? null : 'create_failed' };
}
