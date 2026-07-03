/**
 * createQrTable — Callable Cloud Function (Sprint 1 · staff/admin)
 *
 * Creates a `qr_tables` document with a server-generated, cryptographically
 * random `qrToken` (never derived from the table number, plan §2.2 / §5).
 *
 * Sprint 1 remediation:
 *  - H1: RBAC — requires an ADMIN/SUPER_ADMIN caller (was: any signed-in user).
 *  - M5: validates the target business unit EXISTS, and rejects a duplicate
 *        active table number within that business unit.
 *  - M6: uses the centralized `qrDb` handle.
 *
 * BU-scope note: only ADMIN/SUPER_ADMIN may create tables, and those roles are
 * cross-business-unit by design in this app (see the `belongsToSameBU` rules
 * helper). The meaningful BU guard here is therefore existence of the target
 * BU (prevents orphan tables for a typo'd/non-existent business unit), not a
 * per-user BU-membership restriction the app does not impose on admins.
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { qrDb } from './firestore';
import { requireStaffRole, QR_TABLE_ADMIN_ROLES } from './auth';
import { encodeQrToken } from './orderLogic';

const TOKEN_BYTES = 18; // → 18 base62 chars, ~107 bits of entropy

interface CreateQrTableInput {
    businessUnitId?: string;
    tableNumber?: string;
}

export const createQrTable = onCall(async (request: CallableRequest<CreateQrTableInput>) => {
    // 1. RBAC — must be an authenticated admin (fails closed).
    await requireStaffRole(qrDb, request.auth?.uid, QR_TABLE_ADMIN_ROLES);

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
    const buSnap = await qrDb.collection('businesses').doc(businessUnitId).get();
    if (!buSnap.exists) {
        throw new HttpsError('not-found', `Business unit not found: ${businessUnitId}`);
    }

    // 4. Reject a duplicate ACTIVE table number within this business unit.
    const dupSnap = await qrDb
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
    const tableRef = qrDb.collection('qr_tables').doc();
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
});
