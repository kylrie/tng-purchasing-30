/**
 * Integration tests — xenditWebhook handler (Phase 3 · source-of-truth webhook).
 * Runs under `tsx --test` with the in-memory FakeFirestore + a STUBBED release
 * function (no emulator, no live Xendit, no HTTP server).
 *
 * Covers QR_XENDIT_IMPLEMENTATION_PLAN §2 / §7:
 *  - valid `succeeded` → one-way AWAITING_PAYMENT→PAID + paidAt + metadata,
 *    and the release service is called exactly once;
 *  - bad / missing token → 401, nothing processed, no ledger, no release;
 *  - duplicate delivery → single effect (ledger short-circuit), release once;
 *  - amount / currency mismatch → rejected (200), not applied, no release;
 *  - unknown order → acknowledged 200 no-op, no release;
 *  - failed / expired → paymentStatus updated, status untouched, never released;
 *  - late failed after paid → ignored (never downgrades a paid order);
 *  - non-POST → 405.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xenditWebhookHandler, WebhookRequest, WebhookConfig } from '../xenditWebhook.handler';
import type { ReleaseOrderOptions, ReleaseOrderResult } from '../releaseOrder';
import { FakeFirestore } from './fakeFirestore';
import { asDb } from './testUtils';

const TOKEN = 'super-secret-callback-token';
const NOW = 1_700_000_000_000;
const CONFIG: WebhookConfig = { callbackToken: TOKEN };

/** Records every release invocation so tests can assert call count + args. On
 *  success it stamps `released: true` on the fake order — mirroring the real
 *  releaseQrOrder side effect, so re-drive logic sees an accurate state. */
function releaseSpy(fake: FakeFirestore) {
    const calls: { orderId: string; options: ReleaseOrderOptions }[] = [];
    const fn = async (orderId: string, options: ReleaseOrderOptions): Promise<ReleaseOrderResult> => {
        calls.push({ orderId, options });
        const order = fake._read('qr_orders', orderId);
        if (order) fake._seed('qr_orders', orderId, { ...order, released: true });
        return { released: true, orderId };
    };
    return { calls, fn };
}

function seedOrder(fake: FakeFirestore, id: string, extra: Record<string, unknown> = {}): void {
    fake._seed('qr_orders', id, {
        id,
        businessUnitId: 'bu1',
        tableId: 't1',
        tableNumber: '12',
        orderNumber: 'QR-00001',
        totalAmount: 570,
        currency: 'PHP',
        status: 'AWAITING_PAYMENT',
        paymentStatus: 'AWAITING_PAYMENT',
        paymentReference: `${id}:1`,
        xenditPaymentSessionId: 'ps-1',
        ...extra,
    });
}

function paidBody(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
        event: 'payment.succeeded',
        data: {
            payment_id: 'py-1',
            reference_id: 'o1:1',
            status: 'SUCCEEDED',
            amount: 570,
            currency: 'PHP',
            channel_code: 'PH_GCASH',
            payment_method: { type: 'EWALLET' },
            ...overrides,
        },
    });
}

function post(rawBody: string, token: string | undefined = TOKEN): WebhookRequest {
    const headers: Record<string, string | undefined> = {};
    if (token !== undefined) headers['x-callback-token'] = token;
    return { method: 'POST', headers, rawBody };
}

test('xenditWebhook: a valid succeeded event flips the order to PAID and stamps metadata', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const res = await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody()), CONFIG, () => NOW);

    assert.equal(res.statusCode, 200);
    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.status, 'PAID');
    assert.equal(stored.paymentStatus, 'PAID');
    assert.notEqual(stored.paidAt, undefined);
    assert.equal(stored.xenditPaymentId, 'py-1');
    assert.equal(stored.xenditChannelCode, 'PH_GCASH');
    assert.equal(stored.paymentMethodType, 'EWALLET');
});

test('xenditWebhook: a valid succeeded event calls the release service exactly once', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody()), CONFIG, () => NOW);

    assert.equal(release.calls.length, 1);
    assert.equal(release.calls[0].orderId, 'o1');
    assert.equal(release.calls[0].options.source, 'XENDIT_WEBHOOK');
    assert.equal(release.calls[0].options.releaseEventId, 'py-1');
});

test('xenditWebhook: a valid succeeded event records the ledger with result=applied', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody()), CONFIG, () => NOW);

    const ledger = fake._read('xendit_events', 'py-1:payment.succeeded')!;
    assert.equal(ledger.result, 'applied');
    assert.equal(ledger.orderId, 'o1');
    assert.equal(ledger.xenditPaymentId, 'py-1');
});

test('xenditWebhook: a bad callback token → 401, nothing processed, no release, no ledger', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const res = await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody(), 'WRONG'), CONFIG, () => NOW);

    assert.equal(res.statusCode, 401);
    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.status, 'AWAITING_PAYMENT');   // untouched
    assert.equal(stored.paymentStatus, 'AWAITING_PAYMENT');
    assert.equal(release.calls.length, 0);
    assert.equal(fake._read('xendit_events', 'py-1:payment.succeeded'), undefined);
});

test('xenditWebhook: a missing callback token → 401', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const noTokenReq: WebhookRequest = { method: 'POST', headers: {}, rawBody: paidBody() };
    const res = await xenditWebhookHandler(asDb(fake), release.fn, noTokenReq, CONFIG, () => NOW);
    assert.equal(res.statusCode, 401);
    assert.equal(release.calls.length, 0);
});

test('xenditWebhook: a duplicate delivery applies the effect once (ledger idempotency)', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const first = await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody()), CONFIG, () => NOW);
    const second = await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody()), CONFIG, () => NOW);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);            // fast 200 on duplicate
    assert.equal(release.calls.length, 1);           // NOT released twice
    assert.equal(fake._read('qr_orders', 'o1')!.status, 'PAID');
});

test('xenditWebhook: a wrong amount is rejected (200, not applied, no release)', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const res = await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody({ amount: 1 })), CONFIG, () => NOW);

    assert.equal(res.statusCode, 200);
    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.status, 'AWAITING_PAYMENT');   // NOT flipped
    assert.equal(stored.paymentStatus, 'AWAITING_PAYMENT');
    assert.equal(release.calls.length, 0);
    assert.equal(fake._read('xendit_events', 'py-1:payment.succeeded')!.result, 'rejected');
});

test('xenditWebhook: a wrong currency is rejected (200, not applied, no release)', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const res = await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody({ currency: 'USD' })), CONFIG, () => NOW);

    assert.equal(res.statusCode, 200);
    assert.equal(fake._read('qr_orders', 'o1')!.status, 'AWAITING_PAYMENT');
    assert.equal(release.calls.length, 0);
    assert.equal(fake._read('xendit_events', 'py-1:payment.succeeded')!.result, 'rejected');
});

test('xenditWebhook: an unknown order is acknowledged (200) with no release', async () => {
    const fake = new FakeFirestore();   // no order seeded
    const release = releaseSpy(fake);

    const res = await xenditWebhookHandler(asDb(fake), release.fn, post(paidBody({ reference_id: 'ghost:1' })), CONFIG, () => NOW);

    assert.equal(res.statusCode, 200);
    assert.equal(release.calls.length, 0);
});

test('xenditWebhook: a failed event sets paymentStatus=FAILED but never releases', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const body = JSON.stringify({ event: 'payment.failed', data: { payment_id: 'py-2', reference_id: 'o1:1', status: 'FAILED', amount: 570, currency: 'PHP' } });
    const res = await xenditWebhookHandler(asDb(fake), release.fn, post(body), CONFIG, () => NOW);

    assert.equal(res.statusCode, 200);
    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.paymentStatus, 'FAILED');
    assert.equal(stored.status, 'AWAITING_PAYMENT');   // status NEVER changes on failure
    assert.equal(release.calls.length, 0);
});

test('xenditWebhook: an expired event sets paymentStatus=EXPIRED but never releases', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const release = releaseSpy(fake);

    const body = JSON.stringify({ event: 'payment_session.expired', data: { payment_id: 'py-3', reference_id: 'o1:1', status: 'EXPIRED', amount: 570, currency: 'PHP' } });
    await xenditWebhookHandler(asDb(fake), release.fn, post(body), CONFIG, () => NOW);

    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.paymentStatus, 'EXPIRED');
    assert.equal(stored.status, 'AWAITING_PAYMENT');
    assert.equal(release.calls.length, 0);
});

test('xenditWebhook: a late failed event after PAID is ignored (never downgrades a paid order)', async () => {
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1', { status: 'PAID', paymentStatus: 'PAID' });
    const release = releaseSpy(fake);

    const body = JSON.stringify({ event: 'payment.failed', data: { payment_id: 'py-4', reference_id: 'o1:1', status: 'FAILED', amount: 570, currency: 'PHP' } });
    const res = await xenditWebhookHandler(asDb(fake), release.fn, post(body), CONFIG, () => NOW);

    assert.equal(res.statusCode, 200);
    const stored = fake._read('qr_orders', 'o1')!;
    assert.equal(stored.status, 'PAID');               // unchanged
    assert.equal(stored.paymentStatus, 'PAID');
    assert.equal(release.calls.length, 0);
});

test('xenditWebhook: a retried delivery re-drives release if the first release did not complete', async () => {
    // Models a crash / transient failure between the PAID commit and the release
    // call: the order is PAID but never got released. A Xendit retry must NOT be
    // swallowed by the ledger — it re-drives the (idempotent) release so
    // fulfillment still happens exactly once.
    const fake = new FakeFirestore();
    seedOrder(fake, 'o1');
    const calls: string[] = [];
    let first = true;
    const flakyRelease = async (orderId: string): Promise<ReleaseOrderResult> => {
        calls.push(orderId);
        if (first) { first = false; throw new Error('release crashed'); }
        const order = fake._read('qr_orders', orderId)!;
        fake._seed('qr_orders', orderId, { ...order, released: true });
        return { released: true, orderId };
    };

    // First delivery: applies PAID, release throws (caught) — order paid, unreleased.
    await xenditWebhookHandler(asDb(fake), flakyRelease, post(paidBody()), CONFIG, () => NOW);
    // Retry (ledger already exists): must still re-drive release.
    const retry = await xenditWebhookHandler(asDb(fake), flakyRelease, post(paidBody()), CONFIG, () => NOW);

    assert.equal(retry.statusCode, 200);
    assert.equal(calls.length, 2);                     // release attempted again on retry
    assert.equal(fake._read('qr_orders', 'o1')!.status, 'PAID');
});

test('xenditWebhook: a non-POST request → 405', async () => {
    const fake = new FakeFirestore();
    const release = releaseSpy(fake);
    const res = await xenditWebhookHandler(asDb(fake), release.fn, { method: 'GET', headers: { 'x-callback-token': TOKEN }, rawBody: '' }, CONFIG, () => NOW);
    assert.equal(res.statusCode, 405);
    assert.equal(release.calls.length, 0);
});
