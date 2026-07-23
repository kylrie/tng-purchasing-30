/**
 * Integration tests — deleteQrTable handler (hard delete · admin).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: RBAC, safe delete, active-order block, active-reservation block,
 * terminal/unpaid orders do NOT block, and PAID order history is preserved.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQrTableHandler } from '../createQrTable.handler';
import { deleteQrTableHandler } from '../deleteQrTable.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seedUsersAndBUs(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('users', 'super', { role: 'SUPER_ADMIN' });
    fake._seed('users', 'admin', { role: 'ADMIN' });
    fake._seed('users', 'emp', { role: 'EMPLOYEE' });
    fake._seed('users', 'pending', { role: 'PENDING' });
    fake._seed('businesses', 'b1', { name: 'The Fun Roof' });
    return fake;
}

async function newTable(fake: FakeFirestore, businessUnitId: string, tableNumber: string) {
    return createQrTableHandler(asDb(fake), req({ businessUnitId, tableNumber }, 'super'));
}

// ── safe delete ──────────────────────────────────────────────────────────
test('deleteQrTable: SUPER_ADMIN deletes an empty table (record removed)', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    const res = await deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'super'));
    assert.deepEqual(res, { tableId: t.tableId, deleted: true });
    assert.equal(fake._read('qr_tables', t.tableId), undefined, 'table doc is gone');
});

test('deleteQrTable: ADMIN can delete an empty table', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'admin'));
    assert.equal(fake._read('qr_tables', t.tableId), undefined);
});

// ── active order blocks delete ───────────────────────────────────────────
for (const status of ['PAID', 'IN_KITCHEN', 'IN_BAR', 'READY', 'SERVED']) {
    test(`deleteQrTable: BLOCKED when an active order (status=${status}) is on the table`, async () => {
        const fake = seedUsersAndBUs();
        const t = await newTable(fake, 'b1', '14');
        fake._seed('qr_orders', 'o1', { id: 'o1', businessUnitId: 'b1', tableId: t.tableId, status, paymentStatus: 'PAID' });
        await expectReject(
            () => deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'super')),
            'failed-precondition',
        );
        assert.notEqual(fake._read('qr_tables', t.tableId), undefined, 'table NOT deleted while an order is active');
    });
}

// ── terminal / unpaid orders do NOT block delete, and are preserved ───────
test('deleteQrTable: a COMPLETED paid order does NOT block delete, and its history is preserved', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    fake._seed('qr_orders', 'paid1', { id: 'paid1', businessUnitId: 'b1', tableId: t.tableId, tableNumber: '14', status: 'COMPLETED', paymentStatus: 'PAID', totalAmount: 900 });
    await deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'super'));
    assert.equal(fake._read('qr_tables', t.tableId), undefined, 'table removed');
    // The paid order document is untouched — history survives the table delete.
    const order = fake._read('qr_orders', 'paid1');
    assert.equal(order?.paymentStatus, 'PAID');
    assert.equal(order?.tableNumber, '14', 'denormalized tableNumber preserved for history display');
});

test('deleteQrTable: an unpaid AWAITING_PAYMENT order does NOT block delete', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    fake._seed('qr_orders', 'u1', { id: 'u1', businessUnitId: 'b1', tableId: t.tableId, status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID' });
    await deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'super'));
    assert.equal(fake._read('qr_tables', t.tableId), undefined);
});

// ── active reservation blocks delete ─────────────────────────────────────
test('deleteQrTable: BLOCKED when an active (BOOKED, not-expired) reservation exists', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    fake._seed('qr_reservations', 'r1', { id: 'r1', businessUnitId: 'b1', tableId: t.tableId, status: 'BOOKED', reservationAtMillis: Date.now() + 3600_000, holdMinutes: 120 });
    await expectReject(
        () => deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'super')),
        'failed-precondition',
    );
    assert.notEqual(fake._read('qr_tables', t.tableId), undefined);
});

test('deleteQrTable: an EXPIRED booked reservation does NOT block delete', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    fake._seed('qr_reservations', 'r1', { id: 'r1', businessUnitId: 'b1', tableId: t.tableId, status: 'BOOKED', reservationAtMillis: Date.now() - 24 * 3600_000, holdMinutes: 120 });
    await deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'super'));
    assert.equal(fake._read('qr_tables', t.tableId), undefined);
});

test('deleteQrTable: a CANCELLED reservation does NOT block delete', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    fake._seed('qr_reservations', 'r1', { id: 'r1', businessUnitId: 'b1', tableId: t.tableId, status: 'CANCELLED', reservationAtMillis: Date.now() + 3600_000, holdMinutes: 120 });
    await deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'super'));
    assert.equal(fake._read('qr_tables', t.tableId), undefined);
});

// ── RBAC ─────────────────────────────────────────────────────────────────
test('deleteQrTable: employee CANNOT delete a table', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'emp')),
        'permission-denied',
    );
    assert.notEqual(fake._read('qr_tables', t.tableId), undefined);
});

test('deleteQrTable: pending user CANNOT delete a table', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'pending')),
        'permission-denied',
    );
});

test('deleteQrTable: unauthenticated caller is rejected', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId })),
        'unauthenticated',
    );
});

test('deleteQrTable: signed-in user with no user doc is rejected (fails closed)', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => deleteQrTableHandler(asDb(fake), req({ tableId: t.tableId }, 'ghost')),
        'not-found',
    );
});

// ── validation ───────────────────────────────────────────────────────────
test('deleteQrTable: unknown tableId → not-found', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => deleteQrTableHandler(asDb(fake), req({ tableId: 'nope' }, 'super')),
        'not-found',
    );
});

test('deleteQrTable: missing tableId → invalid-argument', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => deleteQrTableHandler(asDb(fake), req({}, 'super')),
        'invalid-argument',
    );
});
