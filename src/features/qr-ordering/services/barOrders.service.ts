// QR Ordering — Bar Queue live read (Sprint 2 · real qr_orders listener).
//
// Same access model as the kitchen board: signed-in bar staff read `qr_orders`
// DIRECTLY via a BU-scoped onSnapshot (firestore.rules: `belongsToSameBU`).
// The bar shows DRINK lines only; when an order also has food, the card carries
// a "Food also in kitchen" flag. Writes are NOT done here (`qr_orders` is
// `write: if false`, no bar-transition callable yet) — the LIVE board is
// read-only (the demo board keeps its mock status buttons). No Xendit, no
// inventory deduction.
//
// Lifecycle rule: the bar only shows PAID work. AWAITING_PAYMENT orders are NOT
// surfaced (release only on paid — Master Plan A3); until Xendit lands, real
// orders sit at AWAITING_PAYMENT, so the live board is legitimately empty
// ("No paid bar orders yet.").

import { FirestoreService, where } from '../../../shared/services/firestore.service';
import type { Unsubscribe } from 'firebase/firestore';
import type { QrOrderStatus } from '../types/qrOrder.types';
import { isDrinkCategory } from '../utils/isDrinkCategory';

// Re-exported so existing importers (QrOpsView, kitchen/bar routing) keep working
// unchanged while the pure implementation lives in a firebase-free util.
export { isDrinkCategory };

/** The three bar lanes (matches the existing board columns). */
export type BarLane = 'paid' | 'mixing' | 'ready';

export interface BarCardLine {
    name: string;
    qty: number;
    note?: string;
}

/** A card rendered on the bar board — from either mock or real data. */
export interface BarCard {
    id: string;
    orderNumber: string;
    tableNumber: string;
    lane: BarLane;
    minutesSinceOrder: number;
    createdAtMillis: number;
    /** DRINK lines only — food lines route to the kitchen. */
    lines: BarCardLine[];
    /** True when the same order also has food being prepared in the kitchen. */
    hasFoodInKitchen: boolean;
}

/**
 * Map a real order status to a bar lane, or null if it should not appear on the
 * bar board. Pure + exported for testing.
 *
 * Only PAID work reaches the bar (Master Plan A3 — release only on paid):
 * PAID → New Drinks, IN_BAR → Mixing, READY → Ready. AWAITING_PAYMENT (unpaid)
 * and IN_KITCHEN (kitchen-owned) are deliberately excluded (return null).
 */
export function barLaneFor(status: QrOrderStatus | string): BarLane | null {
    switch (status) {
        case 'PAID':
            return 'paid';
        case 'IN_BAR':
            return 'mixing';
        case 'READY':
            return 'ready';
        default:
            // AWAITING_PAYMENT (not paid) / IN_KITCHEN (kitchen queue) / SERVED /
            // COMPLETED / CANCELLED / EXPIRED / … → not on the bar board.
            return null;
    }
}

interface RawQrOrderDoc {
    id: string;
    orderNumber?: string;
    tableNumber?: string;
    tableId?: string;
    status?: string;
    items?: { productName?: string; quantity?: number; notes?: string; category?: string }[];
    createdAt?: { toMillis?: () => number };
}

/**
 * Map one order doc to a bar card, or null if it has no drinks (or isn't an
 * active bar status). `hasFoodInKitchen` is true when the order also carried
 * non-drink lines that the kitchen is handling.
 */
export function toBarCard(doc: RawQrOrderDoc, now: number): BarCard | null {
    const lane = barLaneFor(doc.status ?? '');
    if (!lane) return null;

    const items = Array.isArray(doc.items) ? doc.items : [];
    const drinkItems = items.filter(it => isDrinkCategory(typeof it.category === 'string' ? it.category : ''));
    if (drinkItems.length === 0) return null; // bar shows only orders with drinks

    const createdAtMillis = doc.createdAt?.toMillis?.() ?? 0;
    const minutesSinceOrder = createdAtMillis ? Math.max(0, Math.floor((now - createdAtMillis) / 60000)) : 0;

    return {
        id: doc.id,
        orderNumber: typeof doc.orderNumber === 'string' ? doc.orderNumber : '',
        tableNumber: (typeof doc.tableNumber === 'string' && doc.tableNumber) || doc.tableId || '—',
        lane,
        minutesSinceOrder,
        createdAtMillis,
        lines: drinkItems.map(it => {
            const line: BarCardLine = {
                name: typeof it.productName === 'string' ? it.productName : '',
                qty: Number(it.quantity ?? 0),
            };
            if (typeof it.notes === 'string' && it.notes) line.note = it.notes;
            return line;
        }),
        hasFoodInKitchen: items.length > drinkItems.length,
    };
}

/**
 * Subscribe to the live bar board for one business unit. Returns the unsubscribe
 * fn. Cards arrive oldest-first (FIFO). Single-field equality query — no
 * composite index required; non-bar / no-drink orders are filtered client-side.
 */
export function subscribeBarOrders(
    businessUnitId: string,
    onData: (cards: BarCard[]) => void,
    onError: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<RawQrOrderDoc>(
        'qr_orders',
        docs => {
            const now = Date.now();
            const cards = docs
                .map(d => toBarCard(d, now))
                .filter((c): c is BarCard => c !== null)
                .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
            onData(cards);
        },
        [where('businessUnitId', '==', businessUnitId)],
        onError,
    );
}
