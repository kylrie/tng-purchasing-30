/**
 * Integration tests — updateQrOrderStatus handler (QR Operations · kitchen transitions).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: RBAC (unauth / disallowed role), BU-scope (cross-BU rejected, admin
 * cross-BU allowed), the full legal chain PAID→IN_KITCHEN→READY→SERVED→COMPLETED,
 * the PAYMENT GATE (AWAITING_PAYMENT can never enter the kitchen here), illegal
 * transitions (backwards / skip a stage / set a non-writable target), idempotent
 * no-op, not-found, input validation, and the append-only statusHistory audit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateQrOrderStatusHandler, NEXT_STATUS } from '../updateQrOrderStatus.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('users', 'admin1', { role: 'ADMIN', businessId: 'buX' });
    fake._seed('users', 'mgr1', { role: 'MANAGER', businessId: 'bu1' });
    fake._seed('users', 'mgr2', { role: 'MANAGER', businessId: 'bu2' });
    fake._seed('users', 'emp1', { role: 'EMPLOYEE', businessId: 'bu1' });

    const base = {
        businessUnitId: 'bu1', tableId: 't1', tableNumber: '1', orderNumber: 'QR-00001',
        items: [], subtotal: 1300, taxAmount: 0, totalAmount: 1300, currency: 'PHP',
    };
    fake._seed('qr_orders', 'paid', { ...base, id: 'paid', status: 'PAID', paymentStatus: 'PAID' });
    fake._seed('qr_orders', 'kitchen', { ...base, id: 'kitchen', status: 'IN_KITCHEN', paymentStatus: 'PAID' });
    fake._seed('qr_orders', 'ready', { ...base, id: 'ready', status: 'READY', paymentStatus: 'PAID' });
    fake._seed('qr_orders', 'served', { ...base, id: 'served', status: 'SERVED', paymentStatus: 'PAID' });
    fake._seed('qr_orders', 'awaiting', { ...base, id: 'awaiting', status: 'AWAITING_PAYMENT', paymentStatus: 'AWAITING_PAYMENT' });
    return fake;
}

test('updateQrOrderStatus: PAID → IN_KITCHEN applies, writes status + audit history', async () => {
    const fake = seed();
    const res = await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'IN_KITCHEN' }, 'mgr1'));
    assert.equal(res.status, 'IN_KITCHEN');
    assert.equal(res.changed, true);

    const stored = fake._read('qr_orders', 'paid')!;
    assert.equal(stored.status, 'IN_KITCHEN');
    assert.notEqual(stored.updatedAt, undefined);
    assert.equal(Array.isArray(stored.statusHistory), true);
    const hist = stored.statusHistory as { status: string; by: string; role: string; at: string }[];
    assert.equal(hist.length, 1);
    assert.equal(hist[0].status, 'IN_KITCHEN');
    assert.equal(hist[0].by, 'mgr1');
    assert.equal(hist[0].role, 'MANAGER');
    assert.equal(typeof hist[0].at, 'string');
});

test('updateQrOrderStatus: the full legal chain advances one stage at a time', async () => {
    assert.deepEqual(NEXT_STATUS, { PAID: 'IN_KITCHEN', IN_KITCHEN: 'READY', READY: 'SERVED', SERVED: 'COMPLETED' });
    const fake = seed();
    await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'kitchen', toStatus: 'READY' }, 'mgr1'));
    assert.equal(fake._read('qr_orders', 'kitchen')!.status, 'READY');
    await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'ready', toStatus: 'SERVED' }, 'mgr1'));
    assert.equal(fake._read('qr_orders', 'ready')!.status, 'SERVED');
    await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'served', toStatus: 'COMPLETED' }, 'mgr1'));
    assert.equal(fake._read('qr_orders', 'served')!.status, 'COMPLETED');
});

test('updateQrOrderStatus: statusHistory appends (does not overwrite) across transitions', async () => {
    const fake = seed();
    await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'IN_KITCHEN' }, 'mgr1'));
    await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'READY' }, 'mgr1'));
    const hist = fake._read('qr_orders', 'paid')!.statusHistory as { status: string }[];
    assert.equal(hist.length, 2);
    assert.deepEqual(hist.map(h => h.status), ['IN_KITCHEN', 'READY']);
});

test('updateQrOrderStatus: PAYMENT GATE — AWAITING_PAYMENT can never enter the kitchen', async () => {
    const fake = seed();
    await expectReject(
        () => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'awaiting', toStatus: 'IN_KITCHEN' }, 'mgr1')),
        'failed-precondition',
    );
    // Order untouched.
    assert.equal(fake._read('qr_orders', 'awaiting')!.status, 'AWAITING_PAYMENT');
});

test('updateQrOrderStatus: rejects a backward transition (READY → IN_KITCHEN)', async () => {
    const fake = seed();
    await expectReject(
        () => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'ready', toStatus: 'IN_KITCHEN' }, 'mgr1')),
        'failed-precondition',
    );
});

test('updateQrOrderStatus: rejects skipping a stage (PAID → READY)', async () => {
    const fake = seed();
    await expectReject(
        () => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'READY' }, 'mgr1')),
        'failed-precondition',
    );
});

test('updateQrOrderStatus: rejects a non-writable target (cannot set PAID / CANCELLED here)', async () => {
    const fake = seed();
    await expectReject(
        () => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'kitchen', toStatus: 'PAID' }, 'mgr1')),
        'failed-precondition',
    );
    await expectReject(
        () => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'kitchen', toStatus: 'CANCELLED' }, 'mgr1')),
        'failed-precondition',
    );
});

test('updateQrOrderStatus: idempotent no-op when already at the requested status', async () => {
    const fake = seed();
    const res = await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'kitchen', toStatus: 'IN_KITCHEN' }, 'mgr1'));
    assert.equal(res.status, 'IN_KITCHEN');
    assert.equal(res.changed, false);
    // No history appended for a no-op.
    assert.equal(fake._read('qr_orders', 'kitchen')!.statusHistory, undefined);
});

test('updateQrOrderStatus: rejects an unauthenticated caller', async () => {
    const fake = seed();
    await expectReject(() => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'IN_KITCHEN' })), 'unauthenticated');
});

test('updateQrOrderStatus: rejects a staffer without an ops role', async () => {
    const fake = seed();
    await expectReject(() => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'IN_KITCHEN' }, 'emp1')), 'permission-denied');
});

test('updateQrOrderStatus: rejects a same-role staffer from another business unit', async () => {
    const fake = seed();
    await expectReject(() => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'IN_KITCHEN' }, 'mgr2')), 'permission-denied');
});

test('updateQrOrderStatus: an ADMIN may transition across business units', async () => {
    const fake = seed();
    const res = await updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: 'IN_KITCHEN' }, 'admin1'));
    assert.equal(res.status, 'IN_KITCHEN');
    assert.equal(res.changed, true);
});

test('updateQrOrderStatus: rejects an unknown order', async () => {
    const fake = seed();
    await expectReject(() => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'nope', toStatus: 'IN_KITCHEN' }, 'mgr1')), 'not-found');
});

test('updateQrOrderStatus: rejects blank orderId / toStatus', async () => {
    const fake = seed();
    await expectReject(() => updateQrOrderStatusHandler(asDb(fake), req({ orderId: '  ', toStatus: 'IN_KITCHEN' }, 'mgr1')), 'invalid-argument');
    await expectReject(() => updateQrOrderStatusHandler(asDb(fake), req({ orderId: 'paid', toStatus: '' }, 'mgr1')), 'invalid-argument');
});
