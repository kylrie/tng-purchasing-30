/**
 * Integration tests — createXenditSession handler (Phase 3 · session creation).
 * Runs under `tsx --test` with the in-memory FakeFirestore + a STUBBED
 * xenditClient (no emulator, no real HTTP, no live Xendit).
 *
 * Covers QR_XENDIT_IMPLEMENTATION_PLAN §7:
 *  - creates a session for an AWAITING_PAYMENT order; stores the session fields;
 *    calls the client with the SERVER amount + PHP currency;
 *  - rejects paid/served/cancelled (failed-precondition), unknown (not-found),
 *    blank orderId (invalid-argument);
 *  - rate-limited per table (resource-exhausted);
 *  - reuse: a live session returns the same link, client called once;
 *  - retry after EXPIRED: paymentAttempt increments, new reference_id;
 *  - QR_PAYMENTS_ENABLED=false → failed-precondition, no client call;
 *  - client error → unavailable/internal, order not left half-written.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createXenditSessionHandler, SessionConfig } from '../createXenditSession.handler';
import { SESSION_CREATE_LIMIT } from '../rateLimit';
import { XenditClient, XenditClientError, XenditCreateSessionParams, XenditSession } from '../xenditClient';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

const NOW = 1_000_000;
const BASE_CONFIG: SessionConfig = { paymentsEnabled: true, publicBaseUrl: 'https://tng.example', now: () => NOW };

/** A recording stub client. `calls` captures every createSession param. */
function stubClient(overrides?: Partial<XenditSession>): XenditClient & { calls: XenditCreateSessionParams[] } {
    const calls: XenditCreateSessionParams[] = [];
    return {
        calls,
        async createSession(params: XenditCreateSessionParams): Promise<XenditSession> {
            calls.push(params);
            return {
                paymentSessionId: 'ps-new',
                paymentRequestId: 'pr-new',
                paymentLinkUrl: 'https://checkout.xendit.co/web/ps-new',
                expiresAtMillis: NOW + 30 * 60_000,
                ...overrides,
            };
        },
    };
}

function seedOrder(fake: FakeFirestore, id: string, extra: Record<string, unknown> = {}): void {
    fake._seed('qr_orders', id, {
        id,
        businessUnitId: 'bu1',
        tableId: 't1',
        tableNumber: '12',
        orderNumber: 'QR-00001',
        items: [{ productName: 'Sisig', quantity: 2, unitPrice: 285, subtotal: 570, category: 'Mains' }],
        subtotal: 570,
        taxAmount: 0,
        totalAmount: 570,
        currency: 'PHP',
        status: 'AWAITING_PAYMENT',
        paymentStatus: 'UNPAID',
        ...extra,
    });
    fake._seed('qr_tables', 't1', { businessUnitId: 'bu1', tableNumber: '12', isActive: true });
}

test('createXenditSession: creates a session for an AWAITING_PAYMENT order and stores the fields', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const client = stubClient();

    const res = await createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG);

    assert.equal(res.paymentLinkUrl, 'https://checkout.xendit.co/web/ps-new');
    assert.equal(res.reference, 'o1:1');
    assert.equal(res.expiresAtMillis, NOW + 30 * 60_000);

    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.paymentStatus, 'AWAITING_PAYMENT');
    assert.equal(stored.status, 'AWAITING_PAYMENT');          // status is NOT touched
    assert.equal(stored.paymentReference, 'o1:1');
    assert.equal(stored.xenditPaymentSessionId, 'ps-new');
    assert.equal(stored.xenditPaymentRequestId, 'pr-new');
    assert.equal(stored.paymentLinkUrl, 'https://checkout.xendit.co/web/ps-new');
    assert.equal(stored.paymentAttempt, 1);
    assert.equal(stored.sessionExpiresAtMillis, NOW + 30 * 60_000);
});

test('createXenditSession: calls the client with the SERVER amount + PHP currency (never a client price)', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const client = stubClient();

    await createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG);

    assert.equal(client.calls.length, 1);
    const p = client.calls[0];
    assert.equal(p.amount, 570);
    assert.equal(p.currency, 'PHP');
    assert.equal(p.referenceId, 'o1:1');
    assert.equal(p.idempotencyKey, 'session:o1:1');
    // Success carries the safe return marker (drives OrderStatusView polling);
    // cancel stays bare. The marker is only a poll hint — never proof of payment.
    assert.equal(p.successUrl, 'https://tng.example/order-status/o1?return=xendit');
    assert.equal(p.cancelUrl, 'https://tng.example/order-status/o1');
    assert.deepEqual(p.metadata, { order_id: 'o1', table_no: '12', business_unit_id: 'bu1' });
    assert.deepEqual(p.items, [{ name: 'Sisig', quantity: 2, price: 285 }]);
});

test('createXenditSession: rejects a PAID order (failed-precondition), no client call', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1', { status: 'PAID', paymentStatus: 'PAID' });
    const client = stubClient();
    await expectReject(() => createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG), 'failed-precondition');
    assert.equal(client.calls.length, 0);
});

test('createXenditSession: rejects a SERVED / COMPLETED / CANCELLED order (failed-precondition)', async () => {
    for (const status of ['SERVED', 'COMPLETED', 'CANCELLED']) {
        const fake = new FakeFirestore();
        seedOrder(fake, 'o1', { status, paymentStatus: 'PAID' });
        await expectReject(() => createXenditSessionHandler(asDb(fake), stubClient(), req({ orderId: 'o1' }), BASE_CONFIG), 'failed-precondition');
    }
});

test('createXenditSession: rejects an unknown order (not-found)', async () => {
    const fake = new FakeFirestore();
    await expectReject(() => createXenditSessionHandler(asDb(fake), stubClient(), req({ orderId: 'nope' }), BASE_CONFIG), 'not-found');
});

test('createXenditSession: rejects a blank orderId (invalid-argument)', async () => {
    const fake = new FakeFirestore();
    await expectReject(() => createXenditSessionHandler(asDb(fake), stubClient(), req({ orderId: '   ' }), BASE_CONFIG), 'invalid-argument');
});

test('createXenditSession: rate-limits after SESSION_CREATE_LIMIT per table (resource-exhausted)', async () => {
    const fake = new FakeFirestore();
    // Distinct orders on the SAME table so payable-checks pass every call.
    for (let i = 0; i < SESSION_CREATE_LIMIT.maxRequests; i++) {
        seedOrder(fake, `o${i}`);
        await createXenditSessionHandler(asDb(fake), stubClient(), req({ orderId: `o${i}` }), BASE_CONFIG);
    }
    seedOrder(fake, 'oX');
    await expectReject(() => createXenditSessionHandler(asDb(fake), stubClient(), req({ orderId: 'oX' }), BASE_CONFIG), 'resource-exhausted');
});

test('createXenditSession: reuses a live session — second call returns the same link, client called once', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const client = stubClient();

    const first = await createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG);
    const second = await createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG);

    assert.equal(second.paymentLinkUrl, first.paymentLinkUrl);
    assert.equal(second.reference, first.reference);
    assert.equal(client.calls.length, 1);                     // NOT called a second time
    assert.equal(fake._read('qr_orders', 'o1')!.paymentAttempt, 1); // attempt not bumped on reuse
});

test('createXenditSession: does NOT reuse an expired session — mints a new one', async () => {
    const fake = new FakeFirestore();
    // Live session fields present, but expiry is in the past.
    seedOrder(fake, 'o1', {
        paymentStatus: 'AWAITING_PAYMENT',
        paymentAttempt: 1,
        paymentReference: 'o1:1',
        xenditPaymentSessionId: 'ps-old',
        paymentLinkUrl: 'https://checkout.xendit.co/web/ps-old',
        sessionExpiresAtMillis: NOW - 1,
    });
    const client = stubClient();

    const res = await createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG);

    assert.equal(client.calls.length, 1);
    assert.equal(res.reference, 'o1:2');                      // fresh attempt
    assert.equal(fake._read('qr_orders', 'o1')!.paymentAttempt, 2);
});

test('createXenditSession: retry after EXPIRED increments paymentAttempt and mints a new reference_id', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1', {
        paymentStatus: 'EXPIRED',
        paymentAttempt: 1,
        paymentReference: 'o1:1',
        xenditPaymentSessionId: 'ps-old',
        paymentLinkUrl: 'https://checkout.xendit.co/web/ps-old',
        sessionExpiresAtMillis: NOW - 1,
    });
    const client = stubClient();

    const res = await createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG);
    assert.equal(res.reference, 'o1:2');
    assert.equal(client.calls[0].referenceId, 'o1:2');
    assert.equal(fake._read('qr_orders', 'o1')!.paymentAttempt, 2);
    assert.equal(fake._read('qr_orders', 'o1')!.paymentStatus, 'AWAITING_PAYMENT');
});

test('createXenditSession: QR_PAYMENTS_ENABLED=false → failed-precondition, no client call', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const client = stubClient();
    await expectReject(
        () => createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), { ...BASE_CONFIG, paymentsEnabled: false }),
        'failed-precondition',
    );
    assert.equal(client.calls.length, 0);
});

test('createXenditSession: a transient client error → unavailable, order not left half-written', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const client: XenditClient = { async createSession() { throw new XenditClientError('down', true); } };

    await expectReject(() => createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG), 'unavailable');

    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.paymentStatus, 'UNPAID');             // no session persisted
    assert.equal(stored.xenditPaymentSessionId, undefined);
    assert.equal(stored.paymentLinkUrl, undefined);
});

test('createXenditSession: does NOT clobber an order that became PAID during the Xendit call', async () => {
    // Simulates the webhook flipping the order to PAID between attempt-reservation
    // and the session-persist write. The persist must not downgrade paymentStatus
    // back to AWAITING_PAYMENT or stamp a link onto a paid order.
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const racyClient: XenditClient = {
        async createSession(params) {
            fake._seed('qr_orders', 'o1', {
                ...fake._read('qr_orders', 'o1'),
                status: 'PAID', paymentStatus: 'PAID',
            });
            return {
                paymentSessionId: 'ps-new', paymentRequestId: 'pr-new',
                paymentLinkUrl: 'https://checkout.xendit.co/web/ps-new',
                expiresAtMillis: NOW + 30 * 60_000,
            };
        },
    };

    await expectReject(() => createXenditSessionHandler(asDb(fake), racyClient, req({ orderId: 'o1' }), BASE_CONFIG), 'failed-precondition');

    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.status, 'PAID');
    assert.equal(stored.paymentStatus, 'PAID');               // not downgraded
    assert.equal(stored.xenditPaymentSessionId, undefined);   // no session link stamped
});

test('createXenditSession: a definite client error → internal, order not left half-written', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const client: XenditClient = { async createSession() { throw new XenditClientError('bad request', false, 400); } };

    await expectReject(() => createXenditSessionHandler(asDb(fake), client, req({ orderId: 'o1' }), BASE_CONFIG), 'internal');

    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.paymentStatus, 'UNPAID');
    assert.equal(stored.xenditPaymentSessionId, undefined);
});
