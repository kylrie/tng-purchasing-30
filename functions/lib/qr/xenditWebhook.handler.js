"use strict";
/**
 * xenditWebhook — core handler (Phase 3 · the source of truth for "paid")
 *
 * The ONLY thing that flips an order to PAID. The browser success_return_url is
 * a thank-you screen, never proof of payment. This handler verifies the Xendit
 * callback token, dedupes via the `xendit_events` ledger, re-validates the
 * amount/currency against the SERVER order, and — only for a genuine SUCCEEDED
 * payment — performs the one-way AWAITING_PAYMENT→PAID transition and releases
 * the order to the kitchen/bar.
 *
 * Injectable seams so it is fully unit-testable with no HTTP server / emulator /
 * live Xendit:
 *   - `db`      — FakeFirestore in tests, the real Admin SDK in prod.
 *   - `release` — the dormant releaseQrOrder service (spied in tests). Called
 *                 exactly once, only after an applied paid transition.
 *   - `request` — the already-extracted method/headers/rawBody (the onRequest
 *                 wrapper adapts express req → this shape).
 *   - `now`     — injectable clock.
 *
 * Returns `{ statusCode, body }`; the wrapper writes the HTTP response. It
 * returns 200 for every acknowledged-but-not-applied case (duplicate, rejected,
 * unknown order, non-paid) so Xendit does not retry-storm; only a bad token
 * (401) and a non-POST (405) are non-200.
 *
 * SECURITY (§4): constant-time token compare; the token is NEVER logged; no
 * secret/PII in logs — only event / orderId / payment_id / result.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokensMatch = tokensMatch;
exports.parseOrderId = parseOrderId;
exports.classifyEvent = classifyEvent;
exports.extractEvent = extractEvent;
exports.xenditWebhookHandler = xenditWebhookHandler;
const firestore_1 = require("firebase-admin/firestore");
const node_crypto_1 = require("node:crypto");
const ORDERS_COLLECTION = 'qr_orders';
const EVENTS_COLLECTION = 'xendit_events';
// ── Pure helpers (exported for direct unit testing) ──────────────────────────
/** Constant-time token compare. Length-mismatch is a definite non-match, but we
 *  still run a compare against a same-length buffer so timing does not leak the
 *  expected length. Never logs either value. */
function tokensMatch(provided, expected) {
    if (typeof provided !== 'string' || expected.length === 0)
        return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
        // Compare b against itself to spend the same time, then fail.
        (0, node_crypto_1.timingSafeEqual)(b, b);
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
/** reference_id is `${orderId}:${attempt}`; orderId is a Firestore auto-id (no
 *  ':'), so everything before the FIRST ':' is the orderId. Returns null if the
 *  reference has no ':' or an empty orderId part. */
function parseOrderId(referenceId) {
    if (typeof referenceId !== 'string')
        return null;
    const idx = referenceId.indexOf(':');
    if (idx <= 0)
        return null;
    return referenceId.slice(0, idx);
}
/** Classify the delivered event into the effect it drives. Uses the event name
 *  first, then the status field as a fallback. */
function classifyEvent(event, status) {
    const e = (event ?? '').toLowerCase();
    const s = (status ?? '').toUpperCase();
    if (e.includes('succeeded') || e.includes('completed') || s === 'SUCCEEDED' || s === 'COMPLETED' || s === 'PAID')
        return 'paid';
    if (e.includes('failed') || s === 'FAILED')
        return 'failed';
    if (e.includes('expired') || s === 'EXPIRED')
        return 'expired';
    return 'other';
}
/** Tolerant extraction from the (possibly nested) Xendit v3 payload. */
function extractEvent(body) {
    const root = (body && typeof body === 'object') ? body : {};
    const data = (root.data && typeof root.data === 'object') ? root.data : root;
    const str = (v) => (typeof v === 'string' ? v : '');
    const pm = (data.payment_method && typeof data.payment_method === 'object') ? data.payment_method : {};
    return {
        event: str(root.event),
        paymentId: str(data.payment_id) || str(data.id),
        referenceId: str(data.reference_id),
        sessionId: str(data.payment_session_id) || str(data.session_id),
        status: str(data.status),
        amount: typeof data.amount === 'number' ? data.amount : Number(data.amount),
        currency: str(data.currency),
        channelCode: str(data.channel_code),
        paymentMethodType: str(pm.type) || str(data.payment_method_type),
    };
}
// ── Handler ──────────────────────────────────────────────────────────────────
async function xenditWebhookHandler(db, release, request, config, now = Date.now) {
    // 1. POST only.
    if (request.method !== 'POST') {
        return { statusCode: 405, body: { received: false, error: 'method_not_allowed' } };
    }
    // 2. Verify the callback token (constant-time). Bad/missing → 401, no processing.
    if (!tokensMatch(request.headers['x-callback-token'], config.callbackToken)) {
        console.warn('xenditWebhook.auth.rejected'); // never log the token/header
        return { statusCode: 401, body: { received: false, error: 'unauthorized' } };
    }
    // 3. Parse the JSON body safely.
    let parsed;
    try {
        parsed = JSON.parse(request.rawBody || '{}');
    }
    catch {
        return { statusCode: 400, body: { received: false, error: 'invalid_json' } };
    }
    const ev = extractEvent(parsed);
    // 4. Without a payment_id we cannot build the idempotency ledger id — ack and
    //    drop (200, so Xendit does not retry a payload we can never process).
    if (!ev.paymentId || !ev.event) {
        console.warn('xenditWebhook.ignored.missingId', { event: ev.event });
        return { statusCode: 200, body: { received: true, result: 'ignored' } };
    }
    const kind = classifyEvent(ev.event, ev.status);
    const orderId = ev.referenceId ? parseOrderId(ev.referenceId) : null;
    const ledgerId = `${ev.paymentId}:${ev.event}`;
    // 5. Idempotency claim + effect, atomically. Creating the ledger doc in the
    //    SAME transaction that applies the effect means a second delivery finds
    //    the doc and no-ops.
    const orderRef = orderId ? db.collection(ORDERS_COLLECTION).doc(orderId) : null;
    // A paid order that hasn't been released yet still needs releasing — used to
    // self-heal a release that never completed (crash / transient failure)
    // between the PAID commit and the release call on the original delivery.
    const paidButUnreleased = (order) => !!order && (order.paymentStatus === 'PAID' || order.status === 'PAID') && order.released !== true;
    const outcome = await db.runTransaction(async (txn) => {
        const ledgerRef = db.collection(EVENTS_COLLECTION).doc(ledgerId);
        const ledgerSnap = await txn.get(ledgerRef);
        // Duplicate delivery: no re-processing, but if the order is PAID and was
        // never released (e.g. the first delivery crashed before releasing),
        // re-drive the idempotent release so fulfillment still happens once.
        if (ledgerSnap.exists) {
            const dupOrder = orderRef ? (await txn.get(orderRef)).data() : undefined;
            return { result: 'duplicate', needsRelease: paidButUnreleased(dupOrder), orderId };
        }
        const orderSnap = orderRef ? await txn.get(orderRef) : undefined;
        const order = orderSnap?.exists ? orderSnap.data() : undefined;
        let result = 'ignored';
        let needsRelease = false;
        if (!order || !orderRef) {
            // Mis-routed / unknown reference — acknowledged, nothing to do.
            result = 'rejected';
        }
        else if (kind === 'paid') {
            const amountOk = Number(order.totalAmount) === ev.amount;
            const currencyOk = (order.currency ?? 'PHP') === ev.currency;
            const alreadyPaid = order.paymentStatus === 'PAID' || order.status === 'PAID';
            if (!amountOk || !currencyOk) {
                result = 'rejected'; // tampered / mis-routed — acknowledged, not applied
            }
            else if (alreadyPaid) {
                result = 'duplicate'; // idempotent no-op…
                needsRelease = paidButUnreleased(order); // …but self-heal a missed release
            }
            else if (order.status === 'AWAITING_PAYMENT') {
                txn.update(orderRef, {
                    status: 'PAID',
                    paymentStatus: 'PAID',
                    paidAt: firestore_1.FieldValue.serverTimestamp(),
                    xenditPaymentId: ev.paymentId,
                    xenditChannelCode: ev.channelCode,
                    paymentMethodType: ev.paymentMethodType,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                result = 'applied';
                needsRelease = true;
            }
            else {
                result = 'ignored'; // some later lifecycle state — do not re-open
            }
        }
        else if (kind === 'failed' || kind === 'expired') {
            const alreadyPaid = order.paymentStatus === 'PAID' || order.status === 'PAID';
            if (alreadyPaid) {
                result = 'ignored'; // late failure after success — never downgrade
            }
            else if (order.status === 'AWAITING_PAYMENT') {
                txn.update(orderRef, {
                    paymentStatus: kind === 'failed' ? 'FAILED' : 'EXPIRED',
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                result = 'applied'; // paymentStatus updated; status NEVER changes, never released
            }
            else {
                result = 'ignored';
            }
        }
        txn.set(ledgerRef, {
            id: ledgerId,
            xenditPaymentId: ev.paymentId,
            event: ev.event,
            orderId: orderId ?? null,
            businessUnitId: order?.businessUnitId ?? null,
            amount: Number.isNaN(ev.amount) ? null : ev.amount,
            currency: ev.currency || null,
            result,
            receivedAt: firestore_1.FieldValue.serverTimestamp(),
            processedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Only a genuine paid transition (or an already-paid order missing its
        // release) drives fulfillment — never a failed/expired/rejected event.
        return { result, needsRelease: needsRelease && kind === 'paid', orderId };
    });
    // 6. Release AFTER the transition commits — only for a paid order still
    //    needing release. releaseQrOrder is itself PAID-gated + idempotent, so a
    //    re-driven release yields exactly-once fulfillment.
    if (outcome.needsRelease && outcome.orderId) {
        try {
            await release(outcome.orderId, { source: 'XENDIT_WEBHOOK', releaseEventId: ev.paymentId });
        }
        catch (e) {
            // Never fail the ack on a release hiccup — the order is PAID and the
            // boards read live; log for follow-up (off the ack path).
            console.error('xenditWebhook.release.error', { orderId: outcome.orderId, error: e.message });
        }
    }
    console.info('xenditWebhook.processed', { event: ev.event, orderId: outcome.orderId, paymentId: ev.paymentId, result: outcome.result });
    return { statusCode: 200, body: { received: true, result: outcome.result } };
}
//# sourceMappingURL=xenditWebhook.handler.js.map