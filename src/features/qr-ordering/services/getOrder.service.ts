// QR Ordering — client for the getQrOrder Cloud Function (Sprint 2 read).
//
// Reads a diner's own order by id through the anonymous callable (Admin SDK
// server-side, so firestore.rules stays staff-only). Read-only: no payment,
// no Xendit, no kitchen writes.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from './qrFunctions';
import type { GetQrOrderInput, GetQrOrderResult, QrPaymentStatus } from '../types/qrOrder.types';

/** Fetch the sanitized customer-facing order projection. */
export async function fetchQrOrder(orderId: string): Promise<GetQrOrderResult> {
    const callable = httpsCallable<GetQrOrderInput, GetQrOrderResult>(getQrFunctions(), 'getQrOrder');
    const { data } = await callable({ orderId });
    return data;
}

/** True when the callable reported the order does not exist. */
export function isOrderNotFound(err: unknown): boolean {
    return ((err as { code?: string } | null)?.code ?? '') === 'functions/not-found';
}

/** Diner-friendly error message. Never surfaces internal codes/ids (L4). */
export function toUserFacingReadError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/invalid-argument':
            return 'This order link looks incomplete. Please check the link and try again.';
        case 'functions/resource-exhausted':
            return 'You’re refreshing very quickly. Please wait a few seconds and try again.';
        default:
            return 'We couldn’t load your order. Please check your connection and try again.';
    }
}

/**
 * Detect a return from the Xendit hosted checkout using ONLY safe, allow-listed
 * query-param markers. We read known keys and compare them to constant strings;
 * the param VALUE is never reflected into the DOM and is never trusted to mean
 * "paid" (payment truth comes only from the getQrOrder read — see isPaymentSettled).
 * The marker just decides whether to briefly poll while the webhook lands.
 */
export function isXenditReturn(search: string | undefined | null): boolean {
    if (!search) return false;
    try {
        const p = new URLSearchParams(search);
        const marker = (p.get('return') ?? p.get('payment') ?? '').toLowerCase();
        return marker === 'xendit' || marker === 'return' || p.has('from_xendit');
    } catch {
        return false;
    }
}

/** Terminal payment outcomes — polling stops here (PAID or a negative end-state). */
export function isPaymentSettled(paymentStatus: QrPaymentStatus | string | undefined): boolean {
    return paymentStatus === 'PAID'
        || paymentStatus === 'FAILED'
        || paymentStatus === 'EXPIRED'
        || paymentStatus === 'REFUNDED';
}

/**
 * Should we keep confirming/polling? A session that exists (paymentStatus
 * AWAITING_PAYMENT) is always pending. An UNPAID order is only treated as pending
 * when the diner clearly just returned from Xendit (a UNPAID order with no return
 * marker has no session in flight — e.g. the pre-payment/dark-launch flow — so we
 * do NOT poll it). Settled states are never pending.
 */
export function isPaymentPending(
    paymentStatus: QrPaymentStatus | string | undefined,
    returnedFromPayment: boolean,
): boolean {
    if (isPaymentSettled(paymentStatus)) return false;
    if (paymentStatus === 'AWAITING_PAYMENT') return true;
    if (paymentStatus === 'UNPAID') return returnedFromPayment;
    return false;
}

// The pure order/payment presentation maps live in a Firebase-free module so they
// stay unit-testable (this file imports config/firebase). Re-exported here so the
// existing `getOrder.service` import surface is unchanged for every call site.
export {
    presentStatus, presentPaymentStatus, presentTimeline, PAYMENT_STEP_INDEX,
} from './qrOrderPresenter';
export type { StatusTone, StatusPresentation, TimelinePresentation } from './qrOrderPresenter';
