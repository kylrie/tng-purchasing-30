import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { doc, runTransaction, serverTimestamp, collection, query, where as firestoreWhere, getDocs } from 'firebase/firestore';
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
  sourceBusinessId: string; // Required for query permissions
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
    const { sourceBurfId, sourceBusinessId, selectedItems, prfDetails, userId, userName } = params;

    console.log(`[createBatchPrfFromBurf] Starting for BURF: ${sourceBurfId}`);
    console.log(`[createBatchPrfFromBurf] Selected items count: ${selectedItems.length}`);

    try {
      const sourceBurfRef = doc(db, REQUISITIONS_COLLECTION, sourceBurfId);

      // Step 1: Query for existing batches to determine next batch number
      // This is done BEFORE the transaction to avoid contention
      console.log('[createBatchPrfFromBurf] Step 1: Querying existing batches...');
      const requisitionsRef = collection(db, REQUISITIONS_COLLECTION);
      // Add businessId to the query to satisfy Firestore read rules (belongsToSameBU)
      const batchQuery = query(
        requisitionsRef,
        firestoreWhere('parentBurfId', '==', sourceBurfId),
        firestoreWhere('businessId', '==', sourceBusinessId)
      );
      const existingBatches = await getDocs(batchQuery);
      const nextBatchNumber = existingBatches.size + 1;
      const paddedBatch = nextBatchNumber.toString().padStart(2, '0');
      const newPrfId = `${sourceBurfId}-Batch${paddedBatch}`;
      console.log(`[createBatchPrfFromBurf] Step 1 complete. Existing batches: ${existingBatches.size}, New ID: ${newPrfId}`);

      // Step 2: Run transaction for atomic create + update
      let sourceBurfNewStatus: RequisitionStatus = RequisitionStatus.READY_FOR_PRF;
      let remainingItemsCount = 0;

      console.log('[createBatchPrfFromBurf] Step 2: Starting transaction...');
      await runTransaction(db, async (transaction) => {
        // Step A: Read the current state of the source BURF
        console.log('[createBatchPrfFromBurf] Step A: Reading source BURF...');
        const sourceBurfSnap = await transaction.get(sourceBurfRef);
        if (!sourceBurfSnap.exists()) {
          throw new Error(`Source BURF ${sourceBurfId} not found`);
        }

        const sourceBurf = { id: sourceBurfSnap.id, ...sourceBurfSnap.data() } as Requisition;
        console.log(`[createBatchPrfFromBurf] Step A complete. BURF status: ${sourceBurf.status}, items: ${sourceBurf.items.length}`);

        // Validate source BURF is in the correct status
        if (sourceBurf.status !== RequisitionStatus.READY_FOR_PRF) {
          throw new Error(`Cannot create PRF from BURF in status: ${sourceBurf.status}. Expected READY_FOR_PRF.`);
        }

        // Step B: Split items
        console.log('[createBatchPrfFromBurf] Step B: Splitting items...');
        const selectedItemIds = new Set(selectedItems.map(item => item.itemId));
        const remainingItems = sourceBurf.items.filter(item => !selectedItemIds.has(item.itemId));
        remainingItemsCount = remainingItems.length;
        console.log(`[createBatchPrfFromBurf] Step B complete. Selected: ${selectedItems.length}, Remaining: ${remainingItemsCount}`);

        // Determine new status for source BURF
        sourceBurfNewStatus = remainingItems.length === 0
          ? RequisitionStatus.BURF_COMPLETED
          : RequisitionStatus.READY_FOR_PRF;

        // Step C: Create new PRF document
        console.log('[createBatchPrfFromBurf] Step C: Creating PRF document...');
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
          projectName: sourceBurf.projectName || '', // Fallback to prevent undefined
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
        console.log('[createBatchPrfFromBurf] Step D: Creating history entries...');
        const burfHistoryEntry: RequisitionHistory = {
          date: new Date().toISOString(),
          actorId: userId,
          actorName: userName,
          action: remainingItems.length === 0 ? 'Fully Converted to PRF' : 'Partial PRF Created',
          stage: sourceBurfNewStatus,
          comments: `${selectedItems.length} items moved to ${newPrfId}. ${remainingItems.length} items remaining.`,
        };
        const updatedBurfHistory = [burfHistoryEntry, ...(sourceBurf.history || [])];

        // Step E: Write operations (atomic within transaction)
        console.log('[createBatchPrfFromBurf] Step E: Writing to Firestore...');
        const newPrfRef = doc(db, REQUISITIONS_COLLECTION, newPrfId);
        // Sanitize the PRF object to remove any undefined values before writing
        const sanitizedPrf = removeUndefinedFields(newPrf);
        transaction.set(newPrfRef, sanitizedPrf);
        console.log('[createBatchPrfFromBurf] Step E1: PRF document set');

        transaction.update(sourceBurfRef, {
          items: remainingItems,
          totalAmount: remainingItems.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0),
          status: sourceBurfNewStatus,
          history: updatedBurfHistory,
          updatedAt: serverTimestamp(),
        });
        console.log('[createBatchPrfFromBurf] Step E2: BURF document updated');
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
}
