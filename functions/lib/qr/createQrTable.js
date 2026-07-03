"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQrTable = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
const firestore_2 = require("./firestore");
const auth_1 = require("./auth");
const orderLogic_1 = require("./orderLogic");
const TOKEN_BYTES = 18; // → 18 base62 chars, ~107 bits of entropy
exports.createQrTable = (0, https_1.onCall)(async (request) => {
    // 1. RBAC — must be an authenticated admin (fails closed).
    await (0, auth_1.requireStaffRole)(firestore_2.qrDb, request.auth?.uid, auth_1.QR_TABLE_ADMIN_ROLES);
    // 2. Input validation.
    const businessUnitIdRaw = request.data?.businessUnitId;
    const tableNumberRaw = request.data?.tableNumber;
    if (typeof businessUnitIdRaw !== 'string' || businessUnitIdRaw.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'businessUnitId is required');
    }
    if (typeof tableNumberRaw !== 'string' || tableNumberRaw.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'tableNumber is required');
    }
    const businessUnitId = businessUnitIdRaw.trim();
    const tableNumber = tableNumberRaw.trim();
    // 3. BU must exist (prevents orphan tables for a non-existent business unit).
    const buSnap = await firestore_2.qrDb.collection('businesses').doc(businessUnitId).get();
    if (!buSnap.exists) {
        throw new https_1.HttpsError('not-found', `Business unit not found: ${businessUnitId}`);
    }
    // 4. Reject a duplicate ACTIVE table number within this business unit.
    const dupSnap = await firestore_2.qrDb
        .collection('qr_tables')
        .where('businessUnitId', '==', businessUnitId)
        .where('tableNumber', '==', tableNumber)
        .where('isActive', '==', true)
        .limit(1)
        .get();
    if (!dupSnap.empty) {
        throw new https_1.HttpsError('already-exists', `An active table "${tableNumber}" already exists for this business unit`);
    }
    // 5. Mint token server-side + write.
    const qrToken = (0, orderLogic_1.encodeQrToken)((0, crypto_1.randomBytes)(TOKEN_BYTES));
    const tableRef = firestore_2.qrDb.collection('qr_tables').doc();
    await tableRef.set({
        id: tableRef.id,
        businessUnitId,
        tableNumber,
        qrToken,
        isActive: true,
        createdBy: request.auth.uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { tableId: tableRef.id, tableNumber, qrToken };
});
//# sourceMappingURL=createQrTable.js.map