/**
 * createQrTable — core handler (Sprint 1 · testability extraction)
 *
 * The Firestore instance is injected so this logic is unit/integration-testable
 * with a fake db (no emulator/Java required). The onCall wrapper in
 * createQrTable.ts passes the real `qrDb`. Behavior is identical to before the
 * extraction — see docs/QR_SPRINT1_REMEDIATION_PLAN.md (H1/M5).
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { requireStaffRole, QR_TABLE_ADMIN_ROLES } from './auth';
import { encodeQrToken } from './orderLogic';

const TOKEN_BYTES = 18; // → 18 base62 chars, ~107 bits of entropy

export interface CreateQrTableInput {
    businessUnitId?: string;
    tableNumber?: string;
}

export async function createQrTableHandler(db: Firestore, request: CallableRequest<CreateQrTableInput>) {
    // 1. RBAC — must be an authenticated admin (fails closed).
    await requireStaffRole(db, request.auth?.uid, QR_TABLE_ADMIN_ROLES);

    // 2. Input validation.
    const businessUnitIdRaw = request.data?.businessUnitId;
    const tableNumberRaw = request.data?.tableNumber;
    if (typeof businessUnitIdRaw !== 'string' || businessUnitIdRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'businessUnitId is required');
    }
    if (typeof tableNumberRaw !== 'string' || tableNumberRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'tableNumber is required');
    }
    const businessUnitId = businessUnitIdRaw.trim();
    const tableNumber = tableNumberRaw.trim();

    // 3. BU must exist (prevents orphan tables for a non-existent business unit).
    const buSnap = await db.collection('businesses').doc(businessUnitId).get();
    if (!buSnap.exists) {
        throw new HttpsError('not-found', `Business unit not found: ${businessUnitId}`);
    }

    // 4. Reject a duplicate ACTIVE table number within this business unit.
    const dupSnap = await db
        .collection('qr_tables')
        .where('businessUnitId', '==', businessUnitId)
        .where('tableNumber', '==', tableNumber)
        .where('isActive', '==', true)
        .limit(1)
        .get();
    if (!dupSnap.empty) {
        throw new HttpsError('already-exists', `An active table "${tableNumber}" already exists for this business unit`);
    }

    // 5. Mint token server-side + write.
    const qrToken = encodeQrToken(randomBytes(TOKEN_BYTES));
    const tableRef = db.collection('qr_tables').doc();
    await tableRef.set({
        id: tableRef.id,
        businessUnitId,
        tableNumber,
        qrToken,
        isActive: true,
        createdBy: request.auth!.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    return { tableId: tableRef.id, tableNumber, qrToken };
}
