"use strict";
/**
 * updateQrOrderStatus — core handler (QR Operations · kitchen/fulfillment transitions)
 *
 * The ONLY way a staff member advances a QR order through fulfillment. `qr_orders`
 * is `write: if false` for clients, so every kitchen transition MUST come through
 * this callable (never local-only UI state). Server-authoritative, BU-scoped,
 * RBAC-gated, and structurally payment-safe:
 *
 *   - The ONLY entry into the kitchen chain is PAID → IN_KITCHEN, and PAID is set
 *     exclusively by the Xendit webhook. So an unpaid order can never be pushed
 *     into the kitchen here — payment is enforced by the transition graph itself.
 *   - Only strict forward transitions along a single linear chain are allowed:
 *       PAID → IN_KITCHEN → READY → SERVED → COMPLETED
 *     Anything else (backwards, skipping a stage, from AWAITING_PAYMENT, from a
 *     terminal/failed state) is rejected `failed-precondition`.
 *   - Idempotent: asking to move an order to the status it is already in is a
 *     no-op success (safe double-tap on a kitchen screen).
 *   - Append-only audit: each applied transition pushes a `statusHistory` entry
 *     ({ status, at, by, role }) so the operations timeline shows real events.
 *
 * db is injected for testing; the onCall wrapper passes the real `qrDb`.
 * No Xendit, no inventory deduction, no payment mutation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEXT_STATUS = void 0;
exports.updateQrOrderStatusHandler = updateQrOrderStatusHandler;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("./auth");
/** Defensive cap so the audit array can never grow unbounded (a real order sees ~4). */
const MAX_HISTORY = 50;
/**
 * The linear fulfillment chain. `NEXT_STATUS[current]` is the ONLY status a staff
 * member may move an order to from `current`. Payment (PAID) is produced solely by
 * the webhook, so it is a valid SOURCE here but never a target — no one can mark an
 * order paid through this callable.
 */
exports.NEXT_STATUS = {
    PAID: 'IN_KITCHEN',
    IN_KITCHEN: 'READY',
    READY: 'SERVED',
    SERVED: 'COMPLETED',
};
/** Every status this callable is ever allowed to WRITE (target allow-list). */
const WRITABLE_TARGETS = new Set(Object.values(exports.NEXT_STATUS));
/** Whether the caller may act on an order in this business unit (mirrors postOfficialInvoice). */
function callerCoversBU(user, businessUnitId) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')
        return true; // cross-BU by design
    if (user.businessId && user.businessId === businessUnitId)
        return true;
    if (Array.isArray(user.businessUnitIds) && user.businessUnitIds.includes(businessUnitId))
        return true;
    return false;
}
async function updateQrOrderStatusHandler(db, request) {
    // 1. RBAC — authenticated staff with an operations role (fails closed).
    const user = await (0, auth_1.requireStaffRole)(db, request.auth?.uid, auth_1.QR_OPS_ROLES);
    const uid = request.auth.uid;
    // 2. Input validation.
    const orderIdRaw = request.data?.orderId;
    if (typeof orderIdRaw !== 'string' || orderIdRaw.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'orderId is required');
    }
    const toStatusRaw = request.data?.toStatus;
    if (typeof toStatusRaw !== 'string' || toStatusRaw.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'toStatus is required');
    }
    const orderId = orderIdRaw.trim();
    const toStatus = toStatusRaw.trim();
    // 3. The target must be a status this callable is permitted to write at all.
    //    (Blocks e.g. PAID / AWAITING_PAYMENT / CANCELLED being set through here.)
    if (!WRITABLE_TARGETS.has(toStatus)) {
        throw new https_1.HttpsError('failed-precondition', `Cannot set status to ${toStatus} here`);
    }
    // 4. Apply atomically: re-read the CURRENT status inside the transaction so a
    //    concurrent transition can't be lost, and validate the transition against
    //    the live current status (never the client's assumption).
    const orderRef = db.collection('qr_orders').doc(orderId);
    return db.runTransaction(async (txn) => {
        const snap = await txn.get(orderRef);
        if (!snap.exists) {
            throw new https_1.HttpsError('not-found', 'Order not found');
        }
        const order = snap.data();
        // BU scope — a non-admin caller may only act on their own BU's orders.
        const bu = typeof order.businessUnitId === 'string' ? order.businessUnitId : '';
        if (!callerCoversBU(user, bu)) {
            throw new https_1.HttpsError('permission-denied', 'Order belongs to another business unit');
        }
        const current = typeof order.status === 'string' ? order.status : '';
        // Idempotent no-op: already at the requested status (safe double-tap).
        if (current === toStatus) {
            return { orderId, status: current, changed: false };
        }
        // The transition must be exactly the single allowed forward step.
        if (exports.NEXT_STATUS[current] !== toStatus) {
            throw new https_1.HttpsError('failed-precondition', `Illegal transition ${current || '(none)'} → ${toStatus}`);
        }
        // Append-only audit entry for the operations timeline. Read-modify-write
        // of the full array inside this transaction (not FieldValue.arrayUnion):
        // the txn already read the doc, so Firestore retries on any concurrent
        // write, keeping the append atomic — and it stays deterministically
        // testable with the in-memory fake.
        const historyEntry = {
            status: toStatus,
            at: new Date().toISOString(),
            by: uid,
            role: user.role,
        };
        const priorHistory = Array.isArray(order.statusHistory)
            ? order.statusHistory
            : [];
        const statusHistory = [...priorHistory, historyEntry].slice(-MAX_HISTORY);
        txn.update(orderRef, {
            status: toStatus,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            statusHistory,
        });
        return { orderId, status: toStatus, changed: true };
    });
}
//# sourceMappingURL=updateQrOrderStatus.handler.js.map