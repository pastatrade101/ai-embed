// Money invariants — integer minor units, no float drift. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinor, fromMinor, computeMinorTotals, formatMoney, minorPerUnit, pctMinor } from '../src/lib/server/money.js';

test('toMinor parses human amounts to integer minor units', () => {
	assert.equal(toMinor('1,250.50', 'TZS'), 125050);
	assert.equal(toMinor(1250.5, 'USD'), 125050);
	assert.equal(toMinor('0', 'USD'), 0);
	assert.equal(toMinor('', 'USD'), 0);
	assert.equal(toMinor('abc', 'USD'), 0);
	assert.ok(Number.isInteger(toMinor(19.99, 'USD')));
});

test('zero-decimal currencies use whole units', () => {
	assert.equal(minorPerUnit('UGX'), 1);
	assert.equal(toMinor(5000, 'UGX'), 5000);
	assert.equal(minorPerUnit('USD'), 100);
});

test('no float drift: 0.1 + 0.2 in minor units is exact', () => {
	const a = toMinor(0.1, 'USD');
	const b = toMinor(0.2, 'USD');
	assert.equal(a + b, 30); // 0.30 exactly, not 0.30000000000000004
});

test('computeMinorTotals: subtotal, discount clamp, tax, delivery', () => {
	const items = [
		{ qty: 20, unit_price_minor: 1000 }, // 20 × 10.00 = 200.00
		{ qty: 3, unit_price_minor: 2500 } //   3 × 25.00 =  75.00
	];
	const t = computeMinorTotals(items, { discountMinor: 5000, taxRate: 18, deliveryMinor: 3000 });
	assert.equal(t.subtotalMinor, 27500); // 275.00
	assert.equal(t.discountMinor, 5000); // 50.00
	// taxable = 225.00 → 18% = 40.50
	assert.equal(t.taxMinor, 4050);
	assert.equal(t.deliveryMinor, 3000);
	assert.equal(t.totalMinor, 27500 - 5000 + 4050 + 3000); // 30550
});

test('discount cannot exceed subtotal; total never negative', () => {
	const t = computeMinorTotals([{ qty: 1, unit_price_minor: 1000 }], { discountMinor: 999999 });
	assert.equal(t.discountMinor, 1000);
	assert.equal(t.totalMinor, 0);
});

test('pctMinor rounds to nearest minor unit', () => {
	assert.equal(pctMinor(10000, 18), 1800);
	assert.equal(pctMinor(333, 18), 60); // 59.94 → 60
});

test('formatMoney renders with the right decimals', () => {
	assert.equal(formatMoney(125050, 'TZS'), 'TZS 1,250.50');
	assert.equal(formatMoney(5000, 'UGX'), 'UGX 5,000');
});

test('round-trip toMinor→fromMinor is lossless at 2dp', () => {
	for (const v of [0.01, 1, 19.99, 1250.5, 999999.99]) {
		assert.equal(fromMinor(toMinor(v, 'USD'), 'USD'), v);
	}
});
