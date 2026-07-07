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
    assert.deepEqual(res, { released: true, orderId: 'paid1' });

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
