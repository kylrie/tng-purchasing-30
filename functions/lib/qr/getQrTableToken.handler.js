"use strict";
/**
 * getQrTableToken — core handler (Sprint 2 · admin table-management)
 *
 * Returns the qrToken for a SINGLE table, on explicit request by an authorized
 * admin. The list view never exposes tokens (M3); this is the one, RBAC-gated
 * path to reveal one — e.g. to print/show a table's QR. db is injected for
 * testing; the onCall wrapper passes the real `qrDb`. Read-only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQrTableTokenHandler = getQrTableTokenHandler;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./auth");
async function getQrTableTokenHandler(db, request) {
    // RBAC — admin only (SUPER_ADMIN/ADMIN are cross-BU by design, matching
    // createQrTable/listQrTables). Fails closed.
    await (0, auth_1.requireStaffRole)(db, request.auth?.uid, auth_1.QR_TABLE_ADMIN_ROLES);
    const tableId = request.data?.tableId;
    if (typeof tableId !== 'string' || tableId.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'tableId is required');
    }
    const snap = await db.collection('qr_tables').doc(tableId.trim()).get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Table not found');
    }
    const table = snap.data();
    return {
        tableId: snap.id,
        tableNumber: typeof table.tableNumber === 'string' ? table.tableNumber : '',
        qrToken: typeof table.qrToken === 'string' ? table.qrToken : '',
    };
}
//# sourceMappingURL=getQrTableToken.handler.js.map