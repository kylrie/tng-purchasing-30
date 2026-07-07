/**
 * QR Ordering — pure order-release logic (Sprint 2 · release infrastructure)
 *
 * "Release" = the moment a PAID order becomes work for the kitchen/bar. This
 * module holds ONLY the deterministic decision + the field patch — no I/O, no
 * firebase-admin imports (mirrors orderLogic.ts) so it is trivially unit-testable.
 *
 * DORMANT until payment exists: nothing calls the release service yet. When the
 * Xendit webhook lands (see docs/QR_XENDIT_IMPLEMENTATION_PLAN.md §2), it will,
 * AFTER confirming a genuine SUCCEEDED payment, invoke releaseQrOrder() which
 * uses this logic. No Xendit, no webhook, no inventory here.
 */

/** What authorized the release (recorded for audit). */
export type ReleaseSource = 'XENDIT_WEBHOOK' | 'MANUAL' | 'SYSTEM';

/** Why an order could not be released (typed, so callers/logs stay consistent). */
export type ReleaseIneligibleReason =
    | 'ORDER_NOT_FOUND'   // no such order
    | 'INVALID_ORDER'     // present but not a recognizable order shape
    | 'NOT_PAID'          // payment has not cleared
    | 'ALREADY_RELEASED'; // released before (idempotent no-op)

export type ReleaseDecision =
    | { eligible: true }
    | { eligible: false; reason: ReleaseIneligibleReason };

/** Minimal order shape the decision reads (only the fields it needs). */
export interface ReleasableOrder {
    status?: unknown;
    paymentStatus?: unknown;
    released?: unknown;
}

/**
 * Pure eligibility check. An order may be released iff:
 *   1. it is a valid, existing order,
 *   2. it is PAID (payment has cleared), and
 *   3. it has not already been released.
 * Deterministic, no I/O. The order is considered PAID when `paymentStatus` is
 * 'PAID' (authoritative), falling back to `status === 'PAID'` if paymentStatus
 * is absent.
 */
export function evaluateReleaseEligibility(order: ReleasableOrder | null | undefined): ReleaseDecision {
    if (order === null || order === undefined || typeof order !== 'object') {
        return { eligible: false, reason: 'ORDER_NOT_FOUND' };
    }
    const hasStatus = typeof order.status === 'string';
    const hasPaymentStatus = typeof order.paymentStatus === 'string';
    if (!hasStatus && !hasPaymentStatus) {
        return { eligible: false, reason: 'INVALID_ORDER' };
    }
    if (order.released === true) {
        return { eligible: false, reason: 'ALREADY_RELEASED' };
    }
    const isPaid = order.paymentStatus === 'PAID' || (!hasPaymentStatus && order.status === 'PAID');
    if (!isPaid) {
        return { eligible: false, reason: 'NOT_PAID' };
    }
    return { eligible: true };
}

export interface BuildReleasePatchInput {
    source: ReleaseSource;
    /** Server timestamp sentinel / Date — injected so this stays pure. */
    releasedAt: unknown;
    /** Uid or system identifier that performed the release (audit). */
    releasedBy?: string;
    /** Authorizing event id (e.g. the Xendit payment_id) — dormant for now (audit). */
    releaseEventId?: string;
}

/**
 * Build the field patch that marks an eligible order released. Pure — the caller
 * applies it inside a transaction. Deliberately does NOT change `status`: the
 * kitchen/bar boards already surface PAID orders, so this adds release metadata
 * + audit only (kitchen/bar UI untouched, per task scope). `released: true` is
 * the one-way, exactly-once guard against duplicate fulfillment tickets.
 */
export function buildReleasePatch(input: BuildReleasePatchInput): Record<string, unknown> {
    const patch: Record<string, unknown> = {
        released: true,
        releasedAt: input.releasedAt,
        releaseSource: input.source,
    };
    if (input.releasedBy) patch.releasedBy = input.releasedBy;
    if (input.releaseEventId) patch.releaseEventId = input.releaseEventId;
    return patch;
}
