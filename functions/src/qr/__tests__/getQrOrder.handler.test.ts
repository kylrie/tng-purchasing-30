/**
 * Integration tests — getQrOrder handler (Sprint 2).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: sanitized customer projection (no businessUnitId / tableId / xendit* /
 * officialInvoice* leakage), table-number resolution, not-found / invalid input,
 * and per-order rate limiting.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getQrOrderHandler } from '../getQrOrder.handler';
import { MENU_READ_LIMIT } from '../rateLimit';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

// Fields that must NEVER appear in the customer DTO even though they live on the
// stored order document.
const SENSITIVE_KEYS = ['businessUnitId', 'tableId', 'xenditPaymentId', 'officialInvoiceNumber', 'updatedAt', 'orderType'];

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('qr_tables', 't1', { tableNumber: '12', businessUnitId: 'bu1', isActive: true });
    fake._seed('qr_orders', 'o1', {
        id: 'o1',
        businessUnitId: 'bu1',
        tableId: 't1',
        orderNumber: 'QR-00001',
        items: [
            { menuItemId: 'm1', productName: 'Sisig', quantity: 2, unitPrice: 285, subtotal: 570, category: 'Appetizers', notes: 'extra spicy' },
            { menuItemId: 'm2', productName: 'Iced Tea', quantity: 1, unitPrice: 95, subtotal: 95, category: 'Soft Drinks' },
        ],
        orderType: 'DINE_IN',
        subtotal: 665, taxAmount: 0, totalAmount: 665, currency: 'PHP',
        status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID',
        customerName: 'Ana',
        // Sensitive/internal fields that must not surface:
        xenditPaymentId: 'py-secret', officialInvoiceNumber: 'OR-999',
        createdAt: { toMillis: () => 1_700_000_000_000 },
        updatedAt: { toMillis: () => 1_700_000_000_001 },
    });
    // An order whose table doc is missing — tableNumber should resolve to ''.
    fake._seed('qr_orders', 'o2', {
        id: 'o2', businessUnitId: 'bu1', tableId: 'gone', orderNumber: 'QR-00002',
        items: [], subtotal: 0, taxAmount: 0, totalAmount: 0, currency: 'PHP',
        status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID',
    });
    return fake;
}

test('getQrOrder: returns a sanitized customer projection with resolved table number', async () => {
    const fake = seed();
    const res = await getQrOrderHandler(asDb(fake), req({ orderId: 'o1' }));

    assert.equal(res.orderId, 'o1');
    assert.equal(res.orderNumber, 'QR-00001');
    assert.equal(res.tableNumber, '12');
    assert.equal(res.status, 'AWAITING_PAYMENT');
    assert.equal(res.paymentStatus, 'UNPAID');
    assert.equal(res.totalAmount, 665);
    assert.equal(res.currency, 'PHP');
    assert.equal(res.customerName, 'Ana');
    assert.equal(res.createdAtMillis, 1_700_000_000_000);

    // Items are whitelisted (no menuItemId leak into the customer line either).
    assert.equal(res.items.length, 2);
    assert.deepEqual(Object.keys(res.items[0]).sort(), ['category', 'notes', 'productName', 'quantity', 'subtotal', 'unitPrice'].sort());
    assert.equal(res.items[0].productName, 'Sisig');
    assert.equal(res.items[0].notes, 'extra spicy');

    // No sensitive/internal fields leak into the top-level DTO.
    const top = res as unknown as Record<string, unknown>;
    for (const key of SENSITIVE_KEYS) {
        assert.equal(key in top, false, `leaked sensitive field: ${key}`);
    }
});

test('getQrOrder: tolerates a missing table doc (tableNumber empty)', async () => {
    const fake = seed();
    const res = await getQrOrderHandler(asDb(fake), req({ orderId: 'o2' }));
    assert.equal(res.tableNumber, '');
    assert.equal(res.items.length, 0);
    assert.equal(res.orderNumber, 'QR-00002');
});

test('getQrOrder: rejects a missing orderId', async () => {
    const fake = seed();
    await expectReject(() => getQrOrderHandler(asDb(fake), req({})), 'invalid-argument');
});

test('getQrOrder: rejects an unknown orderId with not-found', async () => {
    const fake = seed();
    await expectReject(() => getQrOrderHandler(asDb(fake), req({ orderId: 'nope' })), 'not-found');
});

test('getQrOrder: allows up to the read limit, then rate-limits', async () => {
    const fake = seed();
    for (let i = 0; i < MENU_READ_LIMIT.maxRequests; i++) {
        await getQrOrderHandler(asDb(fake), req({ orderId: 'o1' }));
    }
    await expectReject(() => getQrOrderHandler(asDb(fake), req({ orderId: 'o1' })), 'resource-exhausted');
});
