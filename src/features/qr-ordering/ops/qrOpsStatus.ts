// QR Operations — the SINGLE source of the operational status/color vocabulary.
//
// Every ops view (Overview, Live Orders, Kitchen Board, Order Detail) imports its
// labels, colors, kitchen-lane mapping, attention thresholds, and sort priority
// from here so the same state always looks the same everywhere. Colors carry
// FUNCTIONAL meaning only (never decorative), per the operational spec:
//
//   GRAY   — no action yet / done-historical / inactive
//   AMBER  — waiting / pending / awaiting payment / attention-soon
//   BLUE   — accepted / confirmed / active-acknowledged
//   ORANGE — kitchen actively preparing
//   GREEN  — paid / ready / success
//   RED    — failed / cancelled / overdue / blocked / exception
//   PURPLE — manual intervention / refund / reversal
//
// High contrast, no gradients/glass. Chip = tinted fill + border; solid = header.

import type { QrOrderStatus, QrPaymentStatus } from '../types/qrOrder.types';

export type OpsColor = 'gray' | 'amber' | 'blue' | 'orange' | 'green' | 'red' | 'purple';

/** Tinted chip classes (labels, badges) — readable on white, strong border. */
export const CHIP_CLS: Record<OpsColor, string> = {
    gray: 'bg-slate-100 text-slate-700 border border-slate-300',
    amber: 'bg-amber-100 text-amber-900 border border-amber-400',
    blue: 'bg-blue-100 text-blue-900 border border-blue-400',
    orange: 'bg-orange-100 text-orange-900 border border-orange-400',
    green: 'bg-emerald-100 text-emerald-900 border border-emerald-500',
    red: 'bg-red-100 text-red-900 border border-red-500',
    purple: 'bg-purple-100 text-purple-900 border border-purple-400',
};

/** Solid fills (column headers, primary actions) — white text on saturated bg. */
export const SOLID_CLS: Record<OpsColor, string> = {
    gray: 'bg-slate-600 text-white',
    amber: 'bg-amber-500 text-white',
    blue: 'bg-blue-600 text-white',
    orange: 'bg-orange-500 text-white',
    green: 'bg-emerald-600 text-white',
    red: 'bg-red-600 text-white',
    purple: 'bg-purple-600 text-white',
};

/** Left-edge accent (dense rows) — a solid 4px bar reads faster than a tint. */
export const BAR_CLS: Record<OpsColor, string> = {
    gray: 'bg-slate-400',
    amber: 'bg-amber-500',
    blue: 'bg-blue-600',
    orange: 'bg-orange-500',
    green: 'bg-emerald-600',
    red: 'bg-red-600',
    purple: 'bg-purple-600',
};

export interface StatusPresentation {
    label: string;
    color: OpsColor;
}

/** Order (fulfillment) status → operational label + color. */
export function orderStatusPresentation(status: QrOrderStatus | string): StatusPresentation {
    switch (status) {
        case 'AWAITING_PAYMENT': return { label: 'Awaiting payment', color: 'amber' };
        case 'PAID': return { label: 'Paid · New', color: 'green' };   // paid work not yet accepted by kitchen
        case 'IN_KITCHEN': return { label: 'Preparing', color: 'orange' };
        case 'READY': return { label: 'Ready', color: 'green' };
        case 'SERVED': return { label: 'Served', color: 'blue' };
        case 'COMPLETED': return { label: 'Completed', color: 'gray' };
        case 'PAYMENT_FAILED': return { label: 'Payment failed', color: 'red' };
        case 'EXPIRED': return { label: 'Expired', color: 'red' };
        case 'CANCELLED': return { label: 'Cancelled', color: 'red' };
        case 'REFUNDED': return { label: 'Refunded', color: 'purple' };
        default: return { label: String(status || 'Unknown'), color: 'gray' };
    }
}

/** Payment status → operational label + color. */
export function paymentStatusPresentation(paymentStatus: QrPaymentStatus | string): StatusPresentation {
    switch (paymentStatus) {
        case 'PAID': return { label: 'Paid', color: 'green' };
        case 'AWAITING_PAYMENT': return { label: 'Awaiting payment', color: 'amber' };
        case 'UNPAID': return { label: 'Not paid', color: 'amber' };
        case 'FAILED': return { label: 'Payment failed', color: 'red' };
        case 'EXPIRED': return { label: 'Payment expired', color: 'red' };
        case 'REFUNDED': return { label: 'Refunded', color: 'purple' };
        default: return { label: String(paymentStatus || 'Unknown'), color: 'gray' };
    }
}

// ── Kitchen board lanes ──────────────────────────────────────────────────────
export type KitchenLane = 'new' | 'preparing' | 'ready' | 'served';

/**
 * Map an order status to a kitchen lane, or null if it does not belong on the
 * kitchen board. ONLY paid work reaches the kitchen — AWAITING_PAYMENT is
 * deliberately excluded (the board must never show unpaid work as actionable).
 */
export function kitchenLaneFor(status: QrOrderStatus | string): KitchenLane | null {
    switch (status) {
        case 'PAID': return 'new';
        case 'IN_KITCHEN': return 'preparing';
        case 'READY': return 'ready';
        case 'SERVED': return 'served';
        default: return null; // AWAITING_PAYMENT / COMPLETED / CANCELLED / … → not on the board
    }
}

// ── Attention / SLA thresholds (minutes) ─────────────────────────────────────
// Each threshold is the elapsed minutes AT WHICH the state becomes a problem.
export const THRESHOLDS = {
    awaitingPaymentWarn: 10,   // payment pending — nudge
    awaitingPaymentCritical: 20, // payment pending too long
    paidUnacceptedWarn: 5,     // paid but kitchen hasn't started
    paidUnacceptedCritical: 10,
    preparingCritical: 15,     // preparing too long
    readyCritical: 10,         // ready (uncollected) too long
} as const;

export type AttentionLevel = 'none' | 'warn' | 'critical';

export interface Attention {
    level: AttentionLevel;
    /** Short operational reason, shown on the card. Empty when level === 'none'. */
    reason: string;
}

/** Minimal order shape the attention rule needs. */
export interface AttentionOrder {
    status: QrOrderStatus | string;
    paymentStatus: QrPaymentStatus | string;
    minutesInStatus: number;
}

/**
 * Compute the attention state from real elapsed time + status. Terminal-negative
 * payment states are always critical (a failed/expired payment needs a human).
 * Never fabricates — driven entirely by the order's real status and elapsed time.
 */
export function attentionFor(o: AttentionOrder): Attention {
    const m = o.minutesInStatus;
    switch (o.status) {
        case 'PAYMENT_FAILED':
        case 'EXPIRED':
            return { level: 'critical', reason: 'Payment problem — needs attention' };
        case 'AWAITING_PAYMENT':
            if (o.paymentStatus === 'FAILED') return { level: 'critical', reason: 'Payment failed' };
            if (m >= THRESHOLDS.awaitingPaymentCritical) return { level: 'critical', reason: `Payment pending ${m} min` };
            if (m >= THRESHOLDS.awaitingPaymentWarn) return { level: 'warn', reason: `Payment pending ${m} min` };
            return { level: 'none', reason: '' };
        case 'PAID':
            if (m >= THRESHOLDS.paidUnacceptedCritical) return { level: 'critical', reason: `Paid, not started ${m} min` };
            if (m >= THRESHOLDS.paidUnacceptedWarn) return { level: 'warn', reason: `Paid, not started ${m} min` };
            return { level: 'none', reason: '' };
        case 'IN_KITCHEN':
            if (m >= THRESHOLDS.preparingCritical) return { level: 'critical', reason: `Preparing ${m} min` };
            return { level: 'none', reason: '' };
        case 'READY':
            if (m >= THRESHOLDS.readyCritical) return { level: 'critical', reason: `Ready, uncollected ${m} min` };
            return { level: 'none', reason: '' };
        default:
            return { level: 'none', reason: '' };
    }
}

/**
 * Sort priority for the Live Orders queue (lower = shown first). Encodes the
 * operational rule: problems first, then oldest waiting, then work-in-progress,
 * then awaiting payment, then completed history last.
 */
export function sortRank(status: QrOrderStatus | string, attention: AttentionLevel): number {
    if (attention === 'critical') return 0;
    switch (status) {
        case 'READY': return 1;        // ready to serve — time-sensitive
        case 'PAID': return 2;         // paid, waiting for the kitchen to accept
        case 'IN_KITCHEN': return 3;   // being prepared
        case 'AWAITING_PAYMENT': return 4;
        case 'SERVED': return 5;
        case 'COMPLETED':
        case 'CANCELLED':
        case 'REFUNDED':
        case 'EXPIRED':
        case 'PAYMENT_FAILED': return 6; // historical / closed
        default: return 5;
    }
}

/** True for statuses that are live/active operations (vs. closed history). */
export function isActiveStatus(status: QrOrderStatus | string): boolean {
    return status === 'AWAITING_PAYMENT' || status === 'PAID'
        || status === 'IN_KITCHEN' || status === 'READY' || status === 'SERVED';
}
