/**
 * Integration tests — releaseQrOrder service (Sprint 2 · release infrastructure).
 * Uses the in-memory FakeFirestore (no emulator/Java). Verifies PAID-gating,
 * audit stamping, and idempotency (exactly-once release).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseQrOrder } from '../releaseOrder';
import { FakeFirestore } from './fakeFirestore';
import { asDb } from './testUtils';

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('qr_orders', 'paid1', { id: 'paid1', businessUnitId: 'bu1', status: 'PAID', paymentStatus: 'PAID' });
    fake._seed('qr_orders', 'unpaid1', { id: 'unpaid1', businessUnitId: 'bu1', status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID' });
    return fake;
}

test('releaseQrOrder: releases a PAID order and stamps release metadata + audit', async () => {
    const fake = seed();
    const res = await releaseQrOrder(asDb(fake), 'paid1', { source: 'XENDIT_WEBHOOK', releaseEventId: 'py-abc', releasedBy: 'system' });
    assert.deepEqual(res, { released: true, orderId: 'paid1', jobIds: [] }); // paid1 has no items → no jobs

    const stored = fake._read('qr_orders', 'paid1')!;
    assert.equal(stored.released, true);
    assert.equal(stored.releaseSource, 'XENDIT_WEBHOOK');
    assert.equal(stored.releaseEventId, 'py-abc');
    assert.equal(stored.releasedBy, 'system');
    assert.notEqual(stored.releasedAt, undefined); // server-timestamp sentinel written
});

test('releaseQrOrder: refuses to release an UNPAID order (no write)', async () => {
    const fake = seed();
    const res = await releaseQrOrder(asDb(fake), 'unpaid1', { source: 'XENDIT_WEBHOOK' });
    assert.deepEqual(res, { released: false, orderId: 'unpaid1', reason: 'NOT_PAID' });
    assert.equal(fake._read('qr_orders', 'unpaid1')!.released, undefined);
});

test('releaseQrOrder: a missing order is ORDER_NOT_FOUND', async () => {
    const fake = seed();
    const res = await releaseQrOrder(asDb(fake), 'nope', { source: 'SYSTEM' });
    assert.deepEqual(res, { released: false, orderId: 'nope', reason: 'ORDER_NOT_FOUND' });
});

test('releaseQrOrder: is idempotent — a second release is a no-op (exactly once)', async () => {
    const fake = seed();
    const first = await releaseQrOrder(asDb(fake), 'paid1', { source: 'XENDIT_WEBHOOK', releaseEventId: 'py-1' });
    assert.equal(first.released, true);

    const second = await releaseQrOrder(asDb(fake), 'paid1', { source: 'XENDIT_WEBHOOK', releaseEventId: 'py-1-retry' });
    assert.deepEqual(second, { released: false, orderId: 'paid1', reason: 'ALREADY_RELEASED' });

    // The audit stamp from the FIRST release is preserved (not overwritten).
    assert.equal(fake._read('qr_orders', 'paid1')!.releaseEventId, 'py-1');
});

// ── Automatic print-job creation on release ──────────────────────────────────
// Release now also creates the INITIAL station print jobs (qr_print_jobs) in the
// SAME transaction, so exactly-once release ⇒ exactly-once jobs. Uses REAL coarse
// backend categories ("Beverages"/"Mains") to prove the station split is correct
// on production data (not just the fine demo subcategories).

function seedMixed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('qr_orders', 'mix1', {
        id: 'mix1', businessUnitId: 'b3', status: 'PAID', paymentStatus: 'PAID',
        orderNumber: 'QR-00042', tableNumber: '7',
        items: [
            { productName: 'Chicken Inasal', quantity: 2, category: 'Mains' },                 // food → KITCHEN
            { productName: 'San Miguel Pale Pilsen', quantity: 3, category: 'Beverages', notes: 'ice cold' }, // drink → BAR
            { productName: 'Mango Shake', quantity: 1, category: 'Mains' },                     // mistagged Mains, name → Fresh Juice → BAR
        ],
    });
    return fake;
}

test('release creates a KITCHEN and a BAR job for a mixed order (real coarse categories)', async () => {
    const fake = seedMixed();
    const res = await releaseQrOrder(asDb(fake), 'mix1', { source: 'XENDIT_WEBHOOK', releaseEventId: 'py-mix' });
    assert.equal(res.released, true);
    assert.deepEqual((res as { jobIds: string[] }).jobIds.sort(), ['mix1:BAR:INITIAL', 'mix1:KITCHEN:INITIAL']);

    const kitchen = fake._read('qr_print_jobs', 'mix1:KITCHEN:INITIAL')!;
    assert.equal(kitchen.station, 'KITCHEN');
    assert.equal(kitchen.status, 'PENDING');
    assert.equal(kitchen.attemptCount, 0);
    assert.equal(kitchen.paid, true);
    assert.equal(kitchen.displayOrderNumber, 'QR-00042');
    assert.equal(kitchen.tableNumber, '7');
    assert.equal(kitchen.businessUnitId, 'b3');
    assert.equal(kitchen.idempotencyKey, 'mix1:KITCHEN:INITIAL');
    assert.notEqual(kitchen.createdAt, undefined); // server-timestamp sentinel written
    // KITCHEN = food only: only Chicken Inasal.
    assert.deepEqual(kitchen.lines, [{ qty: 2, name: 'Chicken Inasal' }]);

    const bar = fake._read('qr_print_jobs', 'mix1:BAR:INITIAL')!;
    assert.equal(bar.station, 'BAR');
    // BAR = drink only: San Miguel (Beverages) + Mango Shake (name-refined to a drink).
    assert.deepEqual(bar.lines, [
        { qty: 3, name: 'San Miguel Pale Pilsen', note: 'ice cold' },
        { qty: 1, name: 'Mango Shake' },
    ]);
});

test('release creates ONLY a KITCHEN job for a food-only order', async () => {
    const fake = new FakeFirestore();
    fake._seed('qr_orders', 'food1', {
        id: 'food1', businessUnitId: 'b3', status: 'PAID', paymentStatus: 'PAID',
        orderNumber: 'QR-00050', tableNumber: '2',
        items: [{ productName: 'Sisig', quantity: 1, category: 'Appetizers' }],
    });
    const res = await releaseQrOrder(asDb(fake), 'food1', { source: 'XENDIT_WEBHOOK' });
    assert.deepEqual((res as { jobIds: string[] }).jobIds, ['food1:KITCHEN:INITIAL']);
    assert.notEqual(fake._read('qr_print_jobs', 'food1:KITCHEN:INITIAL'), undefined);
    assert.equal(fake._read('qr_print_jobs', 'food1:BAR:INITIAL'), undefined);
});

test('release creates ONLY a BAR job for a drinks-only order', async () => {
    const fake = new FakeFirestore();
    fake._seed('qr_orders', 'bar1', {
        id: 'bar1', businessUnitId: 'b3', status: 'PAID', paymentStatus: 'PAID',
        orderNumber: 'QR-00051', tableNumber: '9',
        items: [{ productName: 'Barako Coffee', quantity: 2, category: 'Beverages' }],
    });
    const res = await releaseQrOrder(asDb(fake), 'bar1', { source: 'XENDIT_WEBHOOK' });
    assert.deepEqual((res as { jobIds: string[] }).jobIds, ['bar1:BAR:INITIAL']);
    assert.equal(fake._read('qr_print_jobs', 'bar1:KITCHEN:INITIAL'), undefined);
    assert.equal(fake._read('qr_print_jobs', 'bar1:BAR:INITIAL')!.station, 'BAR');
});

test('a duplicate release creates NO second set of jobs (exactly-once)', async () => {
    const fake = seedMixed();
    await releaseQrOrder(asDb(fake), 'mix1', { source: 'XENDIT_WEBHOOK', releaseEventId: 'py-1' });
    const afterFirst = fake._all('qr_print_jobs').length;
    assert.equal(afterFirst, 2);

    // Stamp a fake "printed" state, then re-drive release (as the webhook self-heal would).
    fake._seed('qr_print_jobs', 'mix1:KITCHEN:INITIAL', {
        ...fake._read('qr_print_jobs', 'mix1:KITCHEN:INITIAL')!, status: 'PRINTED',
    });
    const second = await releaseQrOrder(asDb(fake), 'mix1', { source: 'XENDIT_WEBHOOK', releaseEventId: 'py-2' });
    assert.deepEqual(second, { released: false, orderId: 'mix1', reason: 'ALREADY_RELEASED' });

    // Still exactly 2 jobs, and the PRINTED job was NOT reset to PENDING.
    assert.equal(fake._all('qr_print_jobs').length, 2);
    assert.equal(fake._read('qr_print_jobs', 'mix1:KITCHEN:INITIAL')!.status, 'PRINTED');
});

test('an UNPAID order creates no jobs (release refused)', async () => {
    const fake = seed();
    await releaseQrOrder(asDb(fake), 'unpaid1', { source: 'XENDIT_WEBHOOK' });
    assert.equal(fake._all('qr_print_jobs').length, 0);
});
