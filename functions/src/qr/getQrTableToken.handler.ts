/**
 * getQrTableToken — core handler (Sprint 2 · admin table-management)
 *
 * Returns the qrToken for a SINGLE table, on explicit request by an authorized
 * admin. The list view never exposes tokens (M3); this is the one, RBAC-gated
 * path to reveal one — e.g. to print/show a table's QR. db is injected for
 * testing; the onCall wrapper passes the real `qrDb`. Read-only.
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore } from 'firebase-admin/firestore';
import { requireStaffRole, QR_TABLE_ADMIN_ROLES } from './auth';

export interface GetQrTableTokenInput {
    tableId?: string;
}

export async function getQrTableTokenHandler(db: Firestore, request: CallableRequest<GetQrTableTokenInput>) {
    // RBAC — admin only (SUPER_ADMIN/ADMIN are cross-BU by design, matching
    // createQrTable/listQrTables). Fails closed.
    await requireStaffRole(db, request.auth?.uid, QR_TABLE_ADMIN_ROLES);

    const tableId = request.data?.tableId;
    if (typeof tableId !== 'string' || tableId.trim() === '') {
        throw new HttpsError('invalid-argument', 'tableId is required');
    }

    const snap = await db.collection('qr_tables').doc(tableId.trim()).get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'Table not found');
    }
    const table = snap.data() as { tableNumber?: string; qrToken?: string };

    return {
        tableId: snap.id,
        tableNumber: typeof table.tableNumber === 'string' ? table.tableNumber : '',
        qrToken: typeof table.qrToken === 'string' ? table.qrToken : '',
    };
}
