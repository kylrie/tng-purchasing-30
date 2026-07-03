"use strict";
/**
 * createQrTable — core handler (Sprint 1 · testability extraction)
 *
 * The Firestore instance is injected so this logic is unit/integration-testable
 * with a fake db (no emulator/Java required). The onCall wrapper in
 * createQrTable.ts passes the real `qrDb`. Behavior is identical to before the
 * extraction — see docs/QR_SPRINT1_REMEDIATION_PLAN.md (H1/M5).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQrTableHandler = createQrTableHandler;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
const auth_1 = require("./auth");
const orderLogic_1 = require("./orderLogic");
const TOKEN_BYTES = 18; // → 18 base62 chars, ~107 bits of entropy
async function createQrTableHandler(db, request) {
    // 1. RBAC — must be an authenticated admin (fails closed).
    await (0, auth_1.requireStaffRole)(db, request.auth?.uid, auth_1.QR_TABLE_ADMIN_ROLES);
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
    const buSnap = await db.collection('businesses').doc(businessUnitId).get();
    if (!buSnap.exists) {
        throw new https_1.HttpsError('not-found', `Business unit not found: ${businessUnitId}`);
    }
    // 4. Reject a duplicate ACTIVE table number within this business unit.
    const dupSnap = await db
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
    const tableRef = db.collection('qr_tables').doc();
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
}
//# sourceMappingURL=createQrTable.handler.js.map