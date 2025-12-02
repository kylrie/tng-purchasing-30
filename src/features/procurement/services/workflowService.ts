import { db } from '../../../config/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
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

export const executeWorkflowAction = async ({
  requisitionId,
  action,
  user,
  reason = ''
}: ActionParams): Promise<void> => {
  const ref = doc(db, COLLECTIONS.REQUISITIONS, requisitionId);
  
  // Fetch current doc to validate state transitions
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Requisition not found");
  const data = snap.data();
  const currentStatus = data.status as RequisitionStatus;

  // Audit Entry
  const auditEntry: RequisitionHistory = {
    action,
    actorId: user.uid,
    actorName: user.displayName,
    date: new Date().toISOString(),
    stage: currentStatus, // Stage *at the time of action*
    comments: reason || undefined
  };

  let updates: any = {
    history: arrayUnion(auditEntry)
  };

  try {
    switch (action) {
      case 'APPROVE':
        let nextStatus: RequisitionStatus | null = null;
        
        // Logic for determining next status
        if (currentStatus === RequisitionStatus.BURF_PENDING_MANAGER) {
            nextStatus = RequisitionStatus.BURF_PENDING_CIC;
        } else if (currentStatus === RequisitionStatus.BURF_PENDING_CIC) {
            nextStatus = RequisitionStatus.READY_FOR_PRF;
        } else if (currentStatus === RequisitionStatus.PRF_PENDING_MANAGER) {
            nextStatus = RequisitionStatus.APPROVED_FOR_PAYMENT;
        } else {
            throw new Error(`Cannot approve from status: ${currentStatus}`);
        }

        updates.status = nextStatus;
        
        // Optional: Record specific approval timestamps
        if (currentStatus === RequisitionStatus.BURF_PENDING_MANAGER) {
            updates['approvals.manager'] = { approved: true, approverId: user.uid, date: new Date().toISOString() };
        } else if (currentStatus === RequisitionStatus.BURF_PENDING_CIC) {
            updates['approvals.cic'] = { approved: true, approverId: user.uid, date: new Date().toISOString() };
        }
        break;

      case 'REJECT':
        if (!reason) throw new Error("Rejection reason is required.");
        updates.status = RequisitionStatus.REJECTED;
        updates.rejectionReason = reason;
        break;

      case 'CANCEL':
        // Can only cancel if not already fully approved/released? 
        // Typically owners can cancel anytime before payment, but let's stick to safe states.
        if ([RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.LIQUIDATION_FILED, RequisitionStatus.AUDITED_CLEARED].includes(currentStatus)) {
            throw new Error("Cannot cancel a requisition that has already processed funds.");
        }
        updates.status = RequisitionStatus.CANCELLED;
        break;

      case 'REFILE':
        if (currentStatus !== RequisitionStatus.REJECTED) {
             throw new Error("Can only refile rejected requisitions.");
        }
        // Reset to initial pending state based on type (BURF vs PRF)
        // If it has a PRF identifier, it was likely a PRF
        const isPrf = !!data.prfIdentifier;
        updates.status = isPrf ? RequisitionStatus.PRF_PENDING_MANAGER : RequisitionStatus.BURF_PENDING_MANAGER;
        updates.rejectionReason = null; // Clear rejection
        break;
        
      default:
        throw new Error("Invalid Action");
    }

    await updateDoc(ref, updates);

  } catch (error) {
    console.error(`Workflow Action ${action} failed:`, error);
    throw error;
  }
};
