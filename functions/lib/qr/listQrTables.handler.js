"use strict";
/**
 * listQrTables — core handler (Sprint 1 · testability extraction · M3)
 *
 * Returns a token-OMITTING projection of a business unit's tables. db is
 * injected for testing; the onCall wrapper passes the real `qrDb`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQrTablesHandler = listQrTablesHandler;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./auth");
async function listQrTablesHandler(db, request) {
    await (0, auth_1.requireStaffRole)(db, request.auth?.uid, auth_1.QR_TABLE_ADMIN_ROLES);
    const businessUnitId = request.data?.businessUnitId;
    if (typeof businessUnitId !== 'string' || businessUnitId.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'businessUnitId is required');
    }
    const snap = await db
        .collection('qr_tables')
        .where('businessUnitId', '==', businessUnitId.trim())
        .get();
    // qrToken is intentionally NOT included in the projection.
    const tables = snap.docs.map(doc => {
        const t = doc.data();
        return { id: doc.id, tableNumber: t.tableNumber, isActive: t.isActive === true };
    });
    return { tables };
}
//# sourceMappingURL=listQrTables.handler.js.map