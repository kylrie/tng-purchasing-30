// QR Ordering — Bar Queue MOCK DATA (Phase 1 UI prototype)
// Per docs/QR_SCREEN_SPEC.md §7: mock only — no Firestore listener, no Xendit,
// no Functions, no backend, no real order updates. Status changes live in
// local React state only.
//
// Bar queue shows DRINK lines only. When an order also contains food, the card
// carries a small "Food also in kitchen" note (`hasFoodInKitchen`) so bar staff
// know the kitchen is handling the rest of that table's order.

export type BarStatus = 'paid' | 'mixing' | 'ready';

export interface BarLine {
    name: string;
    qty: number;
    note?: string;
}

export interface BarOrder {
    id: string;
    orderNumber: string;
    tableNumber: string;
    status: BarStatus;
    /** Minutes since payment cleared (static in the prototype — no Date.now). */
    minutesSincePaid: number;
    /** Drink lines only — food lines route to the kitchen queue. */
    lines: BarLine[];
    /** True when the same order also has food being prepared in the kitchen. */
    hasFoodInKitchen: boolean;
}

/** Orders at/over this age (in the New/Mixing lanes) are flagged LATE. */
export const BAR_LATE_THRESHOLD_MIN = 15;

export const MOCK_BAR_ORDERS: BarOrder[] = [
    // ── New Drinks ──────────────────────────────────────────────────────
    {
        id: 'b-0071', orderNumber: 'QR-0071', tableNumber: '6', status: 'paid', minutesSincePaid: 2,
        hasFoodInKitchen: false,
        lines: [{ name: 'Classic Mojito', qty: 2 }, { name: 'San Miguel Pale Pilsen', qty: 1 }],
    },
    {
        id: 'b-0072', orderNumber: 'QR-0072', tableNumber: '10', status: 'paid', minutesSincePaid: 6,
        hasFoodInKitchen: true,
        lines: [{ name: 'Mango Rum Daiquiri', qty: 1, note: 'extra lime' }, { name: 'House Iced Tea', qty: 2 }],
    },
    {
        id: 'b-0073', orderNumber: 'QR-0073', tableNumber: '15', status: 'paid', minutesSincePaid: 16,
        hasFoodInKitchen: false,
        lines: [{ name: 'Beach Beer Bucket', qty: 1, note: '5 bottles, well iced' }],
    },

    // ── Mixing / Preparing ──────────────────────────────────────────────
    {
        id: 'b-0068', orderNumber: 'QR-0068', tableNumber: '4', status: 'mixing', minutesSincePaid: 9,
        hasFoodInKitchen: false,
        lines: [{ name: 'Mango Shake', qty: 2 }, { name: 'Barako Coffee', qty: 1, note: 'iced' }],
    },
    {
        id: 'b-0069', orderNumber: 'QR-0069', tableNumber: '8', status: 'mixing', minutesSincePaid: 18,
        hasFoodInKitchen: true,
        lines: [{ name: 'Classic Mojito', qty: 3, note: 'less sugar' }],
    },

    // ── Ready for Pickup ────────────────────────────────────────────────
    {
        id: 'b-0065', orderNumber: 'QR-0065', tableNumber: '1', status: 'ready', minutesSincePaid: 5,
        hasFoodInKitchen: false,
        lines: [{ name: 'Fresh Buko Juice', qty: 1 }],
    },
    {
        id: 'b-0066', orderNumber: 'QR-0066', tableNumber: '12', status: 'ready', minutesSincePaid: 3,
        hasFoodInKitchen: true,
        lines: [{ name: 'San Miguel Pale Pilsen', qty: 2 }, { name: 'Mango Shake', qty: 1 }],
    },
];
