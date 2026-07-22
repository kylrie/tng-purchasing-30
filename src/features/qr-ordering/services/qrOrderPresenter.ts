// QR Ordering — PURE presentation layer for the customer order-status screen.
//
// Extracted from getOrder.service so these deterministic maps can be unit-tested
// WITHOUT importing the Firebase app (getOrder.service pulls in config/firebase,
// which reads import.meta.env at load). Same pattern as qrPaymentsGate.ts. This
// file has NO side effects and imports only types.

import type { QrOrderStatus, QrPaymentStatus } from '../types/qrOrder.types';

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

/** Index of the "Payment confirmed" node in the 5-step timeline
 *  (received=0, payment=1, preparing=2, ready=3, served=4). */
export const PAYMENT_STEP_INDEX = 1;

export interface TimelinePresentation {
    /** Effective current step for the stepper — clamped so the payment node (and
     *  anything after it) can only light up once payment is authoritatively PAID. */
    currentStep: number;
    /** True ONLY when payment is authoritatively PAID — the single gate for the
     *  "Payment confirmed / Paid online" node. */
    paymentConfirmed: boolean;
}

/**
 * Decide the timeline presentation from BOTH the order status and the
 * authoritative payment status. The "Payment confirmed" node must never be shown
 * as completed/active unless `paymentStatus === 'PAID'` — so an order that is
 * AWAITING_PAYMENT / UNPAID (or any non-paid state) can never render as paid,
 * regardless of what the order status alone would imply.
 *
 * Truth source is payment state ONLY — never a route return marker, redirect
 * presence, order existence, or any client-side assumption.
 */
export function presentTimeline(
    status: QrOrderStatus,
    paymentStatus: QrPaymentStatus | string | undefined,
): TimelinePresentation {
    const raw = presentStatus(status).step;
    const paymentConfirmed = paymentStatus === 'PAID';
    // Not paid → the timeline can advance no further than the payment node itself:
    // "Order received" stays done, the payment node stays pending/awaiting (never
    // done), and nothing beyond it lights up.
    const currentStep = paymentConfirmed ? raw : Math.min(raw, PAYMENT_STEP_INDEX);
    return { currentStep, paymentConfirmed };
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
