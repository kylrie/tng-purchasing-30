/**
 * listQrTables — core handler (Sprint 1 · testability extraction · M3)
 *
 * Returns a token-OMITTING projection of a business unit's tables. db is
 * injected for testing; the onCall wrapper passes the real `qrDb`.
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore } from 'firebase-admin/firestore';
import { requireStaffRole, QR_TABLE_ADMIN_ROLES } from './auth';

export interface ListQrTablesInput {
    businessUnitId?: string;
}

export async function listQrTablesHandler(db: Firestore, request: CallableRequest<ListQrTablesInput>) {
    await requireStaffRole(db, request.auth?.uid, QR_TABLE_ADMIN_ROLES);

    const businessUnitId = request.data?.businessUnitId;
    if (typeof businessUnitId !== 'string' || businessUnitId.trim() === '') {
        throw new HttpsError('invalid-argument', 'businessUnitId is required');
    }

    const snap = await db
        .collection('qr_tables')
        .where('businessUnitId', '==', businessUnitId.trim())
        .get();

    // qrToken is intentionally NOT included in the projection.
    const tables = snap.docs.map(doc => {
        const t = doc.data() as { tableNumber: string; isActive: boolean };
        return { id: doc.id, tableNumber: t.tableNumber, isActive: t.isActive === true };
    });

    return { tables };
}
