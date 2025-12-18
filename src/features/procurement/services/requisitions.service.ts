import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { Requisition, RequisitionHistory, RequisitionItem, SupplierDetails, CostAllocation } from '../types';
import { RequisitionStatus, UserRole, hasGlobalAccess } from '../types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import { removeUndefinedFields } from '../../../shared/utils/firestore.utils';
import { SettingsService, type ApproverAssignments } from '../../../shared/services/settings.service';
import { NotificationsService } from '../../../shared/services/notifications.service';

const REQUISITIONS_COLLECTION = COLLECTIONS.REQUISITIONS;

/**
 * Threshold amount for requiring GM PRF approval step
 */
const GM_PRF_THRESHOLD = 50000;

/**
 * Calculate expense allocation for a given business unit and total amount
 * Returns the allocation breakdown if a rule exists and is enabled, otherwise undefined
 * 
 * @param businessId - The source business unit ID (Head Office)
 * @param totalAmount - The total amount to be allocated
 * @returns Array of CostAllocation if rule exists, undefined otherwise
 */
export async function calculateExpenseAllocation(
  businessId: string,
  totalAmount: number
): Promise<CostAllocation[] | undefined> {
  try {
    const rule = await SettingsService.getAllocationRuleForBu(businessId);

    if (!rule || !rule.isEnabled || rule.allocations.length === 0) {
      return undefined;
    }

    // Calculate allocation for each target BU
    const allocations: CostAllocation[] = rule.allocations.map(alloc => ({
      buId: alloc.targetBuId,
      buName: alloc.targetBuName,
      percentage: alloc.percentage,
      amount: Math.round((totalAmount * alloc.percentage / 100) * 100) / 100 // Round to 2 decimal places
    }));

    return allocations;
  } catch (error) {
    console.error('[calculateExpenseAllocation] Error:', error);
    return undefined;
  }
}

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
 * Determines the next workflow status based on current status and amount
 * Implements the 8-stage PRF approval chain with 50k conditional logic
 * 
 * PRF Workflow:
 * Step 1: PRF_PENDING_MANAGER (BUM Approval - permission based)
 * Step 2: PENDING_GM_PRF_APPROVAL (if amount >= 50k, GM checks PRF details)
 * Step 3: PENDING_FINANCE_HEAD_BR_APPROVAL (Finance Head Budget Review - BU-specific)
 * Step 4: PENDING_GM_BR_APPROVAL (GM Final Budget Approval)
 * Step 5: PENDING_BOD_APPROVAL (BOD Approval - Any BOD approver)
 * Step 6: FOR_CHECK_PREPARATION (Finance uploads check number + link)
 * Step 7: PENDING_CHECK_AUTH_BOD (BOD Check Authorization)
 * Step 8: FOR_FUND_RELEASE (Ready for Fund Release)
 * Final: FUNDS_RELEASED
 * 
 * @param currentStatus - The current status of the requisition
 * @param amount - The total amount of the requisition (for 50k conditional)
 * @returns The next status or null if no transition available
 */
function determineNextPrfStatus(
  currentStatus: RequisitionStatus,
  amount: number
): RequisitionStatus | null {
  switch (currentStatus) {
    // Step 1 → Step 2 (if >= 50k) or Step 3 (if < 50k)
    case RequisitionStatus.PRF_PENDING_MANAGER:
      return amount >= GM_PRF_THRESHOLD
        ? RequisitionStatus.PENDING_GM_PRF_APPROVAL
        : RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL;

    // Step 2 → Step 3
    case RequisitionStatus.PENDING_GM_PRF_APPROVAL:
      return RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL;

    // Step 3 → Step 4
    case RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL:
      return RequisitionStatus.PENDING_GM_BR_APPROVAL;

    // Step 4 → Step 5 (BOD Approval)
    case RequisitionStatus.PENDING_GM_BR_APPROVAL:
      return RequisitionStatus.PENDING_BOD_APPROVAL;

    // Step 5 → Step 6 (Check Preparation by Finance)
    case RequisitionStatus.PENDING_BOD_APPROVAL:
      return RequisitionStatus.FOR_CHECK_PREPARATION;

    // Step 6 → Step 7 (BOD Check Authorization)
    case RequisitionStatus.FOR_CHECK_PREPARATION:
      return RequisitionStatus.PENDING_CHECK_AUTH_BOD;

    // Step 7 → Step 8 (Fund Release)
    case RequisitionStatus.PENDING_CHECK_AUTH_BOD:
      return RequisitionStatus.FOR_FUND_RELEASE;

    // Step 8 → Complete
    case RequisitionStatus.FOR_FUND_RELEASE:
      return RequisitionStatus.FUNDS_RELEASED;

    // Legacy statuses - handle gracefully
    case RequisitionStatus.APPROVED_FOR_PAYMENT:
      return RequisitionStatus.FUNDS_RELEASED;

    // Legacy CFO approval - skip to BOD approval
    case RequisitionStatus.PENDING_CFO_APPROVAL:
      return RequisitionStatus.PENDING_BOD_APPROVAL;

    default:
      return null;
  }
}

/**
 * Gets the approver UID for a given status based on approver assignments
 * For BU-specific roles (Finance Head), looks up by businessId
 * For multi-user roles (BOD), returns first approver UID (any can approve)
 * 
 * @param nextStatus - The next status the requisition is moving to
 * @param assignments - The approver assignments from settings
 * @param businessId - The business unit ID for BU-specific lookup (optional)
 * @returns The UID of the approver for this status, or undefined if permission-based
 */
function getApproverIdForStatus(
  nextStatus: RequisitionStatus,
  assignments: ApproverAssignments,
  businessId?: string
): string | undefined {
  switch (nextStatus) {
    case RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL:
      // BU-specific: Find the finance head that handles this business unit
      if (businessId && assignments.financeHeads) {
        const financeHead = assignments.financeHeads.find(fh =>
          fh.businessUnitIds.includes(businessId)
        );
        return financeHead?.userId;
      }
      // Fallback to first finance head if no BU match
      return assignments.financeHeads?.[0]?.userId;

    case RequisitionStatus.PENDING_GM_PRF_APPROVAL:
    case RequisitionStatus.PENDING_GM_BR_APPROVAL:
      return assignments.gmUid;

    // Legacy CFO status - return CFO UID for backward compatibility
    case RequisitionStatus.PENDING_CFO_APPROVAL:
      return assignments.cfoUid;

    // Step 5: BOD Approval (any BOD approver)
    case RequisitionStatus.PENDING_BOD_APPROVAL:
      // Multiple approvers - return first one for currentApproverId
      // Dashboard filtering will check if current user is in the array
      return assignments.bodApprovers?.[0]?.userId;

    // Step 6: Check Preparation - permission-based (Finance role)
    case RequisitionStatus.FOR_CHECK_PREPARATION:
      return undefined; // Finance users see this via permission, not assignment

    // Step 7: BOD Check Authorization (any BOD approver)
    case RequisitionStatus.PENDING_CHECK_AUTH_BOD:
      return assignments.bodApprovers?.[0]?.userId;

    // For permission-based statuses, return undefined
    case RequisitionStatus.PRF_PENDING_MANAGER:
    case RequisitionStatus.BURF_PENDING_MANAGER:
    case RequisitionStatus.BURF_PENDING_CIC:
    case RequisitionStatus.FOR_FUND_RELEASE:
    default:
      return undefined;
  }
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

    try {
      const sourceBurfRef = doc(db, REQUISITIONS_COLLECTION, sourceBurfId);

      // Pre-calculate values needed inside transaction
      // Calculate total amount from selected items
      const calculatedTotalAmount = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Step 0: Pre-fetch expense allocation rule (can't call async in transaction)
      // Use sourceBusinessId from params if available, otherwise we'll get it from BURF inside transaction
      let expenseAllocation: CostAllocation[] | undefined = undefined;
      if (params.sourceBusinessId) {
        expenseAllocation = await calculateExpenseAllocation(params.sourceBusinessId, calculatedTotalAmount);
      }

      // Step 1: Run transaction for atomic create + update + ID generation
      let sourceBurfNewStatus: RequisitionStatus = RequisitionStatus.READY_FOR_PRF;
      let remainingItemsCount = 0;
      let newPrfId = '';

      await runTransaction(db, async (transaction) => {
        // Step A: Read the current state of the source BURF
        const sourceBurfSnap = await transaction.get(sourceBurfRef);
        if (!sourceBurfSnap.exists()) {
          throw new Error(`Source BURF ${sourceBurfId} not found`);
        }

        const sourceBurf = { id: sourceBurfSnap.id, ...sourceBurfSnap.data() } as Requisition;

        // Validate source BURF is in a status that allows PRF creation
        const allowedStatuses = [
          RequisitionStatus.READY_FOR_PRF,
          RequisitionStatus.BURF_PARTIALLY_PROCESSED
        ];
        if (!allowedStatuses.includes(sourceBurf.status)) {
          throw new Error(`Cannot create PRF from BURF in status: ${sourceBurf.status}. Expected READY_FOR_PRF or BURF_PARTIALLY_PROCESSED.`);
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

        // FIX: Check against already converted items, not removed items
        const alreadyConverted = (sourceBurf as any).convertedItemIds || [];
        const alreadyConvertedSet = new Set(alreadyConverted);

        // Validate selected items exist and are not already converted
        const invalidItems = selectedItems.filter(item =>
          !sourceItemMap.has(item.itemId) || alreadyConvertedSet.has(item.itemId)
        );

        if (invalidItems.length > 0) {
          const invalidNames = invalidItems.map(i => i.name).join(', ');
          throw new Error(`Critical Error: Some items have already been converted or don't exist: ${invalidNames}. Please refresh and try again.`);
        }

        // Step B: Track converted items (don't remove from array - preserve for history)
        const selectedItemIds = new Set(selectedItems.map(item => item.itemId));
        const newConvertedItemIds = [...alreadyConverted, ...selectedItems.map(i => i.itemId)];

        // Calculate remaining (unconverted) items count
        const unconvertedItems = sourceBurf.items.filter(item =>
          !selectedItemIds.has(item.itemId) && !alreadyConvertedSet.has(item.itemId)
        );
        remainingItemsCount = unconvertedItems.length;

        // Determine new status for source BURF
        // BURF_COMPLETED if all items consumed, BURF_PARTIALLY_PROCESSED if items remain
        const isFullyConsumed = remainingItemsCount === 0;
        sourceBurfNewStatus = isFullyConsumed
          ? RequisitionStatus.BURF_COMPLETED
          : RequisitionStatus.BURF_PARTIALLY_PROCESSED;

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
          isUrgent: sourceBurf.isUrgent || false, // Persist urgency flag through lifecycle
          priority: sourceBurf.priority || 'NORMAL',
          attachments: sourceBurf.attachments || [],
          parentBurfId: sourceBurfId,
          // Corporate Expense Sharing: Include allocation if rule exists
          ...(expenseAllocation && { costAllocation: expenseAllocation }),
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
        const burfNowISO = new Date().toISOString();
        const burfHistoryEntry: RequisitionHistory = {
          date: burfNowISO.split('T')[0], // Legacy: date only
          timestamp: burfNowISO, // Full ISO timestamp with time
          actorId: userId,
          actorName: userName,
          action: isFullyConsumed ? 'Fully Converted to PRF' : 'Partial PRF Created',
          stage: sourceBurfNewStatus,
          comments: `${selectedItems.length} items moved to ${newPrfId}. ${remainingItemsCount} items remaining.`,
        };
        const updatedBurfHistory = [burfHistoryEntry, ...(sourceBurf.history || [])];

        // Step E: Write operations
        const newPrfRef = doc(db, REQUISITIONS_COLLECTION, newPrfId);
        const sanitizedPrf = removeUndefinedFields(newPrf);

        // 1. Create new PRF
        transaction.set(newPrfRef, sanitizedPrf);

        // 2. Update Source BURF - PRESERVE items array, only update convertedItemIds
        // This keeps the original items for historical viewing
        transaction.update(sourceBurfRef, {
          // items: DO NOT UPDATE - preserve original items for history
          convertedItemIds: newConvertedItemIds, // Track which items have been converted
          status: sourceBurfNewStatus,
          history: updatedBurfHistory,
          updatedAt: serverTimestamp(),
          batchCounter: nextBatchCount // Increment atomic counter
        });
      });

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

    const nowISO = new Date().toISOString();
    const newHistoryEntry: RequisitionHistory = {
      date: nowISO.split('T')[0], // Legacy: date only (YYYY-MM-DD)
      timestamp: nowISO, // New: Full ISO timestamp with time
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
   * Updated for 7-stage PRF workflow with conditional 50k logic
   * FIX H2: Uses transaction to prevent race conditions when multiple approvers click simultaneously
   */
  static async approveRequisition(
    requisitionId: string,
    userId: string,
    userName: string,
    comments?: string
  ): Promise<void> {
    const docRef = doc(db, REQUISITIONS_COLLECTION, requisitionId);

    // Fetch approver assignments for currentApproverId routing
    const approverAssignments = await SettingsService.getApproverAssignments();

    // FIX H2: Use transaction for atomic read-modify-write (was separate read/write causing race conditions)
    const transactionResult = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) throw new Error('Requisition not found');

      const requisition = { id: snap.id, ...snap.data() } as Requisition;
      let nextStatus: RequisitionStatus | null = null;
      let currentApproverId: string | undefined = undefined;
      const approvalAction = 'Approved';

      // Determine next status based on current status
      switch (requisition.status) {
        // BURF Workflow (unchanged)
        case RequisitionStatus.BURF_PENDING_MANAGER:
          nextStatus = RequisitionStatus.BURF_PENDING_CIC;
          break;
        case RequisitionStatus.BURF_PENDING_CIC:
          nextStatus = RequisitionStatus.READY_FOR_PRF;
          break;

        // PRF 8-Stage Workflow - use helper function
        case RequisitionStatus.PRF_PENDING_MANAGER:
        case RequisitionStatus.PENDING_GM_PRF_APPROVAL:
        case RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL:
        case RequisitionStatus.PENDING_GM_BR_APPROVAL:
        case RequisitionStatus.PENDING_BOD_APPROVAL:
        case RequisitionStatus.FOR_CHECK_PREPARATION:
        case RequisitionStatus.PENDING_CHECK_AUTH_BOD:
        case RequisitionStatus.FOR_FUND_RELEASE:
        case RequisitionStatus.PENDING_CFO_APPROVAL: // Legacy support
        case RequisitionStatus.APPROVED_FOR_PAYMENT: // Legacy support
          nextStatus = determineNextPrfStatus(requisition.status, requisition.totalAmount);
          break;

        default:
          throw new Error(`Cannot approve requisition in status: ${requisition.status}`);
      }

      if (nextStatus) {
        // Get the currentApproverId for the next status (for dashboard filtering)
        // Pass businessId for BU-specific Finance Head lookup
        currentApproverId = getApproverIdForStatus(nextStatus, approverAssignments, requisition.businessId);

        // Create history entry inline (can't call async methods in transaction)
        const approveNowISO = new Date().toISOString();
        const historyEntry: RequisitionHistory = {
          date: approveNowISO.split('T')[0], // Legacy: date only
          timestamp: approveNowISO, // Full ISO timestamp with time
          actorId: userId,
          actorName: userName,
          action: approvalAction,
          stage: nextStatus,
          ...(comments !== undefined && { comments }),
        };

        const updatedHistory = [historyEntry, ...(requisition.history || [])];

        // Build update object
        const updateData: Record<string, unknown> = {
          status: nextStatus,
          history: updatedHistory,
          updatedAt: serverTimestamp(),
        };

        // Set currentApproverId if we have one (for dashboard filtering)
        if (currentApproverId) {
          updateData.currentApproverId = currentApproverId;
        } else {
          // Clear it for permission-based stages
          updateData.currentApproverId = null;
        }

        // Atomic update within transaction
        transaction.update(docRef, updateData);

        // Return data needed for notification (can't call async inside transaction)
        return {
          nextStatus,
          currentApproverId,
          requisitionId,
          description: requisition.description || requisition.projectName || 'Requisition',
          totalAmount: requisition.totalAmount,
        };
      }
      return null;
    });

    // Create notification AFTER transaction completes (for next approver)
    if (transactionResult && transactionResult.currentApproverId) {
      const statusLabels: Record<RequisitionStatus, string> = {
        [RequisitionStatus.PENDING_GM_PRF_APPROVAL]: 'GM PRF Review (≥₱50k)',
        [RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL]: 'Finance Head Budget Review',
        [RequisitionStatus.PENDING_GM_BR_APPROVAL]: 'GM Budget Approval',
        [RequisitionStatus.PENDING_CFO_APPROVAL]: 'CFO Approval', // Legacy
        [RequisitionStatus.PENDING_BOD_APPROVAL]: 'BOD Approval',
        [RequisitionStatus.FOR_CHECK_PREPARATION]: 'Check Preparation',
        [RequisitionStatus.PENDING_CHECK_AUTH_BOD]: 'Check Authorization',
        [RequisitionStatus.FOR_FUND_RELEASE]: 'Fund Release',
      } as Record<RequisitionStatus, string>;

      const label = statusLabels[transactionResult.nextStatus] || transactionResult.nextStatus.replace(/_/g, ' ');

      try {
        await NotificationsService.createNotification({
          type: 'PRF',
          message: `${transactionResult.requisitionId} requires your ${label}. Amount: ₱${transactionResult.totalAmount?.toLocaleString()}`,
          requisitionId: transactionResult.requisitionId,
          targetRoles: [transactionResult.currentApproverId], // Target the specific approver's UID
        });
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
        // Don't throw - approval succeeded, notification failed is non-critical
      }
    }
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
      const nowISO = new Date().toISOString();
      const historyEntry: RequisitionHistory = {
        date: nowISO.split('T')[0], // Legacy: date only
        timestamp: nowISO, // Full ISO timestamp with time
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
      const liquidationNowISO = new Date().toISOString();
      const historyEntry: RequisitionHistory = {
        date: liquidationNowISO.split('T')[0], // Legacy: date only
        timestamp: liquidationNowISO, // Full ISO timestamp with time
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
   * 
   * PCF Replenishment Lifecycle:
   * - PCF Replenishments do NOT need liquidation (receipts already submitted)
   * - When funds are released, PCF Replenishments go directly to COMPLETED status
   */
  static async releaseFundsWithPcfUpdate(
    requisitionId: string,
    checkVoucherNumber: string,
    checkVoucherLink?: string,
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

      // Determine final status based on requisition type
      // PCF Replenishments (have linkedPcfId): AUDITED_CLEARED (no liquidation needed)
      // Standard PRFs: FUNDS_RELEASED (needs liquidation)
      const isPcfReplenishment = !!requisition.linkedPcfId;
      const finalStatus = isPcfReplenishment
        ? RequisitionStatus.AUDITED_CLEARED
        : RequisitionStatus.FUNDS_RELEASED;

      // Build history entry
      const fundReleaseNowISO = new Date().toISOString();
      const historyEntry: RequisitionHistory = {
        date: fundReleaseNowISO.split('T')[0], // Legacy: date only
        timestamp: fundReleaseNowISO, // Full ISO timestamp with time
        actorId: userId || 'system',
        actorName: userName || 'Finance',
        action: isPcfReplenishment ? 'AUDITED_CLEARED' : 'FUNDS_RELEASED',
        stage: finalStatus,
        comments: isPcfReplenishment
          ? `Voucher #${checkVoucherNumber} released - PCF Replenishment complete (no liquidation required)`
          : `Voucher #${checkVoucherNumber} released`,
      };

      const updatedHistory = [historyEntry, ...(requisition.history || [])];

      // Step 1: Update the PRF status
      // Save to new fields (checkVoucherNumber/checkVoucherLink) and legacy fields for compatibility
      transaction.update(docRef, {
        status: finalStatus,
        // New fields
        checkVoucherNumber: checkVoucherNumber,
        checkVoucherLink: checkVoucherLink || '',
        // Legacy fields (for backward compatibility with existing views)
        chequeNumber: checkVoucherNumber,
        chequeImageUrl: checkVoucherLink || '',
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

  /**
   * Upload check details for Check Preparation step (Step 6)
   * Finance uploads check number and Google Drive link
   * Advances workflow to PENDING_CHECK_AUTH_BOD
   */
  static async uploadCheckForPreparation(
    requisitionId: string,
    chequeNumber: string,
    chequeImageUrl: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const docRef = doc(db, REQUISITIONS_COLLECTION, requisitionId);

    // Fetch approver assignments for routing to BOD
    const approverAssignments = await SettingsService.getApproverAssignments();

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) throw new Error('Requisition not found');

      const requisition = { id: snap.id, ...snap.data() } as Requisition;

      // Verify status is FOR_CHECK_PREPARATION
      if (requisition.status !== RequisitionStatus.FOR_CHECK_PREPARATION) {
        throw new Error(`Cannot upload check for requisition in status: ${requisition.status}. Expected FOR_CHECK_PREPARATION.`);
      }

      const nextStatus = RequisitionStatus.PENDING_CHECK_AUTH_BOD;

      // Get BOD approver for routing
      const currentApproverId = getApproverIdForStatus(nextStatus, approverAssignments, requisition.businessId);

      // Create history entry
      const checkUploadNowISO = new Date().toISOString();
      const historyEntry: RequisitionHistory = {
        date: checkUploadNowISO.split('T')[0], // Legacy: date only
        timestamp: checkUploadNowISO, // Full ISO timestamp with time
        actorId: userId,
        actorName: userName,
        action: 'Bank Reference Added',
        stage: nextStatus,
        comments: `Bank Ref #${chequeNumber} added for authorization`,
      };

      const updatedHistory = [historyEntry, ...(requisition.history || [])];

      // Update requisition with bank ref details and advance status
      // Save to both new fields (bankRefNumber/bankRefLink) and legacy fields (chequeNumber/chequeImageUrl) for compatibility
      const updateData: Record<string, unknown> = {
        status: nextStatus,
        // New fields
        bankRefNumber: chequeNumber,
        bankRefLink: chequeImageUrl,
        // Legacy fields (for backward compatibility with existing views)
        chequeNumber: chequeNumber,
        chequeImageUrl: chequeImageUrl,
        history: updatedHistory,
        updatedAt: serverTimestamp(),
      };

      if (currentApproverId) {
        updateData.currentApproverId = currentApproverId;
      }

      transaction.update(docRef, updateData);
    });
  }
}
