/**
 * Integration tests — editQrTable handler (table rename · admin).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: RBAC, BU-derived-from-doc, rename success WITH qrToken preserved,
 * duplicate-active-number rejection, inactive-number reuse, no-op rename.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQrTableHandler } from '../createQrTable.handler';
import { editQrTableHandler } from '../editQrTable.handler';
import { callerCoversBU } from '../auth';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seedUsersAndBUs(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('users', 'super', { role: 'SUPER_ADMIN' });
    fake._seed('users', 'admin', { role: 'ADMIN' });
    fake._seed('users', 'emp', { role: 'EMPLOYEE' });
    fake._seed('users', 'pending', { role: 'PENDING' });
    fake._seed('businesses', 'b1', { name: 'The Fun Roof' });
    fake._seed('businesses', 'b3', { name: 'Inflatable Island' });
    return fake;
}

async function newTable(fake: FakeFirestore, businessUnitId: string, tableNumber: string) {
    return createQrTableHandler(asDb(fake), req({ businessUnitId, tableNumber }, 'super'));
}

// ── success: rename preserves the QR token (the whole point) ──────────────
test('editQrTable: renames the table but PRESERVES qrToken, id and isActive', async () => {
    const fake = seedUsersAndBUs();
    const created = await newTable(fake, 'b1', '14');
    const before = fake._read('qr_tables', created.tableId);

    const res = await editQrTableHandler(asDb(fake), req({ tableId: created.tableId, tableNumber: '15' }, 'admin'));
    assert.equal(res.tableId, created.tableId);
    assert.equal(res.tableNumber, '15');
    assert.equal(res.businessUnitId, 'b1');

    const after = fake._read('qr_tables', created.tableId);
    assert.equal(after?.tableNumber, '15', 'tableNumber updated');
    assert.equal(after?.qrToken, before?.qrToken, 'qrToken MUST be unchanged — the printed QR must keep working');
    assert.equal(after?.isActive, true, 'isActive unchanged');
    assert.equal(after?.businessUnitId, 'b1', 'businessUnitId unchanged');
    assert.equal(after?.updatedBy, 'admin', 'audit: updatedBy set');
});

test('editQrTable: trims the new table number', async () => {
    const fake = seedUsersAndBUs();
    const created = await newTable(fake, 'b1', '14');
    const res = await editQrTableHandler(asDb(fake), req({ tableId: created.tableId, tableNumber: '  20  ' }, 'super'));
    assert.equal(res.tableNumber, '20');
    assert.equal(fake._read('qr_tables', created.tableId)?.tableNumber, '20');
});

test('editQrTable: no-op rename (same number) succeeds without a duplicate error', async () => {
    const fake = seedUsersAndBUs();
    const created = await newTable(fake, 'b1', '14');
    const res = await editQrTableHandler(asDb(fake), req({ tableId: created.tableId, tableNumber: '14' }, 'super'));
    assert.equal(res.tableNumber, '14');
});

// ── BU is server-derived (b3 safety) ─────────────────────────────────────
test('editQrTable: businessUnitId is derived from the table doc, never the client', async () => {
    const fake = seedUsersAndBUs();
    const b3Table = await newTable(fake, 'b3', '5');
    // Even a cross-BU admin editing a b3 table gets b3 back — the BU is read from
    // the record, so the op can never be redirected to another business unit.
    const res = await editQrTableHandler(asDb(fake), req({ tableId: b3Table.tableId, tableNumber: '6' }, 'super'));
    assert.equal(res.businessUnitId, 'b3');
    assert.equal(fake._read('qr_tables', b3Table.tableId)?.businessUnitId, 'b3');
});

// ── duplicate handling ───────────────────────────────────────────────────
test('editQrTable: rejects renaming to a duplicate ACTIVE number in the same BU', async () => {
    const fake = seedUsersAndBUs();
    await newTable(fake, 'b1', '10');
    const t2 = await newTable(fake, 'b1', '11');
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableId: t2.tableId, tableNumber: '10' }, 'admin')),
        'already-exists',
    );
    // The clash is rejected — t2 keeps its original number.
    assert.equal(fake._read('qr_tables', t2.tableId)?.tableNumber, '11');
});

test('editQrTable: allows the same number as a table in a DIFFERENT BU', async () => {
    const fake = seedUsersAndBUs();
    await newTable(fake, 'b3', '10');       // b3 also has a table 10
    const t = await newTable(fake, 'b1', '11');
    const res = await editQrTableHandler(asDb(fake), req({ tableId: t.tableId, tableNumber: '10' }, 'admin'));
    assert.equal(res.tableNumber, '10');    // no clash across BUs
});

test('editQrTable: allows reusing a number held only by an INACTIVE table', async () => {
    const fake = seedUsersAndBUs();
    fake._seed('qr_tables', 'inactiveOld', { id: 'inactiveOld', businessUnitId: 'b1', tableNumber: '9', qrToken: 'tok-old', isActive: false });
    const t = await newTable(fake, 'b1', '11');
    const res = await editQrTableHandler(asDb(fake), req({ tableId: t.tableId, tableNumber: '9' }, 'super'));
    assert.equal(res.tableNumber, '9');     // inactive tables don't block
});

// ── RBAC ─────────────────────────────────────────────────────────────────
test('editQrTable: employee CANNOT rename a table', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableId: t.tableId, tableNumber: '15' }, 'emp')),
        'permission-denied',
    );
});

test('editQrTable: pending user CANNOT rename a table', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableId: t.tableId, tableNumber: '15' }, 'pending')),
        'permission-denied',
    );
});

test('editQrTable: unauthenticated caller is rejected', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableId: t.tableId, tableNumber: '15' })),
        'unauthenticated',
    );
});

test('editQrTable: signed-in user with no user doc is rejected (fails closed)', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableId: t.tableId, tableNumber: '15' }, 'ghost')),
        'not-found',
    );
});

// ── validation ───────────────────────────────────────────────────────────
test('editQrTable: unknown tableId → not-found', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableId: 'nope', tableNumber: '15' }, 'super')),
        'not-found',
    );
});

test('editQrTable: missing tableId or tableNumber → invalid-argument', async () => {
    const fake = seedUsersAndBUs();
    const t = await newTable(fake, 'b1', '14');
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableNumber: '15' }, 'super')),
        'invalid-argument',
    );
    await expectReject(
        () => editQrTableHandler(asDb(fake), req({ tableId: t.tableId, tableNumber: '   ' }, 'super')),
        'invalid-argument',
    );
});

// ── BU-scope guard (defense-in-depth) ────────────────────────────────────
test('callerCoversBU: a BU-scoped manager cannot cover another business unit', () => {
    // Table admin roles are cross-BU today (SUPER_ADMIN/ADMIN), so this guard is
    // defense-in-depth; it is what blocks cross-BU access if the role set tightens.
    assert.equal(callerCoversBU({ role: 'MANAGER', businessId: 'b1' }, 'b3'), false);
    assert.equal(callerCoversBU({ role: 'MANAGER', businessId: 'b1' }, 'b1'), true);
    assert.equal(callerCoversBU({ role: 'ADMIN' }, 'b3'), true);
});
