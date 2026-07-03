/**
 * listQrTables — Callable Cloud Function (Sprint 1 remediation · M3)
 *
 * Safe staff read path for the admin table-management UI. The `qr_tables` read
 * rule is now admin-only (so broad/PENDING staff cannot read raw docs and thus
 * cannot harvest `qrToken`s). This callable returns a token-OMITTING projection
 * so the management UI can still list tables without ever exposing the token
 * that gates the customer ordering surface.
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { requireStaffRole, QR_TABLE_ADMIN_ROLES } from './auth';

interface ListQrTablesInput {
    businessUnitId?: string;
}

export const listQrTables = onCall(async (request: CallableRequest<ListQrTablesInput>) => {
    await requireStaffRole(qrDb, request.auth?.uid, QR_TABLE_ADMIN_ROLES);

    const businessUnitId = request.data?.businessUnitId;
    if (typeof businessUnitId !== 'string' || businessUnitId.trim() === '') {
        throw new HttpsError('invalid-argument', 'businessUnitId is required');
    }

    const snap = await qrDb
        .collection('qr_tables')
        .where('businessUnitId', '==', businessUnitId.trim())
        .get();

    // qrToken is intentionally NOT included in the projection.
    const tables = snap.docs.map(doc => {
        const t = doc.data() as { tableNumber: string; isActive: boolean };
        return { id: doc.id, tableNumber: t.tableNumber, isActive: t.isActive === true };
    });

    return { tables };
});
