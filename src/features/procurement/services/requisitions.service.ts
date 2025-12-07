import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { Requisition, RequisitionHistory, RequisitionItem, SupplierDetails } from '../types';
import { RequisitionStatus, UserRole, hasGlobalAccess } from '../types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import { removeUndefinedFields } from '../../../shared/utils/firestore.utils';

const REQUISITIONS_COLLECTION = COLLECTIONS.REQUISITIONS;

/**
 * Parameters for creating a batch PRF from BURF
 */
interface CreateBatchPrfParams {
  sourceBurfId: string;
  sourceBusinessId?: string; // Business ID for query permissions
  selectedItems: RequisitionItem[];
  prfDetails: {
    supplier: SupplierDetails;
    preparedBy: string;
    preparedByName: string;
    designatedApproverId?: string;
  };
  userId: string;
  userName: string;
}

/**
 * Result of batch PRF creation
 */
interface CreateBatchPrfResult {
  newPrfId: string;
  sourceBurfNewStatus: RequisitionStatus;
  remainingItemsCount: number;
}

/**
 * Service for all requisition related database operations
 */
export class RequisitionService {

  /**
   * Create a batch PRF from a BURF using a Firestore transaction
   * This ensures atomic operations: PRF is created AND items are removed from BURF together
   * 
   * @param params - Parameters for the batch PRF creation
   * @returns Result containing new PRF ID and updated BURF status
   */
  static async createBatchPrfFromBurf(params: CreateBatchPrfParams): Promise<CreateBatchPrfResult> {
    const { sourceBurfId, selectedItems, prfDetails, userId, userName } = params;

    console.log(`[createBatchPrfFromBurf] Starting for BURF: ${sourceBurfId}`);
    console.log(`[createBatchPrfFromBurf] Selected items count: ${selectedItems.length}`);

    console.log(`[createBatchPrfFromBurf] Selected items count: ${selectedItems.length}`);

    try {
      const sourceBurfRef = doc(db, REQUISITIONS_COLLECTION, sourceBurfId);

      // Step 1: Run transaction for atomic create + update + ID generation
      let sourceBurfNewStatus: RequisitionStatus = RequisitionStatus.READY_FOR_PRF;
      let remainingItemsCount = 0;
      let newPrfId = '';

      console.log('[createBatchPrfFromBurf] Starting transaction...');
      await runTransaction(db, async (transaction) => {
        // Step A: Read the current state of the source BURF
        const sourceBurfSnap = await transaction.get(sourceBurfRef);
        if (!sourceBurfSnap.exists()) {
          throw new Error(`Source BURF ${sourceBurfId} not found`);
        }

        const sourceBurf = { id: sourceBurfSnap.id, ...sourceBurfSnap.data() } as Requisition;

        // Validate source BURF is in the correct status
        if (sourceBurf.status !== RequisitionStatus.READY_FOR_PRF) {
          throw new Error(`Cannot create PRF from BURF in status: ${sourceBurf.status}. Expected READY_FOR_PRF.`);
        }

        // FIX: Atomic Batch ID Generation
        // Get current batch counter or default to 0
        const currentBatchCount = (sourceBurf as any).batchCounter || 0;
        const nextBatchCount = currentBatchCount + 1;
        const paddedBatch = nextBatchCount.toString().padStart(2, '0');
        newPrfId = `${sourceBurfId}-Batch${paddedBatch}`;

        // FIX: Double Spend Prevention (Item Verification)
        // Verify that ALL selected items still exist in the source BURF
        const sourceItemMap = new Map(sourceBurf.items.map(i => [i.itemId, i]));
        const missingItems = selectedItems.filter(item => !sourceItemMap.has(item.itemId));

        if (missingItems.length > 0) {
          const missingNames = missingItems.map(i => i.name).join(', ');
          throw new Error(`Critical Error: Some items have already been processed or removed: ${missingNames}. Please refresh and try again.`);
        }

        // Step B: Split items
        const selectedItemIds = new Set(selectedItems.map(item => item.itemId));
        const remainingItems = sourceBurf.items.filter(item => !selectedItemIds.has(item.itemId));
        remainingItemsCount = remainingItems.length;

        // Determine new status for source BURF
        sourceBurfNewStatus = remainingItems.length === 0
          ? RequisitionStatus.BURF_COMPLETED
          : RequisitionStatus.READY_FOR_PRF;

        // Step C: Create new PRF document
        const newPrf: Requisition = {
          id: newPrfId,
          requesterId: sourceBurf.requesterId,
          requesterName: sourceBurf.requesterName || '',
          requesterPhotoUrl: sourceBurf.requesterPhotoUrl || '',
          businessId: sourceBurf.businessId,
          items: selectedItems,
          totalAmount: selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          status: RequisitionStatus.PRF_PENDING_MANAGER,
          dateCreated: new Date().toISOString(),
          description: sourceBurf.description || '',
          projectName: sourceBurf.projectName || '',
          remarks: `Batch ${paddedBatch} from ${sourceBurfId}`,
          dateNeeded: sourceBurf.dateNeeded || '',
          priority: sourceBurf.priority || 'NORMAL',
          attachments: sourceBurf.attachments || [],
          parentBurfId: sourceBurfId,
          prfDetails: {
            supplier: prfDetails.supplier,
            preparedBy: prfDetails.preparedBy,
            preparedByName: prfDetails.preparedByName,
            datePrepared: new Date().toISOString(),
            requisitionId: sourceBurfId,
            timestamp: new Date().toISOString(),
            designatedApproverId: prfDetails.designatedApproverId,
          },
          timestamp: new Date().toISOString(),
          history: [{
            date: new Date().toISOString(),
            actorId: userId,
            actorName: userName,
            action: 'Created from BURF',
            stage: RequisitionStatus.PRF_PENDING_MANAGER,
            comments: `PRF created as ${newPrfId} from BURF ${sourceBurfId}`,
          }],
        };

        // Step D: Create history entry for source BURF update
        const burfHistoryEntry: RequisitionHistory = {
          date: new Date().toISOString(),
          actorId: userId,
          actorName: userName,
          action: remainingItems.length === 0 ? 'Fully Converted to PRF' : 'Partial PRF Created',
          stage: sourceBurfNewStatus,
          comments: `${selectedItems.length} items moved to ${newPrfId}. ${remainingItems.length} items remaining.`,
        };
        const updatedBurfHistory = [burfHistoryEntry, ...(sourceBurf.history || [])];

        // Step E: Write operations
        const newPrfRef = doc(db, REQUISITIONS_COLLECTION, newPrfId);
        const sanitizedPrf = removeUndefinedFields(newPrf);

        // 1. Create new PRF
        transaction.set(newPrfRef, sanitizedPrf);

        // 2. Update Source BURF (Items, Status, History, AND BatchCounter)
        transaction.update(sourceBurfRef, {
          items: remainingItems,
          totalAmount: remainingItems.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0),
          status: sourceBurfNewStatus,
          history: updatedBurfHistory,
          updatedAt: serverTimestamp(),
          batchCounter: nextBatchCount // Increment atomic counter
        });
      });

      console.log(`[createBatchPrfFromBurf] SUCCESS: Created ${newPrfId} from ${sourceBurfId}. Remaining items: ${remainingItemsCount}`);

      return {
        newPrfId,
        sourceBurfNewStatus,
        remainingItemsCount,
      };
    } catch (error: any) {
      console.error('[createBatchPrfFromBurf] FAILED');
      console.error('Error Code:', error?.code);
      console.error('Error Message:', error?.message);
      console.error('Full Error:', error);
      throw error;
    }
  }

  /**
   * FIX M6: Batch query utility - chunks IDs into groups of 10 for Firestore 'in' limit
   * Prevents downloading entire collection for users with many business units
   */
  private static async getRequisitionsWithBatching(
    businessIds: string[]
  ): Promise<Requisition[]> {
    const BATCH_SIZE = 10;
    const results: Requisition[] = [];

    // Chunk into groups of 10
    for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
      const chunk = businessIds.slice(i, i + BATCH_SIZE);
      const constraints = [where('businessId', 'in', chunk)];
      const chunkResults = await FirestoreService.getDocuments<Requisition>(
        REQUISITIONS_COLLECTION,
        constraints
      );
      results.push(...chunkResults);
    }

    // Deduplicate by ID (in case of concurrent updates)
    const uniqueMap = new Map(results.map(r => [r.id, r]));
    return Array.from(uniqueMap.values());
  }

  /**
   * Get requisitions based on user role and business ID(s)
   * FIX M6: Uses batched queries for all cases (no more fetch-all fallback)
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
    const allAccessibleIds = Array.from(new Set([businessId, ...additionalBusinessIds]));

    if (allAccessibleIds.length === 0) {
      return [];
    }

    // FIX M6: Always use batched queries (handles any number of BUs)
    return this.getRequisitionsWithBatching(allAccessibleIds);
  }

  /**
   * Get a single requisition by ID
   */
  static async getRequisitionById(id: string): Promise<Requisition | null> {
    return FirestoreService.getDocument<Requisition>(REQUISITIONS_COLLECTION, id);
  }

  /**
   * Subscribe to real-time updates for requisitions
   * FIX M6: Uses batched subscriptions for >10 business units
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

    // FIX M6: For subscriptions with >10 BUs, use multiple subscriptions and merge
    if (allAccessibleIds.length <= 10) {
      const constraints = [where('businessId', 'in', allAccessibleIds)];
      return FirestoreService.subscribeToCollection<Requisition>(
        REQUISITIONS_COLLECTION,
        callback,
        constraints
      );
    }

    // Multiple subscriptions for >10 BUs
    const BATCH_SIZE = 10;
    const unsubscribes: (() => void)[] = [];
    const resultsByChunk: Map<number, Requisition[]> = new Map();

    const mergeAndCallback = () => {
      const allResults: Requisition[] = [];
      resultsByChunk.forEach(chunk => allResults.push(...chunk));
      // Deduplicate
      const uniqueMap = new Map(allResults.map(r => [r.id, r]));
      callback(Array.from(uniqueMap.values()));
    };

    for (let i = 0; i < allAccessibleIds.length; i += BATCH_SIZE) {
      const chunkIndex = i / BATCH_SIZE;
      const chunk = allAccessibleIds.slice(i, i + BATCH_SIZE);
      const constraints = [where('businessId', 'in', chunk)];

      const unsub = FirestoreService.subscribeToCollection<Requisition>(
        REQUISITIONS_COLLECTION,
        (chunkResults) => {
          resultsByChunk.set(chunkIndex, chunkResults);
          mergeAndCallback();
        },
        constraints
      );
      unsubscribes.push(unsub);
    }

    // Return cleanup function that unsubscribes all
    return () => unsubscribes.forEach(unsub => unsub());
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
   * FIX C5: Now uses transaction to prevent race conditions (matching approveRequisition pattern)
   * Previously used separate update + addHistoryEntry calls which could cause data inconsistency
   */
  static async rejectRequisition(
    requisitionId: string,
    userId: string,
    userName: string,
    comments: string
  ): Promise<void> {
    const docRef = doc(db, REQUISITIONS_COLLECTION, requisitionId);

    // FIX C5: Use transaction for atomic read-modify-write (was separate operations)
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) throw new Error('Requisition not found');

      const requisition = { id: snap.id, ...snap.data() } as Requisition;

      // Create history entry inline (can't call async methods in transaction)
      const historyEntry: RequisitionHistory = {
        date: new Date().toISOString(),
        actorId: userId,
        actorName: userName,
        action: 'Rejected',
        stage: RequisitionStatus.REJECTED,
        comments: comments,
      };

      const updatedHistory = [historyEntry, ...(requisition.history || [])];

      // Atomic update within transaction - status + history together
      transaction.update(docRef, {
        status: RequisitionStatus.REJECTED,
        history: updatedHistory,
        updatedAt: serverTimestamp(),
      });
    });
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

  /**
   * Submit liquidation for a requisition
   * @param requisitionId - The PRF ID
   * @param userId - Current user ID
   * @param userName - Current user name
   * @param payload - Liquidation data including item actuals and summary
   */
  static async submitLiquidation(
    requisitionId: string,
    userId: string,
    userName: string,
    payload: {
      items: Array<{
        itemId: string;
        name: string;
        quantity: number;
        estimatedCost: number;
        actualCost: number;
        receiptRef: string;
      }>;
      totalBudget: number;
      totalActual: number;
      variance: number; // positive = surplus (to return), negative = deficit (to reimburse)
      receiptsLink?: string;
      remarks?: string;
    }
  ): Promise<void> {
    const docRef = doc(db, REQUISITIONS_COLLECTION, requisitionId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) throw new Error('Requisition not found');

      const requisition = { id: snap.id, ...snap.data() } as Requisition;

      // Verify status allows liquidation
      if (requisition.status !== RequisitionStatus.FUNDS_RELEASED) {
        throw new Error(`Cannot submit liquidation for requisition in status: ${requisition.status}. Expected FUNDS_RELEASED.`);
      }

      // Create history entry
      const historyEntry: RequisitionHistory = {
        date: new Date().toISOString(),
        actorId: userId,
        actorName: userName,
        action: 'Liquidation Filed',
        stage: RequisitionStatus.LIQUIDATION_FILED,
        comments: payload.remarks || 'Liquidation documents submitted',
      };

      const updatedHistory = [historyEntry, ...(requisition.history || [])];

      // Update requisition with liquidation details
      transaction.update(docRef, {
        status: RequisitionStatus.LIQUIDATION_FILED,
        history: updatedHistory,
        liquidationDetails: {
          submittedBy: userId,
          submittedByName: userName,
          submittedAt: new Date().toISOString(),
          items: payload.items,
          totalBudget: payload.totalBudget,
          totalActual: payload.totalActual,
          variance: payload.variance,
          receiptsLink: payload.receiptsLink || '',
          remarks: payload.remarks || '',
          status: 'PENDING' as const, // Pending audit
        },
        updatedAt: serverTimestamp(),
      });
    });
  }

  /**
   * Release funds for a requisition and automatically update linked PCF status
   * If the PRF has a linkedPcfId (PCF Replenishment), also update the PCF to REPLENISHED
   */
  static async releaseFundsWithPcfUpdate(
    requisitionId: string,
    chequeNumber: string,
    chequeImageUrl?: string,
    userId?: string,
    userName?: string
  ): Promise<void> {
    const docRef = doc(db, REQUISITIONS_COLLECTION, requisitionId);
    const pcfCollectionName = 'pcf_liquidations';

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error('Requisition not found');
      }

      const requisition = { id: snap.id, ...snap.data() } as Requisition;

      // Build history entry
      const historyEntry: RequisitionHistory = {
        date: new Date().toISOString(),
        actorId: userId || 'system',
        actorName: userName || 'Finance',
        action: 'FUNDS_RELEASED',
        stage: RequisitionStatus.FUNDS_RELEASED,
        comments: `Cheque #${chequeNumber} released`,
      };

      const updatedHistory = [historyEntry, ...(requisition.history || [])];

      // Step 1: Update the PRF to FUNDS_RELEASED
      transaction.update(docRef, {
        status: RequisitionStatus.FUNDS_RELEASED,
        chequeNumber: chequeNumber,
        chequeImageUrl: chequeImageUrl || '',
        fundReleaseDate: new Date().toISOString(),
        history: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      // Step 2: If this is a PCF Replenishment PRF, update the linked PCF to REPLENISHED
      if (requisition.linkedPcfId) {
        const pcfRef = doc(db, pcfCollectionName, requisition.linkedPcfId);
        transaction.update(pcfRef, {
          status: 'REPLENISHED',
          dateReplenished: new Date().toISOString(),
        });
      }
    });
  }
}
