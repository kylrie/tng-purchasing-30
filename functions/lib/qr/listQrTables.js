"use strict";
/**
 * listQrTables — Callable Cloud Function (Sprint 1 remediation · M3)
 *
 * Safe staff read path for the admin table-management UI. The `qr_tables` read
 * rule is now admin-only (so broad/PENDING staff cannot read raw docs and thus
 * cannot harvest `qrToken`s). This callable returns a token-OMITTING projection
 * so the management UI can still list tables without ever exposing the token
 * that gates the customer ordering surface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQrTables = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const auth_1 = require("./auth");
exports.listQrTables = (0, https_1.onCall)(async (request) => {
    await (0, auth_1.requireStaffRole)(firestore_1.qrDb, request.auth?.uid, auth_1.QR_TABLE_ADMIN_ROLES);
    const businessUnitId = request.data?.businessUnitId;
    if (typeof businessUnitId !== 'string' || businessUnitId.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'businessUnitId is required');
    }
    const snap = await firestore_1.qrDb
        .collection('qr_tables')
        .where('businessUnitId', '==', businessUnitId.trim())
        .get();
    // qrToken is intentionally NOT included in the projection.
    const tables = snap.docs.map(doc => {
        const t = doc.data();
        return { id: doc.id, tableNumber: t.tableNumber, isActive: t.isActive === true };
    });
    return { tables };
});
//# sourceMappingURL=listQrTables.js.map