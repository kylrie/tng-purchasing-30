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
    const bu = businessUnitId.trim();
    const snap = await db
        .collection('qr_tables')
        .where('businessUnitId', '==', bu)
        .get();
    // qrToken is intentionally NOT included in the projection (M3). The token is
    // fetched one table at a time via getQrTableToken, on explicit staff request.
    const tables = snap.docs.map(doc => {
        const t = doc.data();
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
//# sourceMappingURL=listQrTables.handler.js.map