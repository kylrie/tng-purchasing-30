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

    // Audit Entry with server timestamp (Issue #7)
    // Note: arrayUnion with serverTimestamp requires special handling
    const auditEntry: RequisitionHistory = {
      action,
      actorId: user.uid,
      actorName: user.displayName,
      date: new Date().toISOString(), // For history array (serverTimestamp not supported in arrayUnion)
      stage: currentStatus,
      comments: reason || undefined
    };

    const updates: Record<string, unknown> = {
      history: arrayUnion(auditEntry),
      lastModified: serverTimestamp(), // Server timestamp for main doc (Issue #7)
      lastModifiedBy: user.uid
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
        const isPrf = !!data.prfIdentifier;
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
