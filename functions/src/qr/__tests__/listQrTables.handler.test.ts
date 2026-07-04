/**
 * Integration tests — listQrTables handler (Sprint 1/2).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: RBAC (admin only), BU-scoped projection with businessUnitId + created
 * date, and the hard rule that qrToken is NEVER returned in the list (M3 / req 9).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listQrTablesHandler } from '../listQrTables.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('users', 'admin1', { role: 'ADMIN', businessId: 'bu1' });
    fake._seed('users', 'emp1', { role: 'EMPLOYEE', businessId: 'bu1' });
    fake._seed('qr_tables', 't1', { businessUnitId: 'bu1', tableNumber: '2', qrToken: 'SECRET-2', isActive: true, createdAt: { toMillis: () => 1_700_000_000_000 } });
    fake._seed('qr_tables', 't2', { businessUnitId: 'bu1', tableNumber: '10', qrToken: 'SECRET-10', isActive: false, createdAt: { toMillis: () => 1_700_000_100_000 } });
    fake._seed('qr_tables', 't3', { businessUnitId: 'bu2', tableNumber: '5', qrToken: 'SECRET-5', isActive: true });
    return fake;
}

test('listQrTables: returns BU-scoped tables with number/status/BU/created date — never the token', async () => {
    const fake = seed();
    const res = await listQrTablesHandler(asDb(fake), req({ businessUnitId: 'bu1' }, 'admin1'));

    assert.equal(res.tables.length, 2); // only bu1
    // Numeric-aware order: "2" before "10".
    assert.deepEqual(res.tables.map(t => t.tableNumber), ['2', '10']);

    const t = res.tables[0] as unknown as Record<string, unknown>;
    assert.deepEqual(Object.keys(t).sort(), ['businessUnitId', 'createdAtMillis', 'id', 'isActive', 'tableNumber'].sort());
    assert.equal('qrToken' in t, false, 'qrToken must never appear in the list');
    assert.equal(t.businessUnitId, 'bu1');
    assert.equal(t.createdAtMillis, 1_700_000_000_000);
    assert.equal(t.isActive, true);
});

test('listQrTables: rejects a non-admin caller', async () => {
    const fake = seed();
    await expectReject(() => listQrTablesHandler(asDb(fake), req({ businessUnitId: 'bu1' }, 'emp1')), 'permission-denied');
});

test('listQrTables: rejects an unauthenticated caller', async () => {
    const fake = seed();
    await expectReject(() => listQrTablesHandler(asDb(fake), req({ businessUnitId: 'bu1' })), 'unauthenticated');
});

test('listQrTables: rejects a missing businessUnitId', async () => {
    const fake = seed();
    await expectReject(() => listQrTablesHandler(asDb(fake), req({}, 'admin1')), 'invalid-argument');
});
