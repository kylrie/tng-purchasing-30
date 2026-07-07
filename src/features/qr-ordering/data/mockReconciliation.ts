// QR Ordering — Cashier Reconciliation MOCK DATA (Phase 1 UI prototype)
// Per docs/QR_SCREEN_SPEC.md: mock only — no Firestore, no Xendit, no Functions,
// no backend, no real payment updates, no real invoice posting. Reconciliation
// state lives in local React state only.
//
// IMPORTANT BUSINESS RULE:
// TNG does NOT issue official BIR invoices. The official invoice is issued by
// the existing registered POS / invoicing system. This screen only STORES the
// invoice number issued there, for reconciliation.

export type ReconStatus = 'unreconciled' | 'reconciled';
export type PaymentMethod = 'GCash' | 'Maya' | 'QRPH' | 'Card';

export interface PaidOrder {
    id: string;
    orderNumber: string;
    tableNumber: string;
    paymentMethod: PaymentMethod;
    /** Mock Xendit payment reference (display only — no API call). */
    xenditRef: string;
    totalAmount: number;
    paidAtLabel: string;      // static display string (no Date.now in prototype)
    status: ReconStatus;
    /** Invoice number recorded from the registered POS (blank until entered). */
    invoiceNumber: string;
}

export const MOCK_PAID_ORDERS: PaidOrder[] = [
    { id: 'r-0051', orderNumber: 'QR-0051', tableNumber: '5', paymentMethod: 'GCash', xenditRef: 'xnd_pay_1a2b3c4d', totalAmount: 665, paidAtLabel: '7:12 PM', status: 'unreconciled', invoiceNumber: '' },
    { id: 'r-0052', orderNumber: 'QR-0052', tableNumber: '9', paymentMethod: 'Maya', xenditRef: 'xnd_pay_5e6f7g8h', totalAmount: 705, paidAtLabel: '7:18 PM', status: 'unreconciled', invoiceNumber: '' },
    { id: 'r-0053', orderNumber: 'QR-0053', tableNumber: '14', paymentMethod: 'QRPH', xenditRef: 'xnd_pay_9i0j1k2l', totalAmount: 1640, paidAtLabel: '7:24 PM', status: 'unreconciled', invoiceNumber: '' },
    { id: 'r-0048', orderNumber: 'QR-0048', tableNumber: '3', paymentMethod: 'Card', xenditRef: 'xnd_pay_3m4n5o6p', totalAmount: 780, paidAtLabel: '6:55 PM', status: 'reconciled', invoiceNumber: 'SI-100482' },
    { id: 'r-0049', orderNumber: 'QR-0049', tableNumber: '7', paymentMethod: 'GCash', xenditRef: 'xnd_pay_7q8r9s0t', totalAmount: 1150, paidAtLabel: '7:02 PM', status: 'reconciled', invoiceNumber: 'SI-100483' },
    { id: 'r-0045', orderNumber: 'QR-0045', tableNumber: '2', paymentMethod: 'Maya', xenditRef: 'xnd_pay_1u2v3w4x', totalAmount: 485, paidAtLabel: '6:40 PM', status: 'reconciled', invoiceNumber: 'SI-100480' },
    { id: 'r-0046', orderNumber: 'QR-0046', tableNumber: '11', paymentMethod: 'QRPH', xenditRef: 'xnd_pay_5y6z7a8b', totalAmount: 330, paidAtLabel: '6:48 PM', status: 'unreconciled', invoiceNumber: '' },
];
