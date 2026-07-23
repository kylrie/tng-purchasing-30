/**
 * editQrTable — core handler (table rename · admin)
 *
 * Renames a QR table's display number/name in place. The `qrToken` and the doc
 * id (`tableId`) are NEVER touched, so the table's QR code / customer link stays
 * valid: getPublicMenu resolves a scan by `qrToken`, and createQrOrder keys on
 * `tableId` — neither depends on `tableNumber` (it is only denormalized onto new
 * orders for kitchen/bar display). The Firestore instance is injected so this
 * logic is unit-testable with a fake db; the onCall wrapper in editQrTable.ts
 * passes the real `qrDb`. Mirrors createQrTable.handler.ts (RBAC H1, dup check M5).
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { requireStaffRole, callerCoversBU, QR_TABLE_ADMIN_ROLES } from './auth';

export interface EditQrTableInput {
    tableId?: string;
    tableNumber?: string;
}

export async function editQrTableHandler(db: Firestore, request: CallableRequest<EditQrTableInput>) {
    // 1. RBAC — must be an authenticated admin (fails closed).
    const user = await requireStaffRole(db, request.auth?.uid, QR_TABLE_ADMIN_ROLES);

    // 2. Input validation.
    const tableIdRaw = request.data?.tableId;
    const tableNumberRaw = request.data?.tableNumber;
    if (typeof tableIdRaw !== 'string' || tableIdRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'tableId is required');
    }
    if (typeof tableNumberRaw !== 'string' || tableNumberRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'tableNumber is required');
    }
    const tableId = tableIdRaw.trim();
    const tableNumber = tableNumberRaw.trim();

    // 3. Load the table (must exist).
    const tableRef = db.collection('qr_tables').doc(tableId);
    const snap = await tableRef.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'Table not found');
    }
    const table = snap.data() as { businessUnitId?: string; tableNumber?: string };
    const businessUnitId = typeof table.businessUnitId === 'string' ? table.businessUnitId : '';

    // 4. BU scope — the caller must cover THIS table's business unit. This blocks
    //    a BU-scoped manager from editing another business unit's table (e.g. a
    //    Fun Roof/b1 manager touching an Inflatable Island/b3 table). Fails closed.
    if (!businessUnitId || !callerCoversBU(user, businessUnitId)) {
        throw new HttpsError('permission-denied', 'You cannot manage tables for this business unit');
    }

    // 5. No-op rename → success without a write.
    if (table.tableNumber === tableNumber) {
        return { tableId, tableNumber, businessUnitId };
    }

    // 6. Reject a duplicate ACTIVE table number within the same BU (excluding self).
    const dupSnap = await db
        .collection('qr_tables')
        .where('businessUnitId', '==', businessUnitId)
        .where('tableNumber', '==', tableNumber)
        .where('isActive', '==', true)
        .limit(2)
        .get();
    if (dupSnap.docs.some(d => d.id !== tableId)) {
        throw new HttpsError('already-exists', `An active table "${tableNumber}" already exists for this business unit`);
    }

    // 7. Rename in place — ONLY tableNumber + audit fields. qrToken / tableId are
    //    intentionally left untouched so the printed QR keeps working.
    await tableRef.update({
        tableNumber,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth!.uid,
    });

    return { tableId, tableNumber, businessUnitId };
}
