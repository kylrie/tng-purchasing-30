// QR Ordering — client for the getQrOrder Cloud Function (Sprint 2 read).
//
// Reads a diner's own order by id through the anonymous callable (Admin SDK
// server-side, so firestore.rules stays staff-only). Read-only: no payment,
// no Xendit, no kitchen writes.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from './qrFunctions';
import type { GetQrOrderInput, GetQrOrderResult, QrOrderStatus, QrPaymentStatus } from '../types/qrOrder.types';

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

export type StatusTone = 'amber' | 'blue' | 'emerald' | 'red' | 'slate';

export interface StatusPresentation {
    /** Human-friendly badge label. */
    label: string;
    tone: StatusTone;
    /** Current index into the 5-step timeline (received/payment/preparing/ready/served). */
    step: number;
    /** True for terminal-negative outcomes (cancelled / expired / failed / refunded). */
    negative: boolean;
}

/**
 * Pure map from a real order status to its timeline presentation. Kept out of the
 * component so it's deterministic and unit-testable. Sprint 2 orders sit at
 * AWAITING_PAYMENT (no payment wired yet); the rest are declared so the screen
 * already reflects the full lifecycle once later phases advance the status.
 */
export function presentStatus(status: QrOrderStatus): StatusPresentation {
    switch (status) {
        case 'AWAITING_PAYMENT':
            return { label: 'Awaiting payment', tone: 'amber', step: 1, negative: false };
        case 'PAID':
            return { label: 'Paid', tone: 'blue', step: 2, negative: false };
        case 'IN_KITCHEN':
            return { label: 'In the kitchen', tone: 'blue', step: 2, negative: false };
        case 'IN_BAR':
            return { label: 'At the bar', tone: 'blue', step: 2, negative: false };
        case 'READY':
            return { label: 'Ready', tone: 'emerald', step: 3, negative: false };
        case 'SERVED':
            return { label: 'Served', tone: 'emerald', step: 4, negative: false };
        case 'COMPLETED':
            return { label: 'Completed', tone: 'emerald', step: 5, negative: false };
        case 'PAYMENT_FAILED':
            return { label: 'Payment failed', tone: 'red', step: 1, negative: true };
        case 'EXPIRED':
            return { label: 'Order expired', tone: 'red', step: 1, negative: true };
        case 'CANCELLED':
            return { label: 'Cancelled', tone: 'red', step: 1, negative: true };
        case 'REFUNDED':
            return { label: 'Refunded', tone: 'slate', step: 1, negative: true };
        default:
            return { label: String(status || 'Order'), tone: 'slate', step: 0, negative: false };
    }
}

/**
 * Pure map from a real payment status to a diner-friendly label + tone. Sprint 2
 * orders are UNPAID (no payment wired yet); the rest are declared so the chip
 * already reflects the full lifecycle once payment lands. Never asserts "paid"
 * for an unpaid order.
 */
export function presentPaymentStatus(paymentStatus: QrPaymentStatus): { label: string; tone: StatusTone } {
    switch (paymentStatus) {
        case 'PAID':
            return { label: 'Paid', tone: 'emerald' };
        case 'AWAITING_PAYMENT':
            return { label: 'Awaiting payment', tone: 'amber' };
        case 'UNPAID':
            return { label: 'Not paid yet', tone: 'amber' };
        case 'FAILED':
            return { label: 'Payment failed', tone: 'red' };
        case 'EXPIRED':
            return { label: 'Payment expired', tone: 'red' };
        case 'REFUNDED':
            return { label: 'Refunded', tone: 'slate' };
        default:
            return { label: String(paymentStatus || 'Unknown'), tone: 'slate' };
    }
}
