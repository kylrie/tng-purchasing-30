// QR Ordering — Order Status MOCK DATA (Phase 1 UI prototype)
// Per docs/QR_SCREEN_SPEC.md §5: mock only — no Firebase listener, no Xendit,
// no backend. Shape loosely mirrors the future `qr_orders` doc projection.

export interface MockOrderLine {
    name: string;
    qty: number;
    unitPrice: number;
    note?: string;
}

export interface MockOrder {
    orderNumber: string;
    tableNumber: string;
    placedAtLabel: string;   // static display string (no Date.now in prototype)
    paidAtLabel: string;
    estPrepMinutes: number;
    lines: MockOrderLine[];
}

export const MOCK_ORDER: MockOrder = {
    orderNumber: 'QR-0042',
    tableNumber: '12',
    placedAtLabel: '7:38 PM',
    paidAtLabel: '7:41 PM',
    estPrepMinutes: 15,
    lines: [
        { name: 'Sizzling Pork Sisig', qty: 2, unitPrice: 285, note: 'no onions, extra spicy' },
        { name: 'Chicken Inasal', qty: 1, unitPrice: 260 },
        { name: 'Iced Tea (House Blend)', qty: 1, unitPrice: 95 },
    ],
};

export const mockOrderTotal = (order: MockOrder): number =>
    order.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
