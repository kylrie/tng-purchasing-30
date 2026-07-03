/**
 * createQrOrder — core handler (Sprint 1 · testability extraction)
 *
 * Writes a real `qr_orders` document with a server-authoritative order number
 * and server-authoritative pricing. The atomic counter increment + order write
 * happen inside a single runTransaction (Master Plan A10). db is injected for
 * testing; the onCall wrapper passes the real `qrDb`.
 *
 * Out of Sprint 1 scope: Xendit session creation, and the BOM-explosion stock
 * reservation (Phase 5 — see the TODO). No stock is read or deducted here.
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore, FieldValue, Transaction, DocumentReference } from 'firebase-admin/firestore';
import {
    validateCreateOrderInput, repriceLine, computeOrderTotals, formatOrderNumber,
    RawMenuItem, PricedLine,
} from './orderLogic';

const QR_COUNTER_ID = 'qr';       // counters/qr — reuses the CounterService doc shape
const QR_COUNTER_PREFIX = 'QR';

export async function createQrOrderHandler(db: Firestore, request: CallableRequest) {
    // 1. Shape validation (pure).
    let input;
    try {
        input = validateCreateOrderInput(request.data);
    } catch (e) {
        throw new HttpsError('invalid-argument', (e as Error).message);
    }

    const tableRef = db.collection('qr_tables').doc(input.tableId);
    const counterRef = db.collection('counters').doc(QR_COUNTER_ID);
    const menuRefs: DocumentReference[] = input.lines.map(l =>
        db.collection('menu_items').doc(l.menuItemId),
    );

    try {
        const result = await db.runTransaction(async (txn: Transaction) => {
            // ── All reads first (Firestore transaction requirement) ──────
            const tableSnap = await txn.get(tableRef);
            if (!tableSnap.exists) throw new HttpsError('not-found', 'Table not found');
            const table = tableSnap.data() as { businessUnitId: string; tableNumber: string; isActive: boolean };
            if (table.isActive !== true) {
                throw new HttpsError('failed-precondition', 'Table is not active');
            }

            const counterSnap = await txn.get(counterRef);
            const menuSnaps = await Promise.all(menuRefs.map(ref => txn.get(ref)));

            // ── Re-price every line from the SERVER's menu data ──────────
            const priced: PricedLine[] = input.lines.map((line, i) => {
                const snap = menuSnaps[i];
                const menuItem = snap.exists
                    ? ({ id: snap.id, ...(snap.data() as Omit<RawMenuItem, 'id'>) } as RawMenuItem)
                    : undefined;
                try {
                    return repriceLine(line, menuItem, table.businessUnitId);
                } catch (e) {
                    throw new HttpsError('failed-precondition', (e as Error).message);
                }
            });

            // TODO (Phase 5 — Inventory sprint, out of Sprint 1 scope):
            // transactional BOM-explosion stock reservation goes here, inside
            // this same transaction, before the write below. Sprint 1 does not
            // read or deduct inventory (task scope: "no inventory deduction").

            const totals = computeOrderTotals(priced);

            // ── Atomic order-number allocation (mirror CounterService) ───
            const currentValue = counterSnap.exists ? ((counterSnap.data() as { value?: number }).value ?? 0) : 0;
            const nextValue = currentValue + 1;
            const orderNumber = formatOrderNumber(nextValue, QR_COUNTER_PREFIX);

            // ── Writes ───────────────────────────────────────────────────
            if (counterSnap.exists) {
                txn.update(counterRef, { value: nextValue, lastUpdated: new Date().toISOString() });
            } else {
                txn.set(counterRef, { value: nextValue, prefix: QR_COUNTER_PREFIX, lastUpdated: new Date().toISOString() });
            }

            const orderRef = db.collection('qr_orders').doc();
            const orderDoc: Record<string, unknown> = {
                id: orderRef.id,
                businessUnitId: table.businessUnitId,
                tableId: input.tableId,
                orderNumber,
                items: priced,
                orderType: 'DINE_IN',
                subtotal: totals.subtotal,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
                currency: 'PHP',
                status: 'AWAITING_PAYMENT',
                paymentStatus: 'UNPAID',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };
            if (input.customerName) orderDoc.customerName = input.customerName;

            txn.set(orderRef, orderDoc);

            return { orderId: orderRef.id, orderNumber, totalAmount: totals.totalAmount };
        });

        return {
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            totalAmount: result.totalAmount,
            currency: 'PHP' as const,
            status: 'AWAITING_PAYMENT' as const,
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error('createQrOrder error:', error);
        throw new HttpsError('internal', 'Failed to create order');
    }
}
