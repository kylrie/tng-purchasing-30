// QR Ordering — pure Kitchen-board card mapping (firebase-free, unit-testable).
//
// Extracted from kitchenOrders.service.ts (which keeps the Firestore listener) so
// the food/drink split can be tested without dragging in the Firebase client init —
// same pattern as utils/isDrinkCategory.ts. No I/O, no React, no firebase imports.
//
// THE FIX: the kitchen board shows FOOD lines only. Drink lines route to the Bar
// board (see barCard.ts). Previously toKitchenCard emitted EVERY line, so on a
// venue whose drink categories aren't the fixed Inflatable Island subcategories
// (e.g. The Fun Roof's "Whiskey"/"Classics"/…), drinks appeared on the Kitchen
// board. Now a drinks-only order produces no kitchen card at all, and a mixed order
// shows only its food lines here (its drinks show on the bar).

import type { QrOrderStatus } from '../types/qrOrder.types';
import { isDrinkCategory } from '../utils/isDrinkCategory';

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
    /** FOOD lines only — drink lines route to the bar. */
    lines: KitchenCardLine[];
    /** True when the same order also has drinks being prepared at the bar. */
    hasDrinksAtBar: boolean;
}

/**
 * Map a real order status to a kitchen lane, or null if it should not appear on the
 * kitchen board. Pure + exported for testing.
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
export interface RawQrOrderDoc {
    id: string;
    orderNumber?: string;
    tableNumber?: string;
    tableId?: string;
    status?: string;
    items?: { productName?: string; quantity?: number; notes?: string; category?: string }[];
    createdAt?: { toMillis?: () => number };
}

/**
 * Map one order doc to a kitchen card, or null if it doesn't belong on the board
 * (non-kitchen status, or an order with no FOOD lines — a drinks-only order routes
 * entirely to the bar). `hasDrinksAtBar` is true when the order also carried drink
 * lines the bar is handling.
 */
export function toKitchenCard(doc: RawQrOrderDoc, now: number): KitchenCard | null {
    const lane = kitchenLaneFor(doc.status ?? '');
    if (!lane) return null;

    const items = Array.isArray(doc.items) ? doc.items : [];
    const foodItems = items.filter(it => !isDrinkCategory(typeof it.category === 'string' ? it.category : ''));
    if (foodItems.length === 0) return null; // kitchen shows only orders with food (drinks route to the bar)

    const createdAtMillis = doc.createdAt?.toMillis?.() ?? 0;
    const minutesSinceOrder = createdAtMillis ? Math.max(0, Math.floor((now - createdAtMillis) / 60000)) : 0;

    return {
        id: doc.id,
        orderNumber: typeof doc.orderNumber === 'string' ? doc.orderNumber : '',
        tableNumber: (typeof doc.tableNumber === 'string' && doc.tableNumber) || doc.tableId || '—',
        lane,
        minutesSinceOrder,
        createdAtMillis,
        lines: foodItems.map(it => {
            const line: KitchenCardLine = {
                name: typeof it.productName === 'string' ? it.productName : '',
                qty: Number(it.quantity ?? 0),
            };
            if (typeof it.notes === 'string' && it.notes) line.note = it.notes;
            return line;
        }),
        hasDrinksAtBar: items.length > foodItems.length,
    };
}
