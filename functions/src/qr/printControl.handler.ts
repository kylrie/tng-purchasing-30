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

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { requireStaffRole, QR_OPS_ROLES, StaffUser } from './auth';

const PRINT_JOBS_COLLECTION = 'qr_print_jobs';
const PRINT_CONFIG_COLLECTION = 'qr_print_config';

/** Whether the caller may act on this business unit (mirrors updateQrOrderStatus). */
function callerCoversBU(user: StaffUser, businessUnitId: string): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true; // cross-BU by design
    if (user.businessId && user.businessId === businessUnitId) return true;
    if (Array.isArray(user.businessUnitIds) && user.businessUnitIds.includes(businessUnitId)) return true;
    return false;
}

// ── setAutoPrint ─────────────────────────────────────────────────────────────
export interface SetAutoPrintInput { businessUnitId?: string; enabled?: boolean; }
export interface SetAutoPrintResult { businessUnitId: string; autoPrint: boolean; }

export async function setAutoPrintHandler(
    db: Firestore,
    request: CallableRequest<SetAutoPrintInput>,
): Promise<SetAutoPrintResult> {
    const user = await requireStaffRole(db, request.auth?.uid, QR_OPS_ROLES);
    const uid = request.auth!.uid;

    const buRaw = request.data?.businessUnitId;
    if (typeof buRaw !== 'string' || buRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'businessUnitId is required');
    }
    if (typeof request.data?.enabled !== 'boolean') {
        throw new HttpsError('invalid-argument', 'enabled must be a boolean');
    }
    const businessUnitId = buRaw.trim();
    if (!callerCoversBU(user, businessUnitId)) {
        throw new HttpsError('permission-denied', 'That business unit belongs to another location');
    }

    await db.collection(PRINT_CONFIG_COLLECTION).doc(businessUnitId).set({
        businessUnitId,
        autoPrint: request.data.enabled,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
    }, { merge: true });

    return { businessUnitId, autoPrint: request.data.enabled };
}

// ── retryPrintJob ────────────────────────────────────────────────────────────
export interface RetryPrintJobInput { jobId?: string; }
export interface RetryPrintJobResult { jobId: string; status: string; requeued: boolean; }

export async function retryPrintJobHandler(
    db: Firestore,
    request: CallableRequest<RetryPrintJobInput>,
): Promise<RetryPrintJobResult> {
    const user = await requireStaffRole(db, request.auth?.uid, QR_OPS_ROLES);

    const jobIdRaw = request.data?.jobId;
    if (typeof jobIdRaw !== 'string' || jobIdRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'jobId is required');
    }
    const jobId = jobIdRaw.trim();
    const ref = db.collection(PRINT_JOBS_COLLECTION).doc(jobId);

    return db.runTransaction(async (txn): Promise<RetryPrintJobResult> => {
        const snap = await txn.get(ref);
        if (!snap.exists) throw new HttpsError('not-found', 'Print job not found');
        const job = snap.data() as Record<string, unknown>;

        const bu = typeof job.businessUnitId === 'string' ? job.businessUnitId : '';
        if (!callerCoversBU(user, bu)) {
            throw new HttpsError('permission-denied', 'That print job belongs to another business unit');
        }

        const status = typeof job.status === 'string' ? job.status : '';
        // Already queued / in progress → idempotent no-op (safe double-tap).
        if (status === 'PENDING' || status === 'PRINTING') {
            return { jobId, status, requeued: false };
        }
        // Only a FAILED job may be re-queued. A PRINTED job is NEVER retried here
        // (that would risk a duplicate ticket — use a manual REPRINT for an extra copy).
        if (status !== 'FAILED') {
            throw new HttpsError('failed-precondition', `Cannot retry a ${status || '(unknown)'} job`);
        }

        txn.update(ref, {
            status: 'PENDING',
            lastError: null,
            requeuedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { jobId, status: 'PENDING', requeued: true };
    });
}
