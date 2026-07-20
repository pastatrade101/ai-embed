// Invoices — deliberately NOT a separate engine. An invoice is generated from an order
// and reuses the Proposal engine (doc_type 'invoice'): same numbering, hosted /p/<token>
// page, view-tracking and accept flow. This keeps one document engine and avoids a
// parallel invoicing system. Lives inside the order journey, not its own nav.
import { getOrder, updateOrder, addOrderEvent } from './orders.js';
import { createProposal, getProposal } from './proposals.js';

/**
 * Generate (once) an invoice for an order. Snapshots the order's items + totals into a
 * proposal row of doc_type 'invoice'. Idempotent: returns the existing invoice if one
 * was already generated. Returns { invoice, error }.
 */
export async function generateInvoiceFromOrder(clientId, orderId, { validDays = 14 } = {}) {
	const { order } = await getOrder(clientId, orderId);
	if (!order) return { invoice: null, error: 'order_not_found' };

	// Already invoiced → return it.
	const existingId = order.meta?.invoice?.proposal_id;
	if (existingId) {
		const { proposal } = await getProposal(clientId, existingId);
		if (proposal) return { invoice: proposal };
	}

	const validUntil = new Date();
	validUntil.setDate(validUntil.getDate() + validDays);

	const { proposal, error } = await createProposal(clientId, {
		doc_type: 'invoice',
		lead_id: order.lead_id || null,
		title: `Invoice for order ${order.number}`,
		customer_name: order.customer_name,
		customer_email: order.customer_email,
		customer_phone: order.customer_phone,
		currency: order.currency,
		line_items: (order.items || []).map((i) => ({ description: i.description, detail: i.detail || null, qty: i.qty, unit_price: i.unit_price })),
		discount: order.discount,
		tax: order.tax,
		valid_until: validUntil.toISOString().slice(0, 10),
		notes: order.notes || null,
		meta: { order_id: order.id, order_number: order.number }
	});
	if (error || !proposal) return { invoice: null, error: error?.message || 'create_failed' };

	// Link the invoice back onto the order + timeline.
	const meta = { ...(order.meta || {}), invoice: { proposal_id: proposal.id, number: proposal.number, token: proposal.public_token, generated_at: new Date().toISOString() } };
	await updateOrder(clientId, orderId, { meta });
	await addOrderEvent(orderId, clientId, 'invoice_generated', { number: proposal.number });
	return { invoice: proposal };
}

/** Fetch the order's linked invoice (proposal), if any. */
export async function getOrderInvoice(clientId, order) {
	const id = order?.meta?.invoice?.proposal_id;
	if (!id) return { invoice: null };
	const { proposal } = await getProposal(clientId, id);
	return { invoice: proposal || null };
}
