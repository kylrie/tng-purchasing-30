import { FirestoreService, where } from '../../../shared/services/firestore.service';
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
   */
  static async approveRequisition(
    requisitionId: string,
    userId: string,
    userName: string,
    comments?: string
  ): Promise<void> {
    const requisition = await this.getRequisitionById(requisitionId);
    if (!requisition) throw new Error('Requisition not found');

    let nextStatus: RequisitionStatus | undefined;
    const approvalAction = 'Approved';

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
      // Add other approval steps here
    }

    if (nextStatus) {
      await this.updateRequisition(requisitionId, { status: nextStatus });
      await this.addHistoryEntry(
        requisitionId,
        userId,
        userName,
        approvalAction,
        nextStatus,
        comments
      );
    }
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
