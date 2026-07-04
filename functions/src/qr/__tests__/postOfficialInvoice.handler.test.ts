/**
 * Integration tests — postOfficialInvoice handler (Sprint 2 · Phase 3.5).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers: RBAC (unauth / disallowed role), BU-scope (cross-BU rejected, admin
 * cross-BU allowed), paid-only precondition, not-found, input validation, and
 * the audit stamp (officialInvoiceNumber + postedBy + postedAt).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postOfficialInvoiceHandler } from '../postOfficialInvoice.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    // Users
    fake._seed('users', 'admin1', { role: 'ADMIN', businessId: 'buX' });
    fake._seed('users', 'mgr1', { role: 'MANAGER', businessId: 'bu1' });
    fake._seed('users', 'mgr2', { role: 'MANAGER', businessId: 'bu2' });
    fake._seed('users', 'emp1', { role: 'EMPLOYEE', businessId: 'bu1' });
    // A paid order in bu1
    fake._seed('qr_orders', 'o1', {
        id: 'o1', businessUnitId: 'bu1', tableId: 't1', tableNumber: '12', orderNumber: 'QR-00001',
        items: [], subtotal: 665, taxAmount: 0, totalAmount: 665, currency: 'PHP',
        status: 'PAID', paymentStatus: 'PAID',
    });
    // An unpaid order in bu1
    fake._seed('qr_orders', 'o-unpaid', {
        id: 'o-unpaid', businessUnitId: 'bu1', tableId: 't1', tableNumber: '12', orderNumber: 'QR-00002',
        items: [], subtotal: 100, taxAmount: 0, totalAmount: 100, currency: 'PHP',
        status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID',
    });
    return fake;
}

test('postOfficialInvoice: an authorized same-BU staffer posts + audit-stamps the order', async () => {
    const fake = seed();
    const res = await postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'o1', officialInvoiceNumber: '  SI-100484  ' }, 'mgr1'));
    assert.equal(res.orderId, 'o1');
    assert.equal(res.officialInvoiceNumber, 'SI-100484'); // trimmed
    assert.equal(res.officialInvoicePostedBy, 'mgr1');

    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.officialInvoiceNumber, 'SI-100484');
    assert.equal(stored.officialInvoicePostedBy, 'mgr1');
    assert.notEqual(stored.officialInvoicePostedAt, undefined); // server-timestamp sentinel written
});

test('postOfficialInvoice: rejects an unauthenticated caller', async () => {
    const fake = seed();
    await expectReject(() => postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'o1', officialInvoiceNumber: 'SI-1' })), 'unauthenticated');
});

test('postOfficialInvoice: rejects a staffer without a reconciliation role', async () => {
    const fake = seed();
    await expectReject(() => postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'o1', officialInvoiceNumber: 'SI-1' }, 'emp1')), 'permission-denied');
});

test('postOfficialInvoice: rejects a same-role staffer from another business unit', async () => {
    const fake = seed();
    await expectReject(() => postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'o1', officialInvoiceNumber: 'SI-1' }, 'mgr2')), 'permission-denied');
});

test('postOfficialInvoice: an ADMIN may reconcile across business units', async () => {
    const fake = seed();
    const res = await postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'o1', officialInvoiceNumber: 'SI-ADMIN' }, 'admin1'));
    assert.equal(res.officialInvoiceNumber, 'SI-ADMIN');
    assert.equal(res.officialInvoicePostedBy, 'admin1');
});

test('postOfficialInvoice: rejects an unpaid order (nothing to reconcile)', async () => {
    const fake = seed();
    await expectReject(() => postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'o-unpaid', officialInvoiceNumber: 'SI-1' }, 'mgr1')), 'failed-precondition');
});

test('postOfficialInvoice: rejects an unknown order', async () => {
    const fake = seed();
    await expectReject(() => postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'nope', officialInvoiceNumber: 'SI-1' }, 'mgr1')), 'not-found');
});

test('postOfficialInvoice: rejects a blank invoice number', async () => {
    const fake = seed();
    await expectReject(() => postOfficialInvoiceHandler(asDb(fake), req({ orderId: 'o1', officialInvoiceNumber: '   ' }, 'mgr1')), 'invalid-argument');
});
