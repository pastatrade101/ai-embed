// Money — integer minor units only. Every monetary value in the commerce modules
// (products, inventory, invoices, payments) is stored and computed as an INTEGER
// number of minor units (cents/senti), never a float. This avoids the classic
// 0.1 + 0.2 rounding drift and keeps totals exact end-to-end.
//
// NOTE: the older proposals/orders engine predates this and uses numeric(2dp);
// convert at the boundary with toMinor()/fromMinor() when generating an invoice
// from an order so historical snapshots stay exact.

// Currencies whose "minor unit" is the whole unit (no decimals). Extend as needed.
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'UGX', 'RWF', 'XOF', 'XAF', 'CLP', 'ISK']);

/** Minor units per major unit for a currency (100 for USD/TZS/KES/EUR, 1 for JPY…). */
export function minorPerUnit(currency = 'USD') {
	return ZERO_DECIMAL.has(String(currency || '').toUpperCase()) ? 1 : 100;
}

/** Parse a human amount ("1,250.50", 1250.5) → integer minor units. Never a float result. */
export function toMinor(amount, currency = 'USD') {
	if (amount == null || amount === '') return 0;
	const per = minorPerUnit(currency);
	const num = typeof amount === 'number' ? amount : Number(String(amount).replace(/[^0-9.-]/g, ''));
	if (!Number.isFinite(num)) return 0;
	// Round half-away-from-zero at the minor-unit scale, then return an integer.
	return Math.round(num * per);
}

/** Minor units → major-unit number for display math only (not for storage). */
export function fromMinor(minor, currency = 'USD') {
	return (Number(minor) || 0) / minorPerUnit(currency);
}

/** Sum a list of integer minor-unit values (guards against float contamination). */
export function sumMinor(values = []) {
	return values.reduce((a, v) => a + Math.round(Number(v) || 0), 0);
}

/** qty (integer) × unit price (minor units) → line amount (minor units). */
export function lineAmountMinor(qty, unitMinor) {
	return Math.round((Number(qty) || 0)) * Math.round(Number(unitMinor) || 0);
}

/** Percentage of a minor-unit base as minor units (e.g. 18% tax). Rounds to nearest minor unit. */
export function pctMinor(baseMinor, pct) {
	return Math.round(((Number(baseMinor) || 0) * (Number(pct) || 0)) / 100);
}

/**
 * Compute document totals in minor units from line items.
 * @param {Array<{qty:number, unit_price_minor:number}>} items
 * @param {object} opts { discountMinor, taxRate (%), taxMinor, deliveryMinor }
 * @returns {{ subtotalMinor, discountMinor, taxMinor, deliveryMinor, totalMinor, lines }}
 */
export function computeMinorTotals(items = [], { discountMinor = 0, taxRate = 0, taxMinor = null, deliveryMinor = 0 } = {}) {
	const lines = (Array.isArray(items) ? items : []).map((it) => {
		const qty = Math.max(0, Math.round(Number(it.qty) || 0));
		const unit = Math.max(0, Math.round(Number(it.unit_price_minor) || 0));
		return { ...it, qty, unit_price_minor: unit, amount_minor: qty * unit };
	});
	const subtotalMinor = sumMinor(lines.map((l) => l.amount_minor));
	const disc = Math.min(Math.max(0, Math.round(discountMinor || 0)), subtotalMinor);
	const taxable = subtotalMinor - disc;
	const tax = taxMinor != null ? Math.max(0, Math.round(taxMinor)) : pctMinor(taxable, taxRate);
	const delivery = Math.max(0, Math.round(deliveryMinor || 0));
	const totalMinor = Math.max(0, taxable + tax + delivery);
	return { subtotalMinor, discountMinor: disc, taxMinor: tax, deliveryMinor: delivery, totalMinor, lines };
}

/** Format minor units for display, e.g. formatMoney(125050,'TZS') → "TZS 1,250.50". */
export function formatMoney(minor, currency = 'USD') {
	const per = minorPerUnit(currency);
	const major = (Number(minor) || 0) / per;
	const decimals = per === 1 ? 0 : 2;
	return `${String(currency || '').toUpperCase()} ${major.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
