import { FirestoreService, where, Timestamp } from '../../../shared/services/firestore.service';
import {
  Requisition, RequisitionStatus, RequisitionHistory,
  UserRole, hasGlobalAccess
} from '../types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';

const REQUISITIONS_COLLECTION = COLLECTIONS.REQUISITIONS;

/**
 * Service for all requisition related database operations
 */
export class RequisitionService {

  /**
   * Get requisitions based on user role and business ID
   */
  static async getRequisitions(userRole: UserRole, businessId: string): Promise<Requisition[]> {
    const constraints = hasGlobalAccess(userRole)
      ? []
      : [where('businessId', '==', businessId)];

    return FirestoreService.getDocuments<Requisition>(REQUISITIONS_COLLECTION, constraints);
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
    callback: (requisitions: Requisition[]) => void
  ): () => void {
    const constraints = hasGlobalAccess(userRole)
      ? []
      : [where('businessId', '==', businessId)];

    return FirestoreService.subscribeToCollection<Requisition>(
      REQUISITIONS_COLLECTION,
      callback,
      constraints
    );
  }

  /**
   * Create a new requisition
   */
  static async createRequisition(requisition: Omit<Requisition, 'id'>): Promise<string> {
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
      comments,
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
    userRole: UserRole,
    comments?: string
  ): Promise<void> {
    const requisition = await this.getRequisitionById(requisitionId);
    if (!requisition) throw new Error('Requisition not found');

    let nextStatus: RequisitionStatus | undefined;
    let approvalAction = 'Approved';

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
    userRole: string,
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
    userRole: string,
    updates: Partial<Requisition>
  ): Promise<void> {
    const nextStatus = updates.prfIdentifier
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
