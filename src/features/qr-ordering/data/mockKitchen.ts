// QR Ordering — Kitchen Queue MOCK DATA (Phase 1 UI prototype)
// Per docs/QR_SCREEN_SPEC.md: mock only — no Firestore listener, no Xendit,
// no Functions, no backend, no real order updates. Status changes live in
// local React state only.

export type KitchenStatus = 'paid' | 'preparing' | 'ready';

export interface KitchenLine {
    name: string;
    qty: number;
    note?: string;
}

export interface KitchenOrder {
    id: string;
    orderNumber: string;
    tableNumber: string;
    status: KitchenStatus;
    /** Minutes since payment cleared (static in the prototype — no Date.now). */
    minutesSincePaid: number;
    lines: KitchenLine[];
}

/** Orders at/over this age (in the Paid & Preparing lanes) are flagged LATE. */
export const LATE_THRESHOLD_MIN = 15;

export const MOCK_KITCHEN_ORDERS: KitchenOrder[] = [
    // ── New / Paid ──────────────────────────────────────────────────────
    {
        id: 'k-0051', orderNumber: 'QR-0051', tableNumber: '5', status: 'paid', minutesSincePaid: 3,
        lines: [{ name: 'Sisig', qty: 2, note: 'extra spicy' }, { name: 'House Iced Tea', qty: 1 }],
    },
    {
        id: 'k-0052', orderNumber: 'QR-0052', tableNumber: '9', status: 'paid', minutesSincePaid: 8,
        lines: [{ name: 'Lechon Kawali', qty: 1 }, { name: 'Calamares', qty: 2, note: 'dip on the side' }],
    },
    {
        id: 'k-0053', orderNumber: 'QR-0053', tableNumber: '14', status: 'paid', minutesSincePaid: 17,
        lines: [{ name: 'Seafood Boodle Feast', qty: 1 }, { name: 'San Miguel Pale Pilsen', qty: 4 }],
    },

    // ── Preparing ───────────────────────────────────────────────────────
    {
        id: 'k-0048', orderNumber: 'QR-0048', tableNumber: '3', status: 'preparing', minutesSincePaid: 11,
        lines: [{ name: 'Chicken Inasal', qty: 2 }, { name: 'Pancit Canton', qty: 1, note: 'no pork' }],
    },
    {
        id: 'k-0049', orderNumber: 'QR-0049', tableNumber: '7', status: 'preparing', minutesSincePaid: 19,
        lines: [{ name: 'Crispy Pata', qty: 1, note: 'well done' }, { name: 'Halo-Halo Supreme', qty: 2 }],
    },

    // ── Ready ───────────────────────────────────────────────────────────
    {
        id: 'k-0045', orderNumber: 'QR-0045', tableNumber: '2', status: 'ready', minutesSincePaid: 6,
        lines: [{ name: 'Mango Shake', qty: 1 }, { name: 'Turon à la Mode', qty: 2 }],
    },
    {
        id: 'k-0046', orderNumber: 'QR-0046', tableNumber: '11', status: 'ready', minutesSincePaid: 4,
        lines: [{ name: 'Barako Coffee', qty: 3 }],
    },
];
