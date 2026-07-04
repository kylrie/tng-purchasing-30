/**
 * Integration tests — getQrTableToken handler (Sprint 2 · admin table-management).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: RBAC (admin only / unauthenticated / non-admin), single-table token
 * reveal, not-found, and input validation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getQrTableTokenHandler } from '../getQrTableToken.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('users', 'admin1', { role: 'ADMIN', businessId: 'bu1' });
    fake._seed('users', 'emp1', { role: 'EMPLOYEE', businessId: 'bu1' });
    fake._seed('qr_tables', 't1', { businessUnitId: 'bu1', tableNumber: '12', qrToken: 'TOK-ABC123', isActive: true });
    return fake;
}

test('getQrTableToken: an admin gets a single table token on request', async () => {
    const fake = seed();
    const res = await getQrTableTokenHandler(asDb(fake), req({ tableId: 't1' }, 'admin1'));
    assert.equal(res.tableId, 't1');
    assert.equal(res.tableNumber, '12');
    assert.equal(res.qrToken, 'TOK-ABC123');
});

test('getQrTableToken: rejects a non-admin caller', async () => {
    const fake = seed();
    await expectReject(() => getQrTableTokenHandler(asDb(fake), req({ tableId: 't1' }, 'emp1')), 'permission-denied');
});

test('getQrTableToken: rejects an unauthenticated caller', async () => {
    const fake = seed();
    await expectReject(() => getQrTableTokenHandler(asDb(fake), req({ tableId: 't1' })), 'unauthenticated');
});

test('getQrTableToken: rejects an unknown table', async () => {
    const fake = seed();
    await expectReject(() => getQrTableTokenHandler(asDb(fake), req({ tableId: 'nope' }, 'admin1')), 'not-found');
});

test('getQrTableToken: rejects a missing tableId', async () => {
    const fake = seed();
    await expectReject(() => getQrTableTokenHandler(asDb(fake), req({}, 'admin1')), 'invalid-argument');
});
