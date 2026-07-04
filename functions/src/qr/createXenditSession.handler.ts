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

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore, FieldValue, Transaction } from 'firebase-admin/firestore';
import { enforceRateLimit, SESSION_CREATE_LIMIT } from './rateLimit';
import { XenditClient, XenditClientError, XenditCreateSessionParams } from './xenditClient';

// I/O contract — mirrors src/features/qr-ordering/types/qrOrder.types.ts
// (CreateXenditSessionInput / CreateXenditSessionResult). Defined locally so the
// functions build stays self-contained, matching the getQrOrder.handler pattern.
export interface CreateXenditSessionInput {
    orderId?: string;
}

export interface CreateXenditSessionResult {
    paymentLinkUrl: string;
    reference: string;
    expiresAtMillis: number;
}

/** Runtime config injected by the onCall wrapper (all testable). */
export interface SessionConfig {
    /** Master kill switch (QR_PAYMENTS_ENABLED). When false the callable refuses. */
    paymentsEnabled: boolean;
    /** Base for success/cancel return URLs, e.g. https://tng-systems.web.app. */
    publicBaseUrl: string;
    /** Injectable clock; defaults to Date.now. */
    now?: () => number;
}

/** The stored order fields this handler reads. */
interface OrderDoc {
    businessUnitId?: string;
    tableId?: string;
    tableNumber?: string;
    items?: { productName?: string; quantity?: number; unitPrice?: number }[];
    totalAmount?: number;
    currency?: string;
    status?: string;
    paymentStatus?: string;
    paymentAttempt?: number;
    paymentReference?: string;
    paymentLinkUrl?: string;
    xenditPaymentSessionId?: string;
    sessionExpiresAtMillis?: number;
}

// paymentStatus values from which a NEW session may be created (§1 step 2).
const PAYABLE_PAYMENT_STATUSES = new Set(['UNPAID', 'AWAITING_PAYMENT', 'FAILED', 'EXPIRED']);

/** Pure: may a session be created for this order? Only an order still awaiting
 *  payment (never a paid / served / cancelled one) qualifies. */
export function isPayable(order: OrderDoc): boolean {
    return order.status === 'AWAITING_PAYMENT'
        && typeof order.paymentStatus === 'string'
        && PAYABLE_PAYMENT_STATUSES.has(order.paymentStatus);
}

/** Pure: does the order still have an ACTIVE session that can be reused? A dead
 *  or expired session is NOT reused (short expiry + webhook-cleared fields keep
 *  a stale link from being handed out — §7 reuse-ACTIVE correctness). */
export function isReusableSession(order: OrderDoc, now: number): boolean {
    return order.paymentStatus === 'AWAITING_PAYMENT'
        && typeof order.xenditPaymentSessionId === 'string' && order.xenditPaymentSessionId.length > 0
        && typeof order.paymentLinkUrl === 'string' && order.paymentLinkUrl.length > 0
        && typeof order.paymentReference === 'string' && order.paymentReference.length > 0
        && typeof order.sessionExpiresAtMillis === 'number' && order.sessionExpiresAtMillis > now;
}

/** Pure: per-attempt reference id. orderId is a Firestore auto-id (no ':'), so
 *  `${orderId}:${attempt}` parses unambiguously back to the order in the webhook. */
export function referenceIdFor(orderId: string, attempt: number): string {
    return `${orderId}:${attempt}`;
}

/** Pure: build the Xendit request from the SERVER order (no client price). */
export function buildSessionParams(
    order: OrderDoc,
    orderId: string,
    attempt: number,
    publicBaseUrl: string,
): XenditCreateSessionParams {
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

export async function createXenditSessionHandler(
    db: Firestore,
    xenditClient: XenditClient,
    request: CallableRequest<CreateXenditSessionInput>,
    config: SessionConfig,
): Promise<CreateXenditSessionResult> {
    const now = config.now ?? Date.now;

    // 1. Shape validation.
    const rawId = request.data?.orderId;
    if (typeof rawId !== 'string' || rawId.trim() === '') {
        throw new HttpsError('invalid-argument', 'orderId is required');
    }
    const orderId = rawId.trim();

    // 2. Kill switch — refuse before any read or Xendit call (instant rollback).
    if (!config.paymentsEnabled) {
        throw new HttpsError('failed-precondition', 'Online payments are currently unavailable.');
    }

    const orderRef = db.collection('qr_orders').doc(orderId);

    // 3. Resolve the order. A bogus id fails here — before any rate-limit doc is
    //    created — so the rate-limit collection stays bounded to real tables.
    const firstSnap = await orderRef.get();
    if (!firstSnap.exists) throw new HttpsError('not-found', 'Order not found');
    const order = firstSnap.data() as OrderDoc;

    // 4. Rate limit per table (session creation is a Xendit round-trip + a
    //    card-testing surface — tighter budget than order creation).
    const tableId = typeof order.tableId === 'string' && order.tableId ? order.tableId : orderId;
    await enforceRateLimit(db, `session:${tableId}`, SESSION_CREATE_LIMIT, now());

    // 5. Precondition: only an order still awaiting payment may get a session.
    if (!isPayable(order)) {
        throw new HttpsError('failed-precondition', 'This order can no longer be paid.');
    }

    // 6. Reuse an ACTIVE session (idempotency) — no second session, no Xendit call.
    if (isReusableSession(order, now())) {
        return {
            paymentLinkUrl: order.paymentLinkUrl as string,
            reference: order.paymentReference as string,
            expiresAtMillis: order.sessionExpiresAtMillis as number,
        };
    }

    // 7. Reserve the attempt number atomically. Re-reading + incrementing in one
    //    transaction means two concurrent calls can never mint the same
    //    reference_id (each optimistic-retry sees the other's committed bump).
    const attempt = await db.runTransaction(async (txn: Transaction) => {
        const snap = await txn.get(orderRef);
        if (!snap.exists) throw new HttpsError('not-found', 'Order not found');
        const fresh = snap.data() as OrderDoc;
        if (!isPayable(fresh)) throw new HttpsError('failed-precondition', 'This order can no longer be paid.');
        const next = (typeof fresh.paymentAttempt === 'number' ? fresh.paymentAttempt : 0) + 1;
        txn.update(orderRef, { paymentAttempt: next, updatedAt: FieldValue.serverTimestamp() });
        return next;
    });

    // 8. Call Xendit OUTSIDE any transaction (network I/O). On failure the session
    //    fields are never written, so the order is not left half-written; the
    //    bumped attempt simply rolls forward so the next retry uses a fresh ref.
    const params = buildSessionParams(order, orderId, attempt, config.publicBaseUrl);
    let session;
    try {
        session = await xenditClient.createSession(params);
    } catch (e) {
        if (e instanceof XenditClientError) {
            // Transient (network/timeout/5xx) → retriable; definite (4xx/bad body) → internal.
            throw new HttpsError(e.retriable ? 'unavailable' : 'internal', 'Could not start the payment. Please try again.');
        }
        console.error('createXenditSession unexpected error:', e);
        throw new HttpsError('internal', 'Could not start the payment. Please try again.');
    }

    // 9. Persist the session + transition paymentStatus (status stays AWAITING_PAYMENT).
    //    Re-read + re-validate inside the transaction: if the order was paid (or
    //    otherwise moved on) while we were talking to Xendit — e.g. the webhook
    //    landed a concurrent payment — we must NOT downgrade paymentStatus or
    //    stamp a link onto a paid order. The freshly-created session is left to
    //    expire (money-safe: it charges nothing until the customer checks out).
    await db.runTransaction(async (txn: Transaction) => {
        const snap = await txn.get(orderRef);
        if (!snap.exists || !isPayable(snap.data() as OrderDoc)) {
            throw new HttpsError('failed-precondition', 'This order can no longer be paid.');
        }
        txn.update(orderRef, {
            paymentStatus: 'AWAITING_PAYMENT',
            paymentReference: params.referenceId,
            xenditPaymentSessionId: session.paymentSessionId,
            xenditPaymentRequestId: session.paymentRequestId,
            paymentLinkUrl: session.paymentLinkUrl,
            sessionExpiresAtMillis: session.expiresAtMillis,
            updatedAt: FieldValue.serverTimestamp(),
        });
    });

    return {
        paymentLinkUrl: session.paymentLinkUrl,
        reference: params.referenceId,
        expiresAtMillis: session.expiresAtMillis,
    };
}
