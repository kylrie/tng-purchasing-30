/**
 * QR Ordering — Order Release Service (Sprint 2 · release infrastructure)
 *
 * The server-side helper the future Xendit webhook will call, AFTER it verifies a
 * genuine SUCCEEDED payment, to release a paid order to the kitchen/bar. It is
 * DORMANT: it is intentionally NOT exported from index.ts, so it is not deployed
 * as any callable/HTTP function and nothing invokes it yet. No Xendit, no
 * webhook, no inventory deduction here.
 *
 * `db` is injected so this is testable with the in-memory FakeFirestore (no
 * emulator/Java). All release logic is delegated to the pure releaseLogic module.
 *
 * Safety properties (see the tests + docs/QR_ORDER_RELEASE_SERVICE.md):
 *  - PAID-gated: an unpaid order is never released.
 *  - Idempotent: releasing an already-released order is a no-op (exactly-once
 *    fulfillment — Master Plan §7.4). The read + write happen in one transaction
 *    so two concurrent callers cannot both release.
 *  - Server-only: writes go through the Admin SDK; `qr_orders` is `write: if false`
 *    for clients, so no client can set `released` itself.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import {
    evaluateReleaseEligibility,
    buildReleasePatch,
    ReleaseSource,
    ReleaseIneligibleReason,
} from './releaseLogic';

const QR_ORDERS_COLLECTION = 'qr_orders';

export interface ReleaseOrderOptions {
    source: ReleaseSource;
    /** Uid or system id performing the release (audit). */
    releasedBy?: string;
    /** Authorizing event id (e.g. Xendit payment_id) — dormant for now (audit). */
    releaseEventId?: string;
}

export type ReleaseOrderResult =
    | { released: true; orderId: string }
    | { released: false; orderId: string; reason: ReleaseIneligibleReason };

/**
 * Release a paid order to fulfillment. Reads the order and applies the release
 * patch atomically; returns a typed result. Never throws for a normal
 * ineligible outcome (unpaid / already-released / missing) — it returns
 * `{ released: false, reason }` so the caller can log/ack idempotently.
 */
export async function releaseQrOrder(
    db: Firestore,
    orderId: string,
    options: ReleaseOrderOptions,
): Promise<ReleaseOrderResult> {
    const ref = db.collection(QR_ORDERS_COLLECTION).doc(orderId);

    return db.runTransaction(async txn => {
        const snap = await txn.get(ref);
        const order = snap.exists ? snap.data() : undefined;

        const decision = evaluateReleaseEligibility(order);
        if (!decision.eligible) {
            return { released: false, orderId, reason: decision.reason };
        }

        txn.update(ref, buildReleasePatch({
            source: options.source,
            releasedBy: options.releasedBy,
            releaseEventId: options.releaseEventId,
            releasedAt: FieldValue.serverTimestamp(),
        }));

        return { released: true, orderId };
    });
}
