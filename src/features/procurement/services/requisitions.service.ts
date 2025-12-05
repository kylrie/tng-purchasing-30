import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { Requisition, RequisitionHistory } from '../types';
import { RequisitionStatus, UserRole, hasGlobalAccess } from '../types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';

const REQUISITIONS_COLLECTION = COLLECTIONS.REQUISITIONS;

/**
 * Service for all requisition related database operations
 */
export class RequisitionService {

  /**
   * Get requisitions based on user role and business ID(s)
   */
  static async getRequisitions(
    userRole: UserRole,
    businessId: string,
    additionalBusinessIds: string[] = []
  ): Promise<Requisition[]> {

    // 1. Super Admin: Fetch All
    if (hasGlobalAccess(userRole)) {
      return FirestoreService.getDocuments<Requisition>(REQUISITIONS_COLLECTION, []);
    }

    // 2. Normal User: Fetch based on assigned Business Units
    // Combine primary businessId with additionalIds
    const allAccessibleIds = Array.from(new Set([businessId, ...additionalBusinessIds]));

    if (allAccessibleIds.length === 0) {
      return [];
    }

    // Firestore 'in' query supports up to 10 items.
    // If a user has > 10 BUs, we might need multiple queries or client-side filtering.
    // For now, assuming < 10 BUs per user for simplicity.
    if (allAccessibleIds.length <= 10) {
      const constraints = [where('businessId', 'in', allAccessibleIds)];
      return FirestoreService.getDocuments<Requisition>(REQUISITIONS_COLLECTION, constraints);
    }

    // Fallback for > 10 BUs: Fetch all and filter client-side (or optimize later)
    // fetching all might be heavy, but it's a safe fallback for "Power Users" who aren't Super Admins
    // Ideally, we'd batch the queries.
    const allDocs = await FirestoreService.getDocuments<Requisition>(REQUISITIONS_COLLECTION, []);
    return allDocs.filter(doc => allAccessibleIds.includes(doc.businessId));
  }

  /**
   * Get a single requisition by ID
   */
  static async getRequisitionById(id: string): Promise<Requisition | null> {
    return FirestoreService.getDocument<Requisition>(REQUISITIONS_COLLECTION, id);
  }

  /**
   * Subscribe to real-time updates for requisitions
   */
  static subscribeToRequisitions(
    userRole: UserRole,
    businessId: string,
    additionalBusinessIds: string[] = [],
    callback: (requisitions: Requisition[]) => void
  ): () => void {

    // 1. Super Admin
    if (hasGlobalAccess(userRole)) {
      return FirestoreService.subscribeToCollection<Requisition>(
        REQUISITIONS_COLLECTION,
        callback,
        []
      );
    }

    // 2. Normal User
    const allAccessibleIds = Array.from(new Set([businessId, ...additionalBusinessIds]));

    if (allAccessibleIds.length === 0) {
      callback([]);
      return () => { };
    }

    if (allAccessibleIds.length <= 10) {
      const constraints = [where('businessId', 'in', allAccessibleIds)];
      return FirestoreService.subscribeToCollection<Requisition>(
        REQUISITIONS_COLLECTION,
        callback,
        constraints
      );
    }

    // Fallback for > 10: Subscribe to all and filter in callback
    // Note: This downloads everything, which isn't ideal for bandwidth but ensures correctness
    return FirestoreService.subscribeToCollection<Requisition>(
      REQUISITIONS_COLLECTION,
      (allDocs) => {
        const filtered = allDocs.filter(doc => allAccessibleIds.includes(doc.businessId));
        callback(filtered);
      },
      []
    );
  }

  /**
   * Create a new requisition
   */
  static async createRequisition(requisition: Omit<Requisition, 'id'> | Requisition): Promise<string> {
    if ('id' in requisition && requisition.id) {
      await FirestoreService.setDocument(REQUISITIONS_COLLECTION, requisition.id, requisition);
      return requisition.id;
    }
    return FirestoreService.createDocument(REQUISITIONS_COLLECTION, requisition);
  }

  /**
   * Update an existing requisition
   */
  static async updateRequisition(
    id: string,
    updates: Partial<Requisition>
  ): Promise<void> {
    return FirestoreService.updateDocument(REQUISITIONS_COLLECTION, id, updates);
  }

  /**
   * Delete a requisition
   */
  static async deleteRequisition(id: string): Promise<void> {
    return FirestoreService.deleteDocument(REQUISITIONS_COLLECTION, id);
  }

  /**
   * Add a history entry to a requisition
   */
  static async addHistoryEntry(
    requisitionId: string,
    actorId: string,
    actorName: string,
    action: string,
    stage: RequisitionStatus,
    comments?: string
  ): Promise<void> {
    const currentRequisition = await this.getRequisitionById(requisitionId);
    if (!currentRequisition) throw new Error('Requisition not found');

    const newHistoryEntry: RequisitionHistory = {
      date: new Date().toISOString(),
      actorId,
      actorName,
      action,
      stage,
      ...(comments !== undefined && { comments }),
    };

    const updatedHistory = [newHistoryEntry, ...(currentRequisition.history || [])];

    return this.updateRequisition(requisitionId, { history: updatedHistory });
  }

  /**
   * Approve a requisition (Manager, CIC, etc.)
   * FIX H2: Now uses transaction to prevent race conditions when multiple approvers click simultaneously
   */
  static async approveRequisition(
    requisitionId: string,
    userId: string,
    userName: string,
    comments?: string
  ): Promise<void> {
    const docRef = doc(db, REQUISITIONS_COLLECTION, requisitionId);

    // FIX H2: Use transaction for atomic read-modify-write (was separate read/write causing race conditions)
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) throw new Error('Requisition not found');

      const requisition = { id: snap.id, ...snap.data() } as Requisition;
      let nextStatus: RequisitionStatus | undefined;
      const approvalAction = 'Approved';

      // Determine next status based on current status
      switch (requisition.status) {
        case RequisitionStatus.BURF_PENDING_MANAGER:
          nextStatus = RequisitionStatus.BURF_PENDING_CIC;
          break;
        case RequisitionStatus.BURF_PENDING_CIC:
          nextStatus = RequisitionStatus.READY_FOR_PRF;
          break;
        case RequisitionStatus.PRF_PENDING_MANAGER:
          nextStatus = RequisitionStatus.APPROVED_FOR_PAYMENT;
          break;
        default:
          throw new Error(`Cannot approve requisition in status: ${requisition.status}`);
      }

      if (nextStatus) {
        // Create history entry inline (can't call async methods in transaction)
        const historyEntry: RequisitionHistory = {
          date: new Date().toISOString(),
          actorId: userId,
          actorName: userName,
          action: approvalAction,
          stage: nextStatus,
          ...(comments !== undefined && { comments }),
        };

        const updatedHistory = [historyEntry, ...(requisition.history || [])];

        // Atomic update within transaction
        transaction.update(docRef, {
          status: nextStatus,
          history: updatedHistory,
          updatedAt: serverTimestamp(),
        });
      }
    });
  }

  /**
   * Reject a requisition
   */
  static async rejectRequisition(
    requisitionId: string,
    userId: string,
    userName: string,
    comments: string
  ): Promise<void> {
    await this.updateRequisition(requisitionId, { status: RequisitionStatus.REJECTED });
    await this.addHistoryEntry(
      requisitionId,
      userId,
      userName,
      'Rejected',
      RequisitionStatus.REJECTED,
      comments
    );
  }

  /**
   * Re-file a rejected requisition
   */
  static async reFileRequisition(
    requisitionId: string,
    userId: string,
    userName: string,
    updates: Partial<Requisition>
  ): Promise<void> {
    // If the requisition has prfDetails, it's a PRF and should return to PRF_PENDING_MANAGER
    // Otherwise, it's a BURF and should return to BURF_PENDING_MANAGER
    const nextStatus = updates.prfDetails
      ? RequisitionStatus.PRF_PENDING_MANAGER
      : RequisitionStatus.BURF_PENDING_MANAGER;

    await this.updateRequisition(requisitionId, {
      ...updates,
      status: nextStatus,
    });

    await this.addHistoryEntry(
      requisitionId,
      userId,
      userName,
      'Re-filed',
      nextStatus,
      'Requisition has been updated and re-filed for approval.'
    );
  }
}
