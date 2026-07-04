// QR Ordering — Kitchen Queue live read (Sprint 2 · real qr_orders listener).
//
// Staff-facing: kitchen users are signed-in, so they read `qr_orders` DIRECTLY
// via a BU-scoped onSnapshot (firestore.rules: `allow read: belongsToSameBU`).
// The query is scoped to a single businessUnitId so the rule is satisfied for
// every returned doc. Writes are NOT done here — `qr_orders` is `write: if false`
// and there is no kitchen-transition callable yet, so the LIVE board is read-only
// (the demo board keeps its mock status buttons). No Xendit, no inventory deduction.
//
// Lifecycle rule: the kitchen only ever shows PAID work. AWAITING_PAYMENT orders
// are NOT surfaced (kitchen releases only on paid — Master Plan A3); until Xendit
// lands, real orders sit at AWAITING_PAYMENT, so the live board is legitimately
// empty ("No paid kitchen orders yet.").

import { FirestoreService, where } from '../../../shared/services/firestore.service';
import type { Unsubscribe } from 'firebase/firestore';
import type { QrOrderStatus } from '../types/qrOrder.types';

/** The three kitchen lanes (matches the existing board columns). */
export type KitchenLane = 'paid' | 'preparing' | 'ready';

export interface KitchenCardLine {
    name: string;
    qty: number;
    note?: string;
}

/** A card rendered on the kitchen board — from either mock or real data. */
export interface KitchenCard {
    id: string;
    orderNumber: string;
    tableNumber: string;
    /** Lane derived from the real status (before any local override). */
    lane: KitchenLane;
    minutesSinceOrder: number;
    createdAtMillis: number;
    lines: KitchenCardLine[];
}

/**
 * Map a real order status to a kitchen lane, or null if it should not appear on
 * the kitchen board. Pure + exported for testing.
 *
 * Only PAID work reaches the kitchen (Master Plan A3 — release only on paid):
 * PAID → New, IN_KITCHEN → Preparing, READY → Ready. AWAITING_PAYMENT is
 * deliberately excluded (returns null), so an unpaid order never shows here.
 */
export function kitchenLaneFor(status: QrOrderStatus | string): KitchenLane | null {
    switch (status) {
        case 'PAID':
            return 'paid';
        case 'IN_KITCHEN':
            return 'preparing';
        case 'READY':
            return 'ready';
        default:
            // AWAITING_PAYMENT (not paid) / IN_BAR (bar queue) / SERVED / COMPLETED
            // / CANCELLED / EXPIRED / … → not on the kitchen board.
            return null;
    }
}

/** Raw shape we read off a qr_orders document (only the fields the board uses). */
interface RawQrOrderDoc {
    id: string;
    orderNumber?: string;
    tableNumber?: string;
    tableId?: string;
    status?: string;
    items?: { productName?: string; quantity?: number; notes?: string }[];
    createdAt?: { toMillis?: () => number };
}

/** Map one order doc to a kitchen card, or null if it doesn't belong on the board. */
export function toKitchenCard(doc: RawQrOrderDoc, now: number): KitchenCard | null {
    const lane = kitchenLaneFor(doc.status ?? '');
    if (!lane) return null;

    const createdAtMillis = doc.createdAt?.toMillis?.() ?? 0;
    const minutesSinceOrder = createdAtMillis ? Math.max(0, Math.floor((now - createdAtMillis) / 60000)) : 0;

    return {
        id: doc.id,
        orderNumber: typeof doc.orderNumber === 'string' ? doc.orderNumber : '',
        tableNumber: (typeof doc.tableNumber === 'string' && doc.tableNumber) || doc.tableId || '—',
        lane,
        minutesSinceOrder,
        createdAtMillis,
        lines: Array.isArray(doc.items)
            ? doc.items.map(it => {
                const line: KitchenCardLine = {
                    name: typeof it.productName === 'string' ? it.productName : '',
                    qty: Number(it.quantity ?? 0),
                };
                if (typeof it.notes === 'string' && it.notes) line.note = it.notes;
                return line;
            })
            : [],
    };
}

/**
 * Subscribe to the live kitchen board for one business unit. Returns the
 * unsubscribe fn. Cards arrive oldest-first (FIFO — the order the kitchen should
 * work them). Non-kitchen statuses are filtered out client-side (no composite
 * index needed — the query is a single-field equality on businessUnitId).
 */
export function subscribeKitchenOrders(
    businessUnitId: string,
    onData: (cards: KitchenCard[]) => void,
    onError: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<RawQrOrderDoc>(
        'qr_orders',
        docs => {
            const now = Date.now();
            const cards = docs
                .map(d => toKitchenCard(d, now))
                .filter((c): c is KitchenCard => c !== null)
                .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
            onData(cards);
        },
        [where('businessUnitId', '==', businessUnitId)],
        onError,
    );
}
