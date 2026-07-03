/**
 * Integration tests — createQrOrder handler (Sprint 1).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers item 5: persistence (AWAITING_PAYMENT / UNPAID), server-side pricing,
 * inactive-item rejection, invalid-table rejection, and counter increment.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQrOrderHandler } from '../createQrOrder.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seedMenuAndTable(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('qr_tables', 't1', { businessUnitId: 'bu1', tableNumber: '12', isActive: true });
    fake._seed('qr_tables', 't-off', { businessUnitId: 'bu1', tableNumber: '99', isActive: false });
    // Active item, carrying sensitive fields (must never affect pricing/output).
    fake._seed('menu_items', 'm1', {
        businessUnitId: 'bu1', name: 'Sisig', category: 'Mains', sellingPrice: 285, isActive: true,
        calculatedCost: 90, grossMargin: 195,
    });
    fake._seed('menu_items', 'm2', {
        businessUnitId: 'bu1', name: 'House Iced Tea', category: 'Drinks', sellingPrice: 95, isActive: true,
    });
    fake._seed('menu_items', 'm-off', {
        businessUnitId: 'bu1', name: 'Sold Out Special', category: 'Mains', sellingPrice: 500, isActive: false,
    });
    return fake;
}

test('createQrOrder: creates a qr_order as AWAITING_PAYMENT / UNPAID', async () => {
    const fake = seedMenuAndTable();
    const res = await createQrOrderHandler(asDb(fake), req({
        tableId: 't1',
        items: [{ menuItemId: 'm1', quantity: 2 }, { menuItemId: 'm2', quantity: 1 }],
    }));
    assert.equal(res.status, 'AWAITING_PAYMENT');
    assert.equal(res.currency, 'PHP');

    const stored = fake._read('qr_orders', res.orderId)!;
    assert.equal(stored.status, 'AWAITING_PAYMENT');
    assert.equal(stored.paymentStatus, 'UNPAID');
    assert.equal(stored.businessUnitId, 'bu1');
    assert.equal(stored.tableId, 't1');
    assert.equal(stored.orderType, 'DINE_IN');
});

test('createQrOrder: uses the SERVER menu price, ignoring any client-sent price', async () => {
    const fake = seedMenuAndTable();
    // Attacker sends unitPrice: 1 — it is not part of the accepted input and must be ignored.
    const res = await createQrOrderHandler(asDb(fake), req({
        tableId: 't1',
        items: [{ menuItemId: 'm1', quantity: 2, unitPrice: 1 }],
    }));
    const stored = fake._read('qr_orders', res.orderId)! as unknown as { items: { unitPrice: number; subtotal: number }[]; totalAmount: number };
    assert.equal(stored.items[0].unitPrice, 285);   // server price
    assert.equal(stored.items[0].subtotal, 570);
    assert.equal(stored.totalAmount, 570);
    assert.equal(res.totalAmount, 570);
});

test('createQrOrder: rejects an inactive menu item', async () => {
    const fake = seedMenuAndTable();
    await expectReject(
        () => createQrOrderHandler(asDb(fake), req({ tableId: 't1', items: [{ menuItemId: 'm-off', quantity: 1 }] })),
        'failed-precondition',
    );
});

test('createQrOrder: rejects a cross-BU menu item', async () => {
    const fake = seedMenuAndTable();
    fake._seed('menu_items', 'other', { businessUnitId: 'bu2', name: 'X', category: 'Mains', sellingPrice: 100, isActive: true });
    await expectReject(
        () => createQrOrderHandler(asDb(fake), req({ tableId: 't1', items: [{ menuItemId: 'other', quantity: 1 }] })),
        'failed-precondition',
    );
});

test('createQrOrder: rejects an invalid / nonexistent table', async () => {
    const fake = seedMenuAndTable();
    await expectReject(
        () => createQrOrderHandler(asDb(fake), req({ tableId: 'nope', items: [{ menuItemId: 'm1', quantity: 1 }] })),
        'not-found',
    );
});

test('createQrOrder: rejects an inactive table', async () => {
    const fake = seedMenuAndTable();
    await expectReject(
        () => createQrOrderHandler(asDb(fake), req({ tableId: 't-off', items: [{ menuItemId: 'm1', quantity: 1 }] })),
        'failed-precondition',
    );
});

test('createQrOrder: rejects empty / malformed input', async () => {
    const fake = seedMenuAndTable();
    await expectReject(
        () => createQrOrderHandler(asDb(fake), req({ tableId: 't1', items: [] })),
        'invalid-argument',
    );
});

test('createQrOrder: increments the order counter across orders', async () => {
    const fake = seedMenuAndTable();
    const r1 = await createQrOrderHandler(asDb(fake), req({ tableId: 't1', items: [{ menuItemId: 'm1', quantity: 1 }] }));
    const r2 = await createQrOrderHandler(asDb(fake), req({ tableId: 't1', items: [{ menuItemId: 'm2', quantity: 1 }] }));
    assert.equal(r1.orderNumber, 'QR-00001');
    assert.equal(r2.orderNumber, 'QR-00002');
    const counter = fake._read('counters', 'qr')!;
    assert.equal(counter.value, 2);
    assert.equal(counter.prefix, 'QR');
});
