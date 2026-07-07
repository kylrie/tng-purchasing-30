"use strict";
/**
 * createXenditSession — core handler (Phase 3 · payment session creation)
 *
 * Turns an existing `AWAITING_PAYMENT` order into a Xendit hosted-checkout link.
 * NOTHING about price is trusted from the client — `{ orderId }` is the only
 * input and the amount/items are read from the SERVER order document.
 *
 * `db` and `xenditClient` are injected so the handler is fully unit-testable
 * with the FakeFirestore + a stub client (no emulator, no live Xendit). `config`
 * carries the kill-switch flag, the public base URL, and an injectable clock.
 *
 * Idempotency (QR_XENDIT_IMPLEMENTATION_PLAN §5, layer 2):
 *  - app-level reuse: if the order still has an ACTIVE session, return its link
 *    instead of minting a second one (no Xendit call);
 *  - per-attempt reference_id (`${orderId}:${attempt}`) — the attempt counter is
 *    incremented inside a transaction so two concurrent calls can never mint the
 *    same reference_id, and a retry after FAILED/EXPIRED always gets a fresh one
 *    (Xendit forbids reusing a spent reference).
 *
 * This handler NEVER writes `status = PAID` — that is the webhook's sole job.
 * `status` stays `AWAITING_PAYMENT`; only `paymentStatus` and the session fields
 * move here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPayable = isPayable;
exports.isReusableSession = isReusableSession;
exports.referenceIdFor = referenceIdFor;
exports.buildSessionParams = buildSessionParams;
exports.createXenditSessionHandler = createXenditSessionHandler;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const rateLimit_1 = require("./rateLimit");
const xenditClient_1 = require("./xenditClient");
// paymentStatus values from which a NEW session may be created (§1 step 2).
const PAYABLE_PAYMENT_STATUSES = new Set(['UNPAID', 'AWAITING_PAYMENT', 'FAILED', 'EXPIRED']);
/** Pure: may a session be created for this order? Only an order still awaiting
 *  payment (never a paid / served / cancelled one) qualifies. */
function isPayable(order) {
    return order.status === 'AWAITING_PAYMENT'
        && typeof order.paymentStatus === 'string'
        && PAYABLE_PAYMENT_STATUSES.has(order.paymentStatus);
}
/** Pure: does the order still have an ACTIVE session that can be reused? A dead
 *  or expired session is NOT reused (short expiry + webhook-cleared fields keep
 *  a stale link from being handed out — §7 reuse-ACTIVE correctness). */
function isReusableSession(order, now) {
    return order.paymentStatus === 'AWAITING_PAYMENT'
        && typeof order.xenditPaymentSessionId === 'string' && order.xenditPaymentSessionId.length > 0
        && typeof order.paymentLinkUrl === 'string' && order.paymentLinkUrl.length > 0
        && typeof order.paymentReference === 'string' && order.paymentReference.length > 0
        && typeof order.sessionExpiresAtMillis === 'number' && order.sessionExpiresAtMillis > now;
}
/** Pure: per-attempt reference id. orderId is a Firestore auto-id (no ':'), so
 *  `${orderId}:${attempt}` parses unambiguously back to the order in the webhook. */
function referenceIdFor(orderId, attempt) {
    return `${orderId}:${attempt}`;
}
/** Pure: build the Xendit request from the SERVER order (no client price). */
function buildSessionParams(order, orderId, attempt, publicBaseUrl) {
    const referenceId = referenceIdFor(orderId, attempt);
    const returnUrl = `${publicBaseUrl.replace(/\/+$/, '')}/order-status/${orderId}`;
    // Success carries a SAFE marker so OrderStatusView starts payment-confirmation
    // polling immediately on return. It is only a hint to poll getQrOrder — the
    // redirect is NEVER trusted as proof of payment (webhook is the sole source
    // of PAID). Cancel stays bare (no marker → no confirming/poll state).
    const successReturnUrl = `${returnUrl}?return=xendit`;
    const items = (order.items ?? []).map(i => ({
        name: typeof i.productName === 'string' ? i.productName : '',
        quantity: Number(i.quantity ?? 0),
        price: Number(i.unitPrice ?? 0),
        // Xendit's /sessions item schema requires `category` (confirmed live
        // TEST-mode 400 API_VALIDATION_ERROR). Real menu-item category when the
        // stored order line has one; a non-empty fallback otherwise so the
        // request never resends an empty/absent required field.
        category: typeof i.category === 'string' && i.category.length > 0 ? i.category : 'General',
    }));
    return {
        referenceId,
        amount: Number(order.totalAmount ?? 0),
        currency: order.currency ?? 'PHP',
        items,
        successUrl: successReturnUrl,
        cancelUrl: returnUrl,
        metadata: {
            order_id: orderId,
            table_no: typeof order.tableNumber === 'string' ? order.tableNumber : '',
            business_unit_id: typeof order.businessUnitId === 'string' ? order.businessUnitId : '',
        },
        idempotencyKey: `session:${referenceId}`,
    };
}
async function createXenditSessionHandler(db, xenditClient, request, config) {
    const now = config.now ?? Date.now;
    // 1. Shape validation.
    const rawId = request.data?.orderId;
    if (typeof rawId !== 'string' || rawId.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'orderId is required');
    }
    const orderId = rawId.trim();
    // 2. Kill switch — refuse before any read or Xendit call (instant rollback).
    if (!config.paymentsEnabled) {
        throw new https_1.HttpsError('failed-precondition', 'Online payments are currently unavailable.');
    }
    const orderRef = db.collection('qr_orders').doc(orderId);
    // 3. Resolve the order. A bogus id fails here — before any rate-limit doc is
    //    created — so the rate-limit collection stays bounded to real tables.
    const firstSnap = await orderRef.get();
    if (!firstSnap.exists)
        throw new https_1.HttpsError('not-found', 'Order not found');
    const order = firstSnap.data();
    // 4. Rate limit per table (session creation is a Xendit round-trip + a
    //    card-testing surface — tighter budget than order creation).
    const tableId = typeof order.tableId === 'string' && order.tableId ? order.tableId : orderId;
    await (0, rateLimit_1.enforceRateLimit)(db, `session:${tableId}`, rateLimit_1.SESSION_CREATE_LIMIT, now());
    // 5. Precondition: only an order still awaiting payment may get a session.
    if (!isPayable(order)) {
        throw new https_1.HttpsError('failed-precondition', 'This order can no longer be paid.');
    }
    // 6. Reuse an ACTIVE session (idempotency) — no second session, no Xendit call.
    if (isReusableSession(order, now())) {
        return {
            paymentLinkUrl: order.paymentLinkUrl,
            reference: order.paymentReference,
            expiresAtMillis: order.sessionExpiresAtMillis,
        };
    }
    // 7. Reserve the attempt number atomically. Re-reading + incrementing in one
    //    transaction means two concurrent calls can never mint the same
    //    reference_id (each optimistic-retry sees the other's committed bump).
    const attempt = await db.runTransaction(async (txn) => {
        const snap = await txn.get(orderRef);
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Order not found');
        const fresh = snap.data();
        if (!isPayable(fresh))
            throw new https_1.HttpsError('failed-precondition', 'This order can no longer be paid.');
        const next = (typeof fresh.paymentAttempt === 'number' ? fresh.paymentAttempt : 0) + 1;
        txn.update(orderRef, { paymentAttempt: next, updatedAt: firestore_1.FieldValue.serverTimestamp() });
        return next;
    });
    // 8. Call Xendit OUTSIDE any transaction (network I/O). On failure the session
    //    fields are never written, so the order is not left half-written; the
    //    bumped attempt simply rolls forward so the next retry uses a fresh ref.
    const params = buildSessionParams(order, orderId, attempt, config.publicBaseUrl);
    let session;
    try {
        session = await xenditClient.createSession(params);
    }
    catch (e) {
        if (e instanceof xenditClient_1.XenditClientError) {
            // Transient (network/timeout/5xx) → retriable; definite (4xx/bad body) → internal.
            throw new https_1.HttpsError(e.retriable ? 'unavailable' : 'internal', 'Could not start the payment. Please try again.');
        }
        console.error('createXenditSession unexpected error:', e);
        throw new https_1.HttpsError('internal', 'Could not start the payment. Please try again.');
    }
    // 9. Persist the session + transition paymentStatus (status stays AWAITING_PAYMENT).
    //    Re-read + re-validate inside the transaction: if the order was paid (or
    //    otherwise moved on) while we were talking to Xendit — e.g. the webhook
    //    landed a concurrent payment — we must NOT downgrade paymentStatus or
    //    stamp a link onto a paid order. The freshly-created session is left to
    //    expire (money-safe: it charges nothing until the customer checks out).
    await db.runTransaction(async (txn) => {
        const snap = await txn.get(orderRef);
        if (!snap.exists || !isPayable(snap.data())) {
            throw new https_1.HttpsError('failed-precondition', 'This order can no longer be paid.');
        }
        txn.update(orderRef, {
            paymentStatus: 'AWAITING_PAYMENT',
            paymentReference: params.referenceId,
            xenditPaymentSessionId: session.paymentSessionId,
            xenditPaymentRequestId: session.paymentRequestId,
            paymentLinkUrl: session.paymentLinkUrl,
            sessionExpiresAtMillis: session.expiresAtMillis,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return {
        paymentLinkUrl: session.paymentLinkUrl,
        reference: params.referenceId,
        expiresAtMillis: session.expiresAtMillis,
    };
}
//# sourceMappingURL=createXenditSession.handler.js.map