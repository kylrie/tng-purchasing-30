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

    const bu = businessUnitId.trim();
    const snap = await db
        .collection('qr_tables')
        .where('businessUnitId', '==', bu)
        .get();

    // qrToken is intentionally NOT included in the projection (M3). The token is
    // fetched one table at a time via getQrTableToken, on explicit staff request.
    const tables = snap.docs.map(doc => {
        const t = doc.data() as {
            tableNumber?: string;
            isActive?: boolean;
            businessUnitId?: string;
            createdAt?: { toMillis?: () => number };
        };
        return {
            id: doc.id,
            tableNumber: typeof t.tableNumber === 'string' ? t.tableNumber : '',
            isActive: t.isActive === true,
            businessUnitId: typeof t.businessUnitId === 'string' ? t.businessUnitId : bu,
            createdAtMillis: t.createdAt?.toMillis?.() ?? 0,
        };
    });

    // Stable, human-friendly order: by table number (numeric-aware).
    tables.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));

    return { tables };
}
