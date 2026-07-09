"use strict";
/**
 * QR Ordering — print-control callables (QR Operations · automatic printing).
 *
 * Two staff-only actions that must be server-mediated because `qr_print_jobs` and
 * `qr_print_config` are `write: if false` for clients:
 *
 *   setAutoPrint  — turn the location's AUTO-PRINT on/off (a per-BU config the
 *                   local Print Bridge honors: when OFF it stops auto-printing and
 *                   jobs simply wait as PENDING for a manual print).
 *   retryPrintJob — re-queue a FAILED print job (FAILED → PENDING) so the bridge
 *                   re-attempts it. This is RETRY (re-run the SAME initial job),
 *                   never a duplicate: a PRINTED job cannot be retried here (a
 *                   deliberate extra copy is a manual REPRINT instead).
 *
 * db is injected for testing; the onCall wrappers pass the real qrDb.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAutoPrintHandler = setAutoPrintHandler;
exports.retryPrintJobHandler = retryPrintJobHandler;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("./auth");
const PRINT_JOBS_COLLECTION = 'qr_print_jobs';
const PRINT_CONFIG_COLLECTION = 'qr_print_config';
/** Whether the caller may act on this business unit (mirrors updateQrOrderStatus). */
function callerCoversBU(user, businessUnitId) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')
        return true; // cross-BU by design
    if (user.businessId && user.businessId === businessUnitId)
        return true;
    if (Array.isArray(user.businessUnitIds) && user.businessUnitIds.includes(businessUnitId))
        return true;
    return false;
}
async function setAutoPrintHandler(db, request) {
    const user = await (0, auth_1.requireStaffRole)(db, request.auth?.uid, auth_1.QR_OPS_ROLES);
    const uid = request.auth.uid;
    const buRaw = request.data?.businessUnitId;
    if (typeof buRaw !== 'string' || buRaw.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'businessUnitId is required');
    }
    if (typeof request.data?.enabled !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'enabled must be a boolean');
    }
    const businessUnitId = buRaw.trim();
    if (!callerCoversBU(user, businessUnitId)) {
        throw new https_1.HttpsError('permission-denied', 'That business unit belongs to another location');
    }
    await db.collection(PRINT_CONFIG_COLLECTION).doc(businessUnitId).set({
        businessUnitId,
        autoPrint: request.data.enabled,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: uid,
    }, { merge: true });
    return { businessUnitId, autoPrint: request.data.enabled };
}
async function retryPrintJobHandler(db, request) {
    const user = await (0, auth_1.requireStaffRole)(db, request.auth?.uid, auth_1.QR_OPS_ROLES);
    const jobIdRaw = request.data?.jobId;
    if (typeof jobIdRaw !== 'string' || jobIdRaw.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'jobId is required');
    }
    const jobId = jobIdRaw.trim();
    const ref = db.collection(PRINT_JOBS_COLLECTION).doc(jobId);
    return db.runTransaction(async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Print job not found');
        const job = snap.data();
        const bu = typeof job.businessUnitId === 'string' ? job.businessUnitId : '';
        if (!callerCoversBU(user, bu)) {
            throw new https_1.HttpsError('permission-denied', 'That print job belongs to another business unit');
        }
        const status = typeof job.status === 'string' ? job.status : '';
        // Already queued / in progress → idempotent no-op (safe double-tap).
        if (status === 'PENDING' || status === 'PRINTING') {
            return { jobId, status, requeued: false };
        }
        // Only a FAILED job may be re-queued. A PRINTED job is NEVER retried here
        // (that would risk a duplicate ticket — use a manual REPRINT for an extra copy).
        if (status !== 'FAILED') {
            throw new https_1.HttpsError('failed-precondition', `Cannot retry a ${status || '(unknown)'} job`);
        }
        txn.update(ref, {
            status: 'PENDING',
            lastError: null,
            requeuedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { jobId, status: 'PENDING', requeued: true };
    });
}
//# sourceMappingURL=printControl.handler.js.map