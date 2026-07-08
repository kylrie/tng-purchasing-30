/**
 * Integration tests — print-control handlers (setAutoPrint, retryPrintJob).
 * In-memory FakeFirestore, no emulator. Covers RBAC, BU-scope, input validation,
 * and the retry state machine (only FAILED → PENDING; PRINTED never retried).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAutoPrintHandler, retryPrintJobHandler } from '../printControl.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('users', 'admin1', { role: 'ADMIN', businessId: 'buX' });
    fake._seed('users', 'mgr1', { role: 'MANAGER', businessId: 'b3' });
    fake._seed('users', 'mgr2', { role: 'MANAGER', businessId: 'bu2' });
    fake._seed('users', 'emp1', { role: 'EMPLOYEE', businessId: 'b3' });

    fake._seed('qr_print_jobs', 'o1:KITCHEN:INITIAL', { id: 'o1:KITCHEN:INITIAL', businessUnitId: 'b3', station: 'KITCHEN', status: 'FAILED', lastError: 'printer down', attemptCount: 3 });
    fake._seed('qr_print_jobs', 'o1:BAR:INITIAL', { id: 'o1:BAR:INITIAL', businessUnitId: 'b3', station: 'BAR', status: 'PRINTED' });
    fake._seed('qr_print_jobs', 'o2:KITCHEN:INITIAL', { id: 'o2:KITCHEN:INITIAL', businessUnitId: 'b3', station: 'KITCHEN', status: 'PENDING' });
    fake._seed('qr_print_jobs', 'other:KITCHEN:INITIAL', { id: 'other:KITCHEN:INITIAL', businessUnitId: 'bu2', station: 'KITCHEN', status: 'FAILED' });
    return fake;
}

// ── setAutoPrint ─────────────────────────────────────────────────────────────
test('setAutoPrint: a covering manager can toggle their BU and it persists', async () => {
    const fake = seed();
    const res = await setAutoPrintHandler(asDb(fake), req({ businessUnitId: 'b3', enabled: false }, 'mgr1'));
    assert.deepEqual(res, { businessUnitId: 'b3', autoPrint: false });
    const stored = fake._read('qr_print_config', 'b3')!;
    assert.equal(stored.autoPrint, false);
    assert.equal(stored.updatedBy, 'mgr1');
    assert.notEqual(stored.updatedAt, undefined);
});

test('setAutoPrint: an admin can toggle any BU (cross-BU by design)', async () => {
    const fake = seed();
    const res = await setAutoPrintHandler(asDb(fake), req({ businessUnitId: 'b3', enabled: true }, 'admin1'));
    assert.equal(res.autoPrint, true);
    assert.equal(fake._read('qr_print_config', 'b3')!.autoPrint, true);
});

test('setAutoPrint: rejects unauth, wrong role, cross-BU, and bad input', async () => {
    const fake = seed();
    await expectReject(() => setAutoPrintHandler(asDb(fake), req({ businessUnitId: 'b3', enabled: false })), 'unauthenticated');
    await expectReject(() => setAutoPrintHandler(asDb(fake), req({ businessUnitId: 'b3', enabled: false }, 'emp1')), 'permission-denied');
    await expectReject(() => setAutoPrintHandler(asDb(fake), req({ businessUnitId: 'b3', enabled: false }, 'mgr2')), 'permission-denied');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expectReject(() => setAutoPrintHandler(asDb(fake), req({ businessUnitId: '', enabled: false } as any, 'mgr1')), 'invalid-argument');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expectReject(() => setAutoPrintHandler(asDb(fake), req({ businessUnitId: 'b3' } as any, 'mgr1')), 'invalid-argument');
});

// ── retryPrintJob ────────────────────────────────────────────────────────────
test('retryPrintJob: a FAILED job is re-queued to PENDING and cleared of error', async () => {
    const fake = seed();
    const res = await retryPrintJobHandler(asDb(fake), req({ jobId: 'o1:KITCHEN:INITIAL' }, 'mgr1'));
    assert.deepEqual(res, { jobId: 'o1:KITCHEN:INITIAL', status: 'PENDING', requeued: true });
    const stored = fake._read('qr_print_jobs', 'o1:KITCHEN:INITIAL')!;
    assert.equal(stored.status, 'PENDING');
    assert.equal(stored.lastError, null);
});

test('retryPrintJob: a PRINTED job cannot be retried (no duplicate tickets)', async () => {
    const fake = seed();
    await expectReject(() => retryPrintJobHandler(asDb(fake), req({ jobId: 'o1:BAR:INITIAL' }, 'mgr1')), 'failed-precondition');
    assert.equal(fake._read('qr_print_jobs', 'o1:BAR:INITIAL')!.status, 'PRINTED'); // unchanged
});

test('retryPrintJob: a PENDING/PRINTING job is an idempotent no-op', async () => {
    const fake = seed();
    const res = await retryPrintJobHandler(asDb(fake), req({ jobId: 'o2:KITCHEN:INITIAL' }, 'mgr1'));
    assert.deepEqual(res, { jobId: 'o2:KITCHEN:INITIAL', status: 'PENDING', requeued: false });
});

test('retryPrintJob: rejects missing job, cross-BU, wrong role, and bad input', async () => {
    const fake = seed();
    await expectReject(() => retryPrintJobHandler(asDb(fake), req({ jobId: 'nope' }, 'mgr1')), 'not-found');
    await expectReject(() => retryPrintJobHandler(asDb(fake), req({ jobId: 'other:KITCHEN:INITIAL' }, 'mgr1')), 'permission-denied');
    await expectReject(() => retryPrintJobHandler(asDb(fake), req({ jobId: 'o1:KITCHEN:INITIAL' }, 'emp1')), 'permission-denied');
    await expectReject(() => retryPrintJobHandler(asDb(fake), req({ jobId: '' }, 'mgr1')), 'invalid-argument');
});
