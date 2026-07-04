/**
 * Unit tests for QR Ordering pure logic (Sprint 1).
 *
 * Uses Node's built-in test runner (node:test + node:assert) — no test
 * framework dependency. Run with:  npx tsx --test functions/src/qr/orderLogic.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    sanitizeMenuItem, repriceLine, computeOrderTotals, formatOrderNumber,
    encodeQrToken, normalizeNote, normalizeCustomerName, validateCreateOrderInput,
    money, RawMenuItem,
} from './orderLogic';

// A raw menu item carrying the sensitive fields the public projection must strip.
const rawWithSensitiveFields = {
    id: 'm1', businessUnitId: 'bu1', name: 'Sisig', category: 'Mains',
    sellingPrice: 285, description: 'Sizzling pork', imageUrl: '/x.jpg', isActive: true,
    // fields that must NEVER leak:
    calculatedCost: 90, grossMargin: 195, marginPercent: 68, foodCostPercent: 32,
    ingredients: [{ secret: true }], linkedInventoryItemId: 'inv-1',
} as unknown as RawMenuItem;

test('sanitizeMenuItem strips cost/margin/recipe and maps isActive→isAvailable', () => {
    const dto = sanitizeMenuItem(rawWithSensitiveFields) as unknown as Record<string, unknown>;
    assert.deepEqual(Object.keys(dto).sort(), ['category', 'description', 'id', 'imageUrl', 'isAvailable', 'name', 'sellingPrice'].sort());
    assert.equal(dto.isAvailable, true);
    // Sensitive fields absent:
    for (const leak of ['calculatedCost', 'grossMargin', 'marginPercent', 'foodCostPercent', 'ingredients', 'linkedInventoryItemId', 'businessUnitId']) {
        assert.equal(leak in dto, false, `leaked ${leak}`);
    }
});

test('sanitizeMenuItem maps isActive:false → isAvailable:false', () => {
    const dto = sanitizeMenuItem({ ...rawWithSensitiveFields, isActive: false });
    assert.equal(dto.isAvailable, false);
});

test('repriceLine uses the SERVER price, ignoring any client-supplied price', () => {
    const line = { menuItemId: 'm1', quantity: 3, notes: '  extra spicy  ' } as unknown as { menuItemId: string; quantity: number; notes?: string };
    // Attacker also sends unitPrice: 1 — it is not part of OrderLineInput and is ignored.
    (line as Record<string, unknown>).unitPrice = 1;
    const priced = repriceLine(line, rawWithSensitiveFields, 'bu1');
    assert.equal(priced.unitPrice, 285);
    assert.equal(priced.subtotal, 855);
    assert.equal(priced.notes, 'extra spicy'); // trimmed
    assert.equal(priced.productName, 'Sisig');
});

test('repriceLine rejects missing / wrong-BU / inactive items', () => {
    assert.throws(() => repriceLine({ menuItemId: 'x', quantity: 1 }, undefined, 'bu1'), /MENU_ITEM_NOT_FOUND/);
    assert.throws(() => repriceLine({ menuItemId: 'm1', quantity: 1 }, rawWithSensitiveFields, 'OTHER_BU'), /MENU_ITEM_WRONG_BU/);
    assert.throws(() => repriceLine({ menuItemId: 'm1', quantity: 1 }, { ...rawWithSensitiveFields, isActive: false }, 'bu1'), /MENU_ITEM_UNAVAILABLE/);
});

test('computeOrderTotals sums subtotals and sets tax = 0 (Sprint 1)', () => {
    const totals = computeOrderTotals([
        { menuItemId: 'a', productName: 'A', quantity: 2, unitPrice: 285, subtotal: 570, category: 'Mains' },
        { menuItemId: 'b', productName: 'B', quantity: 1, unitPrice: 95, subtotal: 95, category: 'Drinks' },
    ]);
    assert.deepEqual(totals, { subtotal: 665, taxAmount: 0, totalAmount: 665 });
});

test('money() avoids binary-float drift', () => {
    assert.equal(money(0.1 + 0.2), 0.3);
    assert.equal(money(285 * 3), 855);
});

test('formatOrderNumber zero-pads to 5 with QR prefix', () => {
    assert.equal(formatOrderNumber(1), 'QR-00001');
    assert.equal(formatOrderNumber(42), 'QR-00042');
    assert.equal(formatOrderNumber(123456), 'QR-123456');
});

test('encodeQrToken is deterministic given bytes and only uses base62', () => {
    const t = encodeQrToken([0, 61, 62, 123]); // 62%62=0 → 'A', 123%62=61 → '9'
    assert.equal(t, 'A9A9');
    assert.match(encodeQrToken([1, 2, 3, 250, 200]), /^[A-Za-z0-9]+$/);
});

test('normalizeNote / normalizeCustomerName trim, cap length, and drop empties', () => {
    assert.equal(normalizeNote('   '), undefined);
    assert.equal(normalizeNote('  hi  '), 'hi');
    assert.equal(normalizeNote('x'.repeat(200))!.length, 120);
    assert.equal(normalizeCustomerName(42 as unknown as string), undefined);
    assert.equal(normalizeCustomerName('  Ana  '), 'Ana');
});

test('validateCreateOrderInput accepts a good payload and normalizes it', () => {
    const v = validateCreateOrderInput({
        tableId: 't1',
        items: [{ menuItemId: 'm1', quantity: 2, notes: ' no onions ' }],
        customerName: '  Ana  ',
    });
    assert.equal(v.tableId, 't1');
    assert.equal(v.lines.length, 1);
    assert.equal(v.lines[0].notes, 'no onions');
    assert.equal(v.customerName, 'Ana');
});

test('validateCreateOrderInput rejects bad payloads', () => {
    assert.throws(() => validateCreateOrderInput(null), /INVALID_INPUT/);
    assert.throws(() => validateCreateOrderInput({ tableId: '', items: [] }), /tableId/);
    assert.throws(() => validateCreateOrderInput({ tableId: 't', items: [] }), /items-empty/);
    assert.throws(() => validateCreateOrderInput({ tableId: 't', items: [{ menuItemId: 'm', quantity: 0 }] }), /quantity/);
    assert.throws(() => validateCreateOrderInput({ tableId: 't', items: [{ menuItemId: 'm', quantity: 1.5 }] }), /quantity/);
    assert.throws(() => validateCreateOrderInput({ tableId: 't', items: [{ menuItemId: '', quantity: 1 }] }), /menuItemId/);
});

test('validateCreateOrderInput accepts a valid idempotency key (either field name)', () => {
    const good = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // 36-char UUID
    const v1 = validateCreateOrderInput({ tableId: 't', items: [{ menuItemId: 'm', quantity: 1 }], idempotencyKey: good });
    assert.equal(v1.idempotencyKey, good);
    const v2 = validateCreateOrderInput({ tableId: 't', items: [{ menuItemId: 'm', quantity: 1 }], clientRequestId: good });
    assert.equal(v2.idempotencyKey, good);
    // Absent key is fine (backward compatible).
    const v3 = validateCreateOrderInput({ tableId: 't', items: [{ menuItemId: 'm', quantity: 1 }] });
    assert.equal(v3.idempotencyKey, undefined);
});

test('validateCreateOrderInput rejects a malformed idempotency key', () => {
    const base = { tableId: 't', items: [{ menuItemId: 'm', quantity: 1 }] };
    assert.throws(() => validateCreateOrderInput({ ...base, idempotencyKey: 'short' }), /idempotencyKey/);      // < 8
    assert.throws(() => validateCreateOrderInput({ ...base, idempotencyKey: 'a'.repeat(65) }), /idempotencyKey/); // > 64
    assert.throws(() => validateCreateOrderInput({ ...base, idempotencyKey: 'bad key!' }), /idempotencyKey/);    // space + '!'
    assert.throws(() => validateCreateOrderInput({ ...base, idempotencyKey: 'has:colon:here' }), /idempotencyKey/); // ':' excluded
    assert.throws(() => validateCreateOrderInput({ ...base, idempotencyKey: 12345678 }), /idempotencyKey/);      // not a string
});
