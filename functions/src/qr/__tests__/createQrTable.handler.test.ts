/**
 * Integration tests — createQrTable + listQrTables handlers (Sprint 1).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: item 1 (RBAC), item 2 (BU validation), item 3-callable (listQrTables
 * omits qrToken).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQrTableHandler } from '../createQrTable.handler';
import { listQrTablesHandler } from '../listQrTables.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seedUsersAndBUs(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('users', 'super', { role: 'SUPER_ADMIN' });
    fake._seed('users', 'admin', { role: 'ADMIN' });
    fake._seed('users', 'emp', { role: 'EMPLOYEE' });
    fake._seed('users', 'pending', { role: 'PENDING' });
    fake._seed('businesses', 'bu1', { name: 'Main' });
    fake._seed('businesses', 'bu2', { name: 'Annex' });
    return fake;
}

// ── item 1: RBAC ─────────────────────────────────────────────────────────
test('createQrTable: SUPER_ADMIN can create a table', async () => {
    const fake = seedUsersAndBUs();
    const res = await createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '12' }, 'super'));
    assert.equal(res.tableNumber, '12');
    assert.equal(typeof res.qrToken, 'string');
    assert.ok(res.qrToken.length >= 16);
    // The stored doc actually exists and carries the token.
    const stored = fake._read('qr_tables', res.tableId);
    assert.equal(stored?.businessUnitId, 'bu1');
    assert.equal(stored?.qrToken, res.qrToken);
    assert.equal(stored?.isActive, true);
});

test('createQrTable: ADMIN can create a table', async () => {
    const fake = seedUsersAndBUs();
    const res = await createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '3' }, 'admin'));
    assert.equal(res.tableNumber, '3');
});

test('createQrTable: normal employee CANNOT create a table', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '4' }, 'emp')),
        'permission-denied',
    );
});

test('createQrTable: PENDING/unapproved user CANNOT create a table', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '4' }, 'pending')),
        'permission-denied',
    );
});

test('createQrTable: unauthenticated caller CANNOT create a table', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '4' })),
        'unauthenticated',
    );
});

test('createQrTable: a signed-in user with no user doc is rejected (fails closed)', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '4' }, 'ghost')),
        'not-found',
    );
});

// ── item 2: BU validation ────────────────────────────────────────────────
test('createQrTable: rejects a nonexistent businessUnitId', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => createQrTableHandler(asDb(fake), req({ businessUnitId: 'ghost-bu', tableNumber: '12' }, 'super')),
        'not-found',
    );
});

test('createQrTable: rejects a duplicate active table number in the same BU', async () => {
    const fake = seedUsersAndBUs();
    await createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '12' }, 'super'));
    await expectReject(
        () => createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '12' }, 'super')),
        'already-exists',
    );
});

test('createQrTable: allows the same table number in a DIFFERENT valid BU', async () => {
    const fake = seedUsersAndBUs();
    await createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '12' }, 'super'));
    const res = await createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu2', tableNumber: '12' }, 'super'));
    assert.equal(res.tableNumber, '12');
    // Two distinct tables now exist, each with its own token.
    const all = fake._all('qr_tables');
    assert.equal(all.length, 2);
    assert.notEqual(all[0].data.qrToken, all[1].data.qrToken);
});

// ── item 3 (callable half): listQrTables omits qrToken ───────────────────
test('listQrTables: returns table metadata but NEVER the qrToken', async () => {
    const fake = seedUsersAndBUs();
    await createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '1' }, 'super'));
    await createQrTableHandler(asDb(fake), req({ businessUnitId: 'bu1', tableNumber: '2' }, 'super'));

    const res = await listQrTablesHandler(asDb(fake), req({ businessUnitId: 'bu1' }, 'admin'));
    assert.equal(res.tables.length, 2);
    for (const t of res.tables) {
        const keys = Object.keys(t).sort();
        assert.deepEqual(keys, ['id', 'isActive', 'tableNumber']);
        assert.equal('qrToken' in t, false, 'qrToken must not be present');
    }
});

test('listQrTables: employee cannot list tables', async () => {
    const fake = seedUsersAndBUs();
    await expectReject(
        () => listQrTablesHandler(asDb(fake), req({ businessUnitId: 'bu1' }, 'emp')),
        'permission-denied',
    );
});
