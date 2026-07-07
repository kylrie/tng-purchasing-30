// QR Operations — live orders subscription (staff, BU-scoped onSnapshot).
//
// Staff are signed-in, so they read `qr_orders` DIRECTLY via a BU-scoped
// onSnapshot (firestore.rules: `allow read: belongsToSameBU`). The query is a
// single-field equality on businessUnitId (no composite index needed); all
// derivation (status entry time, item lines) happens client-side. This is the
// ONE live feed shared by every ops tab (Overview / Live Orders / Kitchen /
// Detail) so the whole dashboard reflects the same snapshot.
//
// Reads only — writes go through the updateQrOrderStatus callable (`qr_orders`
// is `write: if false`). No Xendit, no inventory.

import { FirestoreService, where } from '../../../shared/services/firestore.service';
import type { Unsubscribe } from 'firebase/firestore';
import type { QrOrderStatus, QrPaymentStatus } from '../types/qrOrder.types';

export interface OpsOrderLine {
    name: string;
    qty: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    category: string;
}

export interface OpsStatusEvent {
    status: string;
    atMillis: number | null;
    by?: string;
    role?: string;
}

/** The operations view of a qr_order — full staff-visible shape (unlike the
 *  sanitized customer projection, this keeps payment refs + timestamps). */
export interface OpsOrder {
    id: string;
    orderNumber: string;
    tableNumber: string;
    businessUnitId: string;

    status: QrOrderStatus | string;
    paymentStatus: QrPaymentStatus | string;

    items: OpsOrderLine[];
    itemCount: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    customerName?: string;

    createdAtMillis: number;
    updatedAtMillis: number;
    paidAtMillis: number | null;
    releasedAtMillis: number | null;
    /** When the order ENTERED its current status — drives "time in status". */
    statusEnteredAtMillis: number;

    // Payment trace (ops-only visibility)
    paymentReference?: string;
    xenditPaymentSessionId?: string;
    paymentAttempt?: number;
    released?: boolean;

    /** Append-only kitchen transition audit (from updateQrOrderStatus). */
    statusHistory: OpsStatusEvent[];
}

interface RawTimestamp { toMillis?: () => number; }
interface RawHistoryEntry { status?: string; at?: string; by?: string; role?: string; }
interface RawQrOrderDoc {
    id: string;
    orderNumber?: string;
    tableNumber?: string;
    tableId?: string;
    businessUnitId?: string;
    status?: string;
    paymentStatus?: string;
    items?: { productName?: string; quantity?: number; unitPrice?: number; subtotal?: number; notes?: string; category?: string }[];
    subtotal?: number;
    taxAmount?: number;
    totalAmount?: number;
    currency?: string;
    customerName?: string;
    createdAt?: RawTimestamp;
    updatedAt?: RawTimestamp;
    paidAt?: RawTimestamp;
    releasedAt?: RawTimestamp;
    paymentReference?: string;
    xenditPaymentSessionId?: string;
    paymentAttempt?: number;
    released?: boolean;
    statusHistory?: RawHistoryEntry[];
}

function millis(ts: RawTimestamp | undefined): number | null {
    const v = ts?.toMillis?.();
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function parseIso(s: string | undefined): number | null {
    if (typeof s !== 'string') return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
}

/** When did the order enter its CURRENT status? Real timestamps only. */
function statusEnteredAt(doc: RawQrOrderDoc, createdAtMillis: number, history: OpsStatusEvent[]): number {
    const status = doc.status ?? '';
    if (status === 'AWAITING_PAYMENT') return createdAtMillis;
    if (status === 'PAID') return millis(doc.paidAt) ?? createdAtMillis;
    // Kitchen states are stamped by the transition callable's statusHistory.
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].status === status && history[i].atMillis !== null) return history[i].atMillis as number;
    }
    return millis(doc.updatedAt) ?? createdAtMillis;
}

/** Map one raw qr_orders doc to the ops shape. Pure + exported for testing. */
export function toOpsOrder(doc: RawQrOrderDoc): OpsOrder {
    const createdAtMillis = millis(doc.createdAt) ?? 0;
    const history: OpsStatusEvent[] = Array.isArray(doc.statusHistory)
        ? doc.statusHistory.map(h => ({
            status: typeof h.status === 'string' ? h.status : '',
            atMillis: parseIso(h.at),
            by: h.by,
            role: h.role,
        }))
        : [];
    const items: OpsOrderLine[] = Array.isArray(doc.items)
        ? doc.items.map(it => ({
            name: typeof it.productName === 'string' ? it.productName : '',
            qty: Number(it.quantity ?? 0),
            unitPrice: Number(it.unitPrice ?? 0),
            subtotal: Number(it.subtotal ?? 0),
            notes: typeof it.notes === 'string' && it.notes ? it.notes : undefined,
            category: typeof it.category === 'string' ? it.category : '',
        }))
        : [];

    return {
        id: doc.id,
        orderNumber: typeof doc.orderNumber === 'string' ? doc.orderNumber : '',
        tableNumber: (typeof doc.tableNumber === 'string' && doc.tableNumber) || doc.tableId || '—',
        businessUnitId: typeof doc.businessUnitId === 'string' ? doc.businessUnitId : '',
        status: doc.status ?? '',
        paymentStatus: doc.paymentStatus ?? '',
        items,
        itemCount: items.reduce((n, l) => n + l.qty, 0),
        subtotal: Number(doc.subtotal ?? 0),
        taxAmount: Number(doc.taxAmount ?? 0),
        totalAmount: Number(doc.totalAmount ?? 0),
        currency: typeof doc.currency === 'string' ? doc.currency : 'PHP',
        customerName: typeof doc.customerName === 'string' && doc.customerName ? doc.customerName : undefined,
        createdAtMillis,
        updatedAtMillis: millis(doc.updatedAt) ?? createdAtMillis,
        paidAtMillis: millis(doc.paidAt),
        releasedAtMillis: millis(doc.releasedAt),
        statusEnteredAtMillis: statusEnteredAt(doc, createdAtMillis, history),
        paymentReference: typeof doc.paymentReference === 'string' ? doc.paymentReference : undefined,
        xenditPaymentSessionId: typeof doc.xenditPaymentSessionId === 'string' ? doc.xenditPaymentSessionId : undefined,
        paymentAttempt: typeof doc.paymentAttempt === 'number' ? doc.paymentAttempt : undefined,
        released: doc.released === true,
        statusHistory: history,
    };
}

/**
 * Subscribe to ALL of a business unit's QR orders (live). Unlike the kitchen
 * feed, this includes AWAITING_PAYMENT (operationally important). Returns the
 * unsubscribe fn. Sorting/filtering is left to the views (they own the ops rules).
 */
export function subscribeQrOrders(
    businessUnitId: string,
    onData: (orders: OpsOrder[]) => void,
    onError: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<RawQrOrderDoc>(
        'qr_orders',
        docs => onData(docs.map(toOpsOrder)),
        [where('businessUnitId', '==', businessUnitId)],
        onError,
    );
}
