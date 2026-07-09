/**
 * Integration tests — createQrReservation handler (Ops → Tables quick reservation).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator).
 *
 * Covers: valid booking scoped to the AUTHORITATIVE table BU (never the client);
 * conflict rejection; cross-business isolation (bu derived from table record);
 * PH phone validation; past-time rejection; missing table; RBAC.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { createQrReservationHandler } from '../createQrReservation.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

const NOW = 1_800_000_000_000; // fixed clock
const OPTS = { now: () => NOW };
const FUTURE = NOW + 60 * 60_000; // 1h ahead

function seedUser(fake: FakeFirestore, uid: string, role: string): void {
    fake._seed('users', uid, { role, businessId: 'b1' });
}
function seedTable(fake: FakeFirestore, id: string, extra: Record<string, unknown> = {}): void {
    fake._seed('qr_tables', id, { id, businessUnitId: 'b1', tableNumber: '1', isActive: true, ...extra });
}
function seedReservation(fake: FakeFirestore, id: string, tableId: string, atMillis: number, holdMinutes = 120): void {
    fake._seed('qr_reservations', id, { id, tableId, reservationAt: Timestamp.fromMillis(atMillis), holdMinutes, status: 'BOOKED' });
}

const input = (over: Record<string, unknown> = {}) => ({
    tableId: 't1', reservationAtMillis: FUTURE, customerName: 'Maria Santos', customerPhone: '0917 123 4567', ...over,
});

test('createQrReservation: books, scoping BU + tableNumber from the table record (not the client)', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'mgr', 'MANAGER');
    seedTable(fake, 't1', { businessUnitId: 'b1', tableNumber: '3' });
    // The client input carries NO businessUnitId — it must come from the table.
    const res = await createQrReservationHandler(asDb(fake), req(input({ tableId: 't1' }), 'mgr'), OPTS);
    assert.equal(res.businessUnitId, 'b1');
    assert.equal(res.tableNumber, '3');
    assert.equal(res.tableId, 't1');

    const stored = fake._all('qr_reservations')[0].data;
    assert.equal(stored.businessUnitId, 'b1');
    assert.equal(stored.tableId, 't1');
    assert.equal(stored.tableNumber, '3');
    assert.equal(stored.customerName, 'Maria Santos');
    assert.equal(stored.customerPhone, '09171234567');   // normalized
    assert.equal(stored.status, 'BOOKED');
    assert.equal(stored.holdMinutes, 120);
});

test('createQrReservation: an ADMIN (cross-BU) books a b3 table under b3 (bu from table, no leakage)', async () => {
    const fake = new FakeFirestore();
    fake._seed('users', 'admin', { role: 'ADMIN' }); // cross-BU by design, no businessId
    seedTable(fake, 't-b3', { businessUnitId: 'b3', tableNumber: '7' });
    const res = await createQrReservationHandler(asDb(fake), req(input({ tableId: 't-b3' }), 'admin'), OPTS);
    assert.equal(res.businessUnitId, 'b3');
    assert.equal(fake._all('qr_reservations')[0].data.businessUnitId, 'b3');
});

test('createQrReservation: a b1-scoped MANAGER cannot reserve a b3 table (BU boundary)', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'mgr', 'MANAGER'); // businessId 'b1'
    seedTable(fake, 't-b3', { businessUnitId: 'b3', tableNumber: '7' });
    await expectReject(() => createQrReservationHandler(asDb(fake), req(input({ tableId: 't-b3' }), 'mgr'), OPTS), 'permission-denied');
    assert.equal(fake._all('qr_reservations').length, 0);
});

test('createQrReservation: overlapping reservation on the same table → already-exists', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'mgr', 'MANAGER');
    seedTable(fake, 't1');
    seedReservation(fake, 'r-existing', 't1', FUTURE + 30 * 60_000); // window overlaps FUTURE..+120m
    await expectReject(() => createQrReservationHandler(asDb(fake), req(input(), 'mgr'), OPTS), 'already-exists');
    assert.equal(fake._all('qr_reservations').length, 1); // no duplicate written
});

test('createQrReservation: non-overlapping later slot on the same table is allowed', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'mgr', 'MANAGER');
    seedTable(fake, 't1');
    seedReservation(fake, 'r-existing', 't1', FUTURE); // 1h..3h
    // 4h ahead — clear of the existing 2h hold window
    await createQrReservationHandler(asDb(fake), req(input({ reservationAtMillis: NOW + 4 * 60 * 60_000 }), 'mgr'), OPTS);
    assert.equal(fake._all('qr_reservations').length, 2);
});

test('createQrReservation: invalid PH phone → invalid-argument', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'mgr', 'MANAGER');
    seedTable(fake, 't1');
    await expectReject(() => createQrReservationHandler(asDb(fake), req(input({ customerPhone: '12345' }), 'mgr'), OPTS), 'invalid-argument');
});

test('createQrReservation: past reservation time → invalid-argument', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'mgr', 'MANAGER');
    seedTable(fake, 't1');
    await expectReject(() => createQrReservationHandler(asDb(fake), req(input({ reservationAtMillis: NOW - 10 * 60_000 }), 'mgr'), OPTS), 'invalid-argument');
});

test('createQrReservation: missing / inactive table → not-found / failed-precondition', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'mgr', 'MANAGER');
    await expectReject(() => createQrReservationHandler(asDb(fake), req(input({ tableId: 'nope' }), 'mgr'), OPTS), 'not-found');
    seedTable(fake, 't-inactive', { isActive: false });
    await expectReject(() => createQrReservationHandler(asDb(fake), req(input({ tableId: 't-inactive' }), 'mgr'), OPTS), 'failed-precondition');
});

test('createQrReservation: non-ops role → permission-denied', async () => {
    const fake = new FakeFirestore();
    seedUser(fake, 'clerk', 'STAFF');
    seedTable(fake, 't1');
    await expectReject(() => createQrReservationHandler(asDb(fake), req(input(), 'clerk'), OPTS), 'permission-denied');
});
