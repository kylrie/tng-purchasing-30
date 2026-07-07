/**
 * Unit tests — Xendit HTTP client wrapper (Phase 3 · createXenditSession seam).
 * Runs under `tsx --test` with a STUBBED fetch — no real HTTP, no live Xendit.
 *
 * Proves (QR_XENDIT_IMPLEMENTATION_PLAN §7): correct base + Basic auth header,
 * Idempotency-key forwarded, success mapping, HTTP-error → non-retriable,
 * network/timeout → retriable, and the secret key is NEVER logged.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createXenditHttpClient, XenditClientError, XenditCreateSessionParams } from '../xenditClient';

const SECRET = 'xnd_test_SUPERSECRETKEY123';
const BASE = 'https://api.xendit.co';

const PARAMS: XenditCreateSessionParams = {
    referenceId: 'order123:1',
    amount: 570,
    currency: 'PHP',
    items: [{ name: 'Sisig', quantity: 2, price: 285, category: 'Mains' }],
    successUrl: 'https://tng.example/order-status/order123',
    cancelUrl: 'https://tng.example/order-status/order123',
    metadata: { order_id: 'order123', table_no: '12', business_unit_id: 'bu1' },
    idempotencyKey: 'session:order123:1',
};

/** Minimal fetch Response stub. */
function jsonResponse(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() { return body; },
        async text() { return JSON.stringify(body); },
    };
}

function okSessionBody() {
    return {
        payment_session_id: 'ps-abc',
        payment_request_id: 'pr-abc',
        payment_link_url: 'https://checkout.xendit.co/web/ps-abc',
        expires_at: '2026-07-03T12:30:00.000Z',
    };
}

test('xenditClient: posts to /sessions (no version prefix) with Basic auth + Idempotency-key', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit = {};
    const fetchImpl = async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return jsonResponse(200, okSessionBody()) as unknown as Response;
    };
    const client = createXenditHttpClient({ secretKey: SECRET, apiBase: BASE, fetchImpl });

    await client.createSession(PARAMS);

    // Regression guard: the official Xendit Create Session endpoint is
    // POST https://api.xendit.co/sessions — no /v3/ path segment ("v3" is a
    // product-generation label, not part of the URL). A prior version of this
    // client requested /v3/sessions, which Xendit's real API 404s (confirmed
    // against docs.xendit.co/apidocs/create-session and live staging logs).
    assert.equal(capturedUrl, 'https://api.xendit.co/sessions');
    assert.equal(capturedInit.method, 'POST');
    const headers = capturedInit.headers as Record<string, string>;
    const expectedAuth = 'Basic ' + Buffer.from(SECRET + ':').toString('base64');
    assert.equal(headers['Authorization'], expectedAuth);
    assert.equal(headers['Idempotency-key'], 'session:order123:1');
    assert.match(headers['Content-Type'], /application\/json/);
    // Body carries the server amount + reference, never a client price.
    const body = JSON.parse(capturedInit.body as string);
    assert.equal(body.reference_id, 'order123:1');
    assert.equal(body.amount, 570);
    // Regression guard: Xendit's /sessions schema requires `country` — a live
    // TEST-mode call without it returned 400 API_VALIDATION_ERROR
    // ("must have required property 'country'"). This integration is PH-only.
    assert.equal(body.country, 'PH');
    assert.equal(body.currency, 'PHP');
    // Regression guard: Xendit's /sessions schema requires each item to carry
    // its own `reference_id` — a live TEST-mode call without it returned 400
    // API_VALIDATION_ERROR ("items/0 must have required property 'reference_id'").
    // Regression guard: the full required item schema (reference_id, type, name,
    // net_unit_amount, quantity, category), confirmed field-by-field against
    // live TEST-mode 400 API_VALIDATION_ERROR responses and cross-checked
    // against docs.xendit.co/apidocs/create-session. `price` is not a real
    // Xendit field name — it must be sent as `net_unit_amount`.
    assert.equal(body.items[0].reference_id, 'order123:1:item:0');
    assert.equal(body.items[0].type, 'PHYSICAL_PRODUCT');
    assert.equal(body.items[0].name, 'Sisig');
    assert.equal(body.items[0].net_unit_amount, 285);
    assert.equal(body.items[0].quantity, 2);
    assert.equal(body.items[0].category, 'Mains');
    assert.equal(body.items[0].price, undefined);
});

test('xenditClient: maps a 2xx response to the session shape', async () => {
    const fetchImpl = async () => jsonResponse(200, okSessionBody()) as unknown as Response;
    const client = createXenditHttpClient({ secretKey: SECRET, apiBase: BASE, fetchImpl });

    const session = await client.createSession(PARAMS);

    assert.equal(session.paymentSessionId, 'ps-abc');
    assert.equal(session.paymentRequestId, 'pr-abc');
    assert.equal(session.paymentLinkUrl, 'https://checkout.xendit.co/web/ps-abc');
    assert.equal(session.expiresAtMillis, Date.parse('2026-07-03T12:30:00.000Z'));
});

test('xenditClient: defaults expiry to now + 30min when Xendit omits expires_at', async () => {
    const body = okSessionBody() as Record<string, unknown>;
    delete body.expires_at;
    const fetchImpl = async () => jsonResponse(200, body) as unknown as Response;
    const client = createXenditHttpClient({ secretKey: SECRET, apiBase: BASE, fetchImpl, now: () => 1_000 });

    const session = await client.createSession(PARAMS);
    assert.equal(session.expiresAtMillis, 1_000 + 30 * 60_000);
});

test('xenditClient: a non-2xx response throws a NON-retriable XenditClientError', async () => {
    const fetchImpl = async () => jsonResponse(400, { error_code: 'API_VALIDATION_ERROR' }) as unknown as Response;
    const client = createXenditHttpClient({ secretKey: SECRET, apiBase: BASE, fetchImpl });

    await assert.rejects(
        () => client.createSession(PARAMS),
        (e: unknown) => e instanceof XenditClientError && e.retriable === false && e.status === 400,
    );
});

test('xenditClient: a network/timeout error throws a RETRIABLE XenditClientError', async () => {
    const fetchImpl = async () => { throw new Error('network down'); };
    const client = createXenditHttpClient({ secretKey: SECRET, apiBase: BASE, fetchImpl });

    await assert.rejects(
        () => client.createSession(PARAMS),
        (e: unknown) => e instanceof XenditClientError && e.retriable === true,
    );
});

test('xenditClient: the secret key is NEVER written to logs on error', async () => {
    const logged: string[] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
    try {
        const fetchImpl = async () => jsonResponse(500, { error_code: 'SERVER_ERROR' }) as unknown as Response;
        const client = createXenditHttpClient({ secretKey: SECRET, apiBase: BASE, fetchImpl });
        await client.createSession(PARAMS).catch(() => { /* expected */ });
    } finally {
        console.error = orig;
    }
    const all = logged.join('\n');
    assert.equal(all.includes(SECRET), false, 'secret key must never appear in logs');
});
