// QR Operations — live nav badge counts, derived from the shared qr_orders feed.
//
// Extracted so BOTH the QR Operations dashboard AND the unified POS operations
// shell compute the SAME badge counts from the SAME rules (no duplicated logic).
// Pure + deterministic → unit-testable.

import type { OpsOrder } from '../services/qrOrders.service';
import { isActiveStatus, kitchenLaneFor, attentionFor } from './qrOpsStatus';
import { isDrinkCategory } from '../utils/isDrinkCategory';

export interface OpsNavCounts {
    awaiting: number;   // AWAITING_PAYMENT (the "needs a human" alert)
    live: number;       // active/live orders
    kitchen: number;    // kitchen-lane orders that have ≥1 food line
    bar: number;        // kitchen-lane orders that have ≥1 drink line
    attention: number;  // orders whose attention level is warn/critical
}

/** Elapsed minutes in the current status (mirrors OpsShared.minutesSince). */
function minutesInStatus(statusEnteredAtMillis: number, now: number): number {
    return statusEnteredAtMillis ? Math.max(0, Math.floor((now - statusEnteredAtMillis) / 60000)) : 0;
}

/**
 * Compute the operational nav badge counts. Mirrors the QR Operations dashboard's
 * rules exactly: kitchen/bar count orders that are on a kitchen lane AND carry a
 * food / drink line respectively; attention uses the shared time-based rule.
 */
export function opsNavCounts(orders: OpsOrder[], now: number): OpsNavCounts {
    let awaiting = 0, live = 0, kitchen = 0, bar = 0, attention = 0;
    for (const o of orders) {
        if (o.status === 'AWAITING_PAYMENT') awaiting++;
        if (isActiveStatus(o.status)) live++;
        if (kitchenLaneFor(o.status)) {
            if (o.items.some(l => !isDrinkCategory(l.category))) kitchen++;
            if (o.items.some(l => isDrinkCategory(l.category))) bar++;
        }
        const att = attentionFor({
            status: o.status,
            paymentStatus: o.paymentStatus,
            minutesInStatus: minutesInStatus(o.statusEnteredAtMillis, now),
        });
        if (att.level !== 'none') attention++;
    }
    return { awaiting, live, kitchen, bar, attention };
}
