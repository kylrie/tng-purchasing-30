import { db } from '../../../config/firebase';
import { doc, runTransaction, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { RequisitionStatus } from '../../procurement/types';
import type { RequisitionHistory } from '../../procurement/types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';

export type WorkflowAction = 'APPROVE' | 'REJECT' | 'CANCEL' | 'REFILE';

interface ActionParams {
  requisitionId: string;
  action: WorkflowAction;
  user: { uid: string; displayName: string; email: string };
  reason?: string; // Required for Reject
}

/**
 * Executes workflow actions using Firestore transactions.
 * Issue #7 Fix: Uses serverTimestamp() for audit trail integrity
 * Issue #8 Fix: Uses runTransaction() to prevent race conditions
 */
export const executeWorkflowAction = async ({
  requisitionId,
  action,
  user,
  reason = ''
}: ActionParams): Promise<void> => {
  const ref = doc(db, COLLECTIONS.REQUISITIONS, requisitionId);

  // Use transaction to prevent race conditions (Issue #8)
  await runTransaction(db, async (transaction) => {
    // Fetch current doc within transaction
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Requisition not found");

    const data = snap.data();
    const currentStatus = data.status as RequisitionStatus;

    // =====================================================
    // FIX BUG 6: Audit History Timestamp Strategy
    // =====================================================
    // PROBLEM: Firestore's arrayUnion() doesn't support serverTimestamp() inside arrays.
    // SOLUTION: We use a hybrid approach:
    //   1. Client ISO timestamp in array for immediate display (date field)
    //   2. Server timestamp on main document (lastModified) for authoritative audit
    //   3. A sequential actionIndex to correlate history entries with server timestamps
    // 
    // For forensic auditing, cross-reference:
    //   history[n].actionIndex === n means history[n] was created when lastModified was set
    // =====================================================

    const currentHistoryLength = Array.isArray(data.history) ? data.history.length : 0;

    const auditEntry: RequisitionHistory = {
      action,
      actorId: user.uid,
      actorName: user.displayName,
      date: new Date().toISOString(), // Client timestamp for display
      stage: currentStatus,
      comments: reason || undefined,
      actionIndex: currentHistoryLength // FIX BUG 6: Sequential index for server timestamp correlation
    };

    const updates: Record<string, unknown> = {
      history: arrayUnion(auditEntry),
      lastModified: serverTimestamp(), // Server timestamp - authoritative audit trail
      lastModifiedBy: user.uid,
      lastActionIndex: currentHistoryLength // FIX BUG 6: Track which history entry triggered this update
    };

    switch (action) {
      case 'APPROVE': {
        let nextStatus: RequisitionStatus | null = null;

        // Validate current status allows approval (Issue #8 - race condition check)
        if (currentStatus === RequisitionStatus.BURF_PENDING_MANAGER) {
          nextStatus = RequisitionStatus.BURF_PENDING_CIC;
        } else if (currentStatus === RequisitionStatus.BURF_PENDING_CIC) {
          nextStatus = RequisitionStatus.READY_FOR_PRF;
        } else if (currentStatus === RequisitionStatus.PRF_PENDING_MANAGER) {
          nextStatus = RequisitionStatus.APPROVED_FOR_PAYMENT;
        } else {
          throw new Error(`Cannot approve from status: ${currentStatus}. Status may have changed.`);
        }

        updates.status = nextStatus;

        // Record specific approval timestamps with server time
        if (currentStatus === RequisitionStatus.BURF_PENDING_MANAGER) {
          updates['approvals.manager'] = {
            approved: true,
            approverId: user.uid,
            date: serverTimestamp()
          };
        } else if (currentStatus === RequisitionStatus.BURF_PENDING_CIC) {
          updates['approvals.cic'] = {
            approved: true,
            approverId: user.uid,
            date: serverTimestamp()
          };
        } else if (currentStatus === RequisitionStatus.PRF_PENDING_MANAGER) {
          updates['approvals.prfManager'] = {
            approved: true,
            approverId: user.uid,
            date: serverTimestamp()
          };
        }
        break;
      }

      case 'REJECT':
        if (!reason) throw new Error("Rejection reason is required.");
        updates.status = RequisitionStatus.REJECTED;
        updates.rejectionReason = reason;
        updates.rejectedAt = serverTimestamp();
        updates.rejectedBy = user.uid;
        break;

      case 'CANCEL': {
        // Validate cancellation is allowed from current status
        const nonCancellableStatuses = [
          RequisitionStatus.FUNDS_RELEASED,
          RequisitionStatus.LIQUIDATION_FILED,
          RequisitionStatus.AUDITED_CLEARED
        ];
        if (nonCancellableStatuses.includes(currentStatus)) {
          throw new Error("Cannot cancel a requisition that has already processed funds.");
        }
        updates.status = RequisitionStatus.CANCELLED;
        updates.cancelledAt = serverTimestamp();
        updates.cancelledBy = user.uid;
        break;
      }

      case 'REFILE':
        if (currentStatus !== RequisitionStatus.REJECTED) {
          throw new Error("Can only refile rejected requisitions.");
        }
        // Reset to initial pending state based on type (BURF vs PRF)
        // FIX #5: Changed from data.prfIdentifier (doesn't exist) to data.prfDetails (actual schema field)
        const isPrf = !!data.prfDetails;
        updates.status = isPrf ? RequisitionStatus.PRF_PENDING_MANAGER : RequisitionStatus.BURF_PENDING_MANAGER;
        updates.rejectionReason = null;
        updates.refiledAt = serverTimestamp();
        updates.refiledBy = user.uid;
        break;

      default:
        throw new Error("Invalid Action");
    }

    // Atomic update within transaction
    transaction.update(ref, updates);
  });
};
