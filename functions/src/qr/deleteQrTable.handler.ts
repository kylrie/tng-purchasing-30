/**
 * deleteQrTable — core handler (hard delete · admin)
 *
 * Permanently removes a QR table record so it disappears from table management
 * (listQrTables has no active-only filter, so a soft `isActive:false` would still
 * show as an "Inactive" row — a hard delete is what actually removes it). Paid
 * order HISTORY is unaffected: qr_orders carry their own denormalized
 * `tableNumber`/`businessUnitId` and are read directly, never joined to
 * qr_tables. Delete is BLOCKED when the table still has an active (paid,
 * in-progress) order or an active reservation. db injected for testing; the
 * onCall wrapper in deleteQrTable.ts passes the real `qrDb`.
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore } from 'firebase-admin/firestore';
import { requireStaffRole, callerCoversBU, QR_TABLE_ADMIN_ROLES } from './auth';

export interface DeleteQrTableInput {
    tableId?: string;
}

/**
 * Order statuses that mean a live, paid, in-progress table session. Deleting a
 * table while one of these is open would drop an active order off the floor, so
 * we block. Terminal states (COMPLETED/CANCELLED/EXPIRED/REFUNDED) and unpaid
 * states (AWAITING_PAYMENT/PAYMENT_FAILED) do NOT block a delete.
 */
const ACTIVE_ORDER_STATUSES = new Set(['PAID', 'IN_KITCHEN', 'IN_BAR', 'READY', 'SERVED']);

export async function deleteQrTableHandler(db: Firestore, request: CallableRequest<DeleteQrTableInput>) {
    // 1. RBAC — must be an authenticated admin (fails closed).
    const user = await requireStaffRole(db, request.auth?.uid, QR_TABLE_ADMIN_ROLES);

    // 2. Input validation.
    const tableIdRaw = request.data?.tableId;
    if (typeof tableIdRaw !== 'string' || tableIdRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'tableId is required');
    }
    const tableId = tableIdRaw.trim();

    // 3. Load the table (must exist).
    const tableRef = db.collection('qr_tables').doc(tableId);
    const snap = await tableRef.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'Table not found');
    }
    const table = snap.data() as { businessUnitId?: string };
    const businessUnitId = typeof table.businessUnitId === 'string' ? table.businessUnitId : '';

    // 4. BU scope — the caller must cover this table's business unit. Blocks a
    //    cross-BU delete (e.g. a b1 manager deleting a b3 table). Fails closed.
    if (!businessUnitId || !callerCoversBU(user, businessUnitId)) {
        throw new HttpsError('permission-denied', 'You cannot manage tables for this business unit');
    }

    // 5. Block delete when an active (paid, in-progress) order is on this table.
    const orderSnap = await db.collection('qr_orders').where('tableId', '==', tableId).get();
    const hasActiveOrder = orderSnap.docs.some(d => {
        const status = (d.data() as { status?: string }).status;
        return typeof status === 'string' && ACTIVE_ORDER_STATUSES.has(status);
    });
    if (hasActiveOrder) {
        throw new HttpsError('failed-precondition', 'This table has an active order. Complete or close it before deleting the table.');
    }

    // 6. Block delete when an active (BOOKED, not-yet-expired) reservation exists.
    const resSnap = await db
        .collection('qr_reservations')
        .where('tableId', '==', tableId)
        .where('status', '==', 'BOOKED')
        .get();
    const now = Date.now();
    const hasActiveReservation = resSnap.docs.some(d => {
        const r = d.data() as { reservationAtMillis?: number; holdMinutes?: number };
        const end = (r.reservationAtMillis ?? 0) + (r.holdMinutes ?? 0) * 60000;
        return end >= now;
    });
    if (hasActiveReservation) {
        throw new HttpsError('failed-precondition', 'This table has an active reservation. Cancel it before deleting the table.');
    }

    // 7. Hard delete — the qr_tables record only. Paid order history is separate.
    await tableRef.delete();
    return { tableId, deleted: true as const };
}
