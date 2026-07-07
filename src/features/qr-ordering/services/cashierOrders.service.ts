// QR Ordering — Cashier Reconciliation (Sprint 2 · Phase 3.5).
//
// Reads PAID/COMPLETED `qr_orders` live (BU-scoped onSnapshot — staff read is
// allowed by `belongsToSameBU`) and posts the registered-POS official invoice
// number back via the postOfficialInvoice callable (all writes are server-side;
// `qr_orders` is `write: if false`). TNG issues no BIR invoice (A4) — this only
// stores a number issued elsewhere. No Xendit, no POS sync.

import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { httpsCallable } from 'firebase/functions';
import type { Unsubscribe } from 'firebase/firestore';
import { getQrFunctions } from './qrFunctions';

/** Statuses that belong on the reconciliation board (money has cleared). */
const RECONCILABLE_STATUSES = new Set(['PAID', 'SERVED', 'COMPLETED']);

export interface CashierOrder {
    id: string;
    orderNumber: string;
    tableNumber: string;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    officialInvoiceNumber: string;
    postedBy: string;
    postedAtMillis: number;
    createdAtMillis: number;
    /** True once an official invoice number has been posted. */
    reconciled: boolean;
}

interface RawQrOrderDoc {
    id: string;
    orderNumber?: string;
    tableNumber?: string;
    tableId?: string;
    status?: string;
    paymentStatus?: string;
    totalAmount?: number;
    officialInvoiceNumber?: string;
    officialInvoicePostedBy?: string;
    officialInvoicePostedAt?: { toMillis?: () => number };
    createdAt?: { toMillis?: () => number };
}

/** Map an order doc to the cashier row, or null if it isn't paid/reconcilable. */
export function toCashierOrder(doc: RawQrOrderDoc): CashierOrder | null {
    const paymentStatus = typeof doc.paymentStatus === 'string' ? doc.paymentStatus : '';
    const status = typeof doc.status === 'string' ? doc.status : '';
    const isPaid = paymentStatus === 'PAID' || RECONCILABLE_STATUSES.has(status);
    if (!isPaid) return null; // cashier board shows paid/completed only

    const officialInvoiceNumber = typeof doc.officialInvoiceNumber === 'string' ? doc.officialInvoiceNumber : '';
    return {
        id: doc.id,
        orderNumber: typeof doc.orderNumber === 'string' ? doc.orderNumber : '',
        tableNumber: (typeof doc.tableNumber === 'string' && doc.tableNumber) || doc.tableId || '—',
        totalAmount: Number(doc.totalAmount ?? 0),
        status,
        paymentStatus,
        officialInvoiceNumber,
        postedBy: typeof doc.officialInvoicePostedBy === 'string' ? doc.officialInvoicePostedBy : '',
        postedAtMillis: doc.officialInvoicePostedAt?.toMillis?.() ?? 0,
        createdAtMillis: doc.createdAt?.toMillis?.() ?? 0,
        reconciled: officialInvoiceNumber.length > 0,
    };
}

/** Subscribe to the reconciliation board for one BU (oldest-first). Single-field
 *  equality query — no composite index required; status filtered client-side. */
export function subscribeCashierOrders(
    businessUnitId: string,
    onData: (orders: CashierOrder[]) => void,
    onError: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<RawQrOrderDoc>(
        'qr_orders',
        docs => {
            const orders = docs
                .map(toCashierOrder)
                .filter((o): o is CashierOrder => o !== null)
                .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
            onData(orders);
        },
        [where('businessUnitId', '==', businessUnitId)],
        onError,
    );
}

export interface PostOfficialInvoiceResult {
    orderId: string;
    officialInvoiceNumber: string;
    officialInvoicePostedBy: string;
}

/** Post the registered-POS invoice number onto a paid order (audit-stamped server-side). */
export async function postOfficialInvoice(orderId: string, officialInvoiceNumber: string): Promise<PostOfficialInvoiceResult> {
    const callable = httpsCallable<{ orderId: string; officialInvoiceNumber: string }, PostOfficialInvoiceResult>(
        getQrFunctions(),
        'postOfficialInvoice',
    );
    const { data } = await callable({ orderId, officialInvoiceNumber });
    return data;
}

/** Diner/staff-safe error message. Never surfaces internal codes/ids (L4). */
export function toUserFacingPostError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/permission-denied':
            return 'You don’t have permission to reconcile this order.';
        case 'functions/failed-precondition':
            return 'This order isn’t paid yet, so it can’t be reconciled.';
        case 'functions/not-found':
            return 'That order no longer exists.';
        case 'functions/invalid-argument':
            return 'Please enter a valid invoice number.';
        default:
            return 'Couldn’t save the invoice number. Please try again.';
    }
}
