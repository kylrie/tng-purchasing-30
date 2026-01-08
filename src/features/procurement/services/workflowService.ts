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

    const nowISO = new Date().toISOString();

    const auditEntry: RequisitionHistory = {
      action,
      actorId: user.uid,
      actorName: user.displayName,
      date: nowISO.split('T')[0], // Legacy: date only (YYYY-MM-DD)
      timestamp: nowISO, // New: Full ISO timestamp with time
      stage: currentStatus,
      comments: reason || undefined,
      actionIndex: currentHistoryLength // FIX BUG 6: Sequential index for server timestamp correlation
    };

    // FIX: Use const instead of let (prefer-const)
    const updates: Record<string, unknown> = {
      history: arrayUnion(auditEntry),
      lastModified: serverTimestamp(), // Server timestamp - authoritative audit trail
      lastModifiedBy: user.uid,
      lastActionIndex: currentHistoryLength // FIX BUG 6: Track which history entry triggered this update
    };

    switch (action) {
      case 'APPROVE': {
        let nextStatus: RequisitionStatus | null = null;
        const totalAmount = (data.totalAmount as number) || 0;
        const GM_PRF_THRESHOLD = 50000;

        // =====================================================
        // FIX: Full 8-Stage PRF Workflow (synced with requisitions.service.ts)
        // =====================================================
        // BURF Workflow:
        //   BURF_PENDING_MANAGER → BURF_PENDING_CIC → READY_FOR_PRF
        //
        // PRF 8-Stage Workflow:
        //   Step 1: PRF_PENDING_MANAGER → Step 2 (if >=50k) or Step 3 (if <50k)
        //   Step 2: PENDING_GM_PRF_APPROVAL → Step 3
        //   Step 3: PENDING_FINANCE_HEAD_BR_APPROVAL → Step 4
        //   Step 4: PENDING_GM_BR_APPROVAL → Step 5
        //   Step 5: PENDING_BOD_APPROVAL → Step 6
        //   Step 6: FOR_CHECK_PREPARATION → Step 7
        //   Step 7: PENDING_CHECK_AUTH_BOD → Step 8
        //   Step 8: FOR_FUND_RELEASE → FUNDS_RELEASED
        // =====================================================

        // BURF Workflow (unchanged)
        if (currentStatus === RequisitionStatus.BURF_PENDING_MANAGER) {
          nextStatus = RequisitionStatus.BURF_PENDING_CIC;
        } else if (currentStatus === RequisitionStatus.BURF_PENDING_CIC) {
          nextStatus = RequisitionStatus.READY_FOR_PRF;
        }
        // PRF Step 1: BUM Approval → Step 2 (if >=50k) or Step 3 (if <50k)
        else if (currentStatus === RequisitionStatus.PRF_PENDING_MANAGER) {
          nextStatus = totalAmount >= GM_PRF_THRESHOLD
            ? RequisitionStatus.PENDING_GM_PRF_APPROVAL
            : RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL;
        }
        // PRF Step 2: GM PRF Review → Step 3
        else if (currentStatus === RequisitionStatus.PENDING_GM_PRF_APPROVAL) {
          nextStatus = RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL;
        }
        // PRF Step 3: Finance Head Budget Review → Step 4
        else if (currentStatus === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL) {
          nextStatus = RequisitionStatus.PENDING_GM_BR_APPROVAL;
        }
        // PRF Step 4: GM Budget Approval → Step 5
        else if (currentStatus === RequisitionStatus.PENDING_GM_BR_APPROVAL) {
          nextStatus = RequisitionStatus.PENDING_BOD_APPROVAL;
        }
        // PRF Step 5: BOD Approval → Step 6 (Check Prep)
        else if (currentStatus === RequisitionStatus.PENDING_BOD_APPROVAL) {
          nextStatus = RequisitionStatus.FOR_CHECK_PREPARATION;
        }
        // PRF Step 6: Check Preparation → Step 7 (BOD Check Auth)
        else if (currentStatus === RequisitionStatus.FOR_CHECK_PREPARATION) {
          nextStatus = RequisitionStatus.PENDING_CHECK_AUTH_BOD;
        }
        // PRF Step 7: BOD Check Authorization → Step 8 (Fund Release)
        else if (currentStatus === RequisitionStatus.PENDING_CHECK_AUTH_BOD) {
          nextStatus = RequisitionStatus.FOR_FUND_RELEASE;
        }
        // PRF Step 8: Fund Release → Complete
        else if (currentStatus === RequisitionStatus.FOR_FUND_RELEASE) {
          nextStatus = RequisitionStatus.FUNDS_RELEASED;
        }
        // Legacy status support
        else if (currentStatus === RequisitionStatus.APPROVED_FOR_PAYMENT) {
          nextStatus = RequisitionStatus.FUNDS_RELEASED;
        }
        else if (currentStatus === RequisitionStatus.PENDING_CFO_APPROVAL) {
          nextStatus = RequisitionStatus.PENDING_BOD_APPROVAL; // Legacy: skip to BOD
        }
        else {
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
        } else if (currentStatus === RequisitionStatus.PENDING_GM_PRF_APPROVAL) {
          updates['approvals.gmPrf'] = {
            approved: true,
            approverId: user.uid,
            date: serverTimestamp()
          };
        } else if (currentStatus === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL) {
          updates['approvals.financeHeadBr'] = {
            approved: true,
            approverId: user.uid,
            date: serverTimestamp()
          };
        } else if (currentStatus === RequisitionStatus.PENDING_GM_BR_APPROVAL) {
          updates['approvals.gmBr'] = {
            approved: true,
            approverId: user.uid,
            date: serverTimestamp()
          };
        } else if (currentStatus === RequisitionStatus.PENDING_BOD_APPROVAL) {
          updates['approvals.bod'] = {
            approved: true,
            approverId: user.uid,
            date: serverTimestamp()
          };
        } else if (currentStatus === RequisitionStatus.PENDING_CHECK_AUTH_BOD) {
          updates['approvals.checkAuthBod'] = {
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
