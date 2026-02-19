import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { NotificationsService, NOTIFICATION_TYPES } from '../../../shared/services/notifications.service';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { Requisition, RequisitionItem, SupplierDetails } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import { CounterService } from '../../../shared/services/counter.service';
import { SettingsService } from '../../../shared/services/settings.service';

// =====================================================
// PCF STATUS ENUM
// =====================================================
export enum PCFStatus {
    DRAFT = 'DRAFT',
    AUDIT_REVIEW = 'AUDIT_REVIEW', // Pending Auditor Review (new step between Draft and Pending Approval)
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    APPROVED_WAITING_RELEASE = 'APPROVED_WAITING_RELEASE',
    REPLENISHED = 'REPLENISHED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
}

// =====================================================
// EXPENSE CLASSIFICATION OPTIONS
// =====================================================
export const EXPENSE_CLASSIFICATIONS = [
    'Transportation',
    'Meals',
    'Supplies',
    'Communications',
    'Utilities',
    'Repairs & Maintenance',
    'Professional Fees',
    'Others',
] as const;

export type ExpenseClassification = typeof EXPENSE_CLASSIFICATIONS[number];

// =====================================================
// PCF EXPENSE ITEM - 10 AUDIT COLUMNS
// =====================================================
export interface PCFExpenseItem {
    id: string;
    date: string;                         // Column 1: Date
    payeeVendor: string;                  // Column 2: Payee | Vendor
    tin: string;                          // Column 3: TIN (optional)
    orNo: string;                         // Column 4: OR No. (required)
    completeAddress: string;              // Column 5: Complete Address
    // COA Fields (new) - replaces classification
    coaCode?: string;                     // Column 6: COA Account Code
    coaName?: string;                     // Column 6: COA Account Name
    classification?: ExpenseClassification; // Column 6: Legacy classification (deprecated)
    itemDescription: string;              // Column 7: Item Description
    vat: number;                          // Column 8: VAT Amount
    ewt: number;                          // Column 9: EWT Amount
    amount: number;                       // Column 10: Total Expense Amount
    buId?: string;                        // Business Unit ID (for expense sharing)
    buName?: string;                      // Business Unit Name
}

// =====================================================
// PCF LIQUIDATION INTERFACE
// =====================================================
// Audit note entry for tracking history of audit actions in PCF
export interface PCFAuditNoteEntry {
    id: string;                 // Unique ID for the note
    action: 'REJECTED' | 'CLEARED' | 'REFILE' | 'COMMENT' | 'AUDIT_REVIEW' | 'APPROVED';  // The action taken
    note: string;               // The auditor's note/reason
    actorId: string;            // Who performed the action
    actorName: string;          // Name of the actor
    timestamp: string;          // When the action was taken (ISO 8601)
}

export interface PCFLiquidation {
    id: string;
    userId: string;
    userName: string;
    businessId: string;
    expenses: PCFExpenseItem[];
    totalAmount: number;
    totalVat: number;
    totalEwt: number;
    netAmount: number;                    // totalAmount - totalEwt + totalVat (or your formula)
    receiptsLink?: string;
    attachments?: string[];
    remarks?: string;
    status: PCFStatus;
    dateCreated: string;
    dateSubmitted?: string;
    dateApproved?: string;
    approvedBy?: string;
    approvedByName?: string;
    rejectedBy?: string;
    rejectedByName?: string;
    rejectionReason?: string;
    // Cancellation fields
    cancelledBy?: string;
    cancelledByName?: string;
    cancellationReason?: string;
    dateCancelled?: string;
    replenishmentPrfId?: string;
    // Audit Review tracking (new)
    auditReviewedBy?: string;
    auditReviewedByName?: string;
    dateAuditReviewed?: string;
    auditRemarks?: string;        // Auditor's remarks when approving the liquidation
    auditClearedAt?: string;      // Timestamp when audit was cleared/approved
    // Audit Notes History - accumulates all audit actions
    auditNotesHistory?: PCFAuditNoteEntry[];
    // Late submission tracking
    isLate?: boolean;
    daysLate?: number;
    deadlineDay?: number;  // The deadline that was active at time of submission
    expenseMonth?: number; // The month (0-11) the expenses are for
}

const PCF_COLLECTION = 'pcf_liquidations';
const REQUISITIONS_COLLECTION = COLLECTIONS.REQUISITIONS;

// =====================================================
// PCF SERVICE CLASS
// =====================================================
export class PCFService {
    /**
     * Get all liquidations for a specific user
     */
    static async getUserLiquidations(userId: string): Promise<PCFLiquidation[]> {
        const liquidations = await FirestoreService.getDocuments<PCFLiquidation>(
            PCF_COLLECTION,
            [where('userId', '==', userId)]
        );
        return liquidations.sort((a, b) =>
            new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
        );
    }

    /**
     * Get all liquidations from all users (for pcf:view:all permission)
     */
    static async getAllLiquidations(): Promise<PCFLiquidation[]> {
        const liquidations = await FirestoreService.getDocuments<PCFLiquidation>(
            PCF_COLLECTION,
            []
        );
        return liquidations.sort((a, b) =>
            new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
        );
    }

    /**
     * Get all pending liquidations (for manager approval view)
     */
    static async getPendingLiquidations(): Promise<PCFLiquidation[]> {
        const liquidations = await FirestoreService.getDocuments<PCFLiquidation>(
            PCF_COLLECTION,
            [where('status', '==', PCFStatus.PENDING_APPROVAL)]
        );
        return liquidations.sort((a, b) =>
            new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
        );
    }

    /**
     * Get active liquidations (DRAFT, PENDING_APPROVAL, APPROVED, APPROVED_WAITING_RELEASE)
     * These are liquidations that haven't been replenished yet
     */
    static async getActiveLiquidations(userId: string): Promise<PCFLiquidation[]> {
        const allLiquidations = await this.getUserLiquidations(userId);
        const activeStatuses = [
            PCFStatus.DRAFT,
            PCFStatus.AUDIT_REVIEW,
            PCFStatus.PENDING_APPROVAL,
            PCFStatus.APPROVED,
            PCFStatus.APPROVED_WAITING_RELEASE,
        ];
        return allLiquidations.filter(l => activeStatuses.includes(l.status));
    }

    /**
     * SAFETY NET: Calculate Cash On Hand
     * CashOnHand = UserCeiling - Sum(All Active Liquidations)
     */
    static async calculateCashOnHand(userId: string, pcfCeiling: number): Promise<{
        cashOnHand: number;
        activeLiquidationsTotal: number;
        activeLiquidationsCount: number;
    }> {
        const activeLiquidations = await this.getActiveLiquidations(userId);
        const activeLiquidationsTotal = activeLiquidations.reduce((sum, l) => sum + l.totalAmount, 0);
        const cashOnHand = Math.max(0, pcfCeiling - activeLiquidationsTotal);

        return {
            cashOnHand,
            activeLiquidationsTotal,
            activeLiquidationsCount: activeLiquidations.length,
        };
    }

    /**
     * Submit a new PCF Liquidation with the 10-column expense structure
     * Checks against configured deadline and marks as late if submitted after deadline
     * 
     * DEADLINE LOGIC: Expenses from Month X are due by Day Y of Month X+1
     * Example: November expenses → due by December 5th
     */
    static async submitLiquidation(
        userId: string,
        userName: string,
        businessId: string,
        expenses: PCFExpenseItem[],
        receiptsLink?: string,
        attachments?: string[],
        remarks?: string
    ): Promise<string> {
        // Calculate totals
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalVat = expenses.reduce((sum, e) => sum + e.vat, 0);
        const totalEwt = expenses.reduce((sum, e) => sum + e.ewt, 0);
        const netAmount = totalAmount - totalEwt + totalVat;

        // Check deadline for late submission based on EXPENSE DATES
        const settings = await SettingsService.getPcfSettings();
        const submissionDate = new Date();

        // Extract expense dates for deadline calculation
        const expenseDates = expenses.map(e => e.date).filter(Boolean);
        const { isLate, daysLate, expenseMonth } = SettingsService.calculateLatenessFromExpenses(
            submissionDate,
            expenseDates,
            settings.deadlineDay
        );

        const newLiquidation: Omit<PCFLiquidation, 'id'> = {
            userId,
            userName,
            businessId,
            expenses,
            totalAmount,
            totalVat,
            totalEwt,
            netAmount,
            receiptsLink: receiptsLink || '',
            attachments: attachments || [],
            remarks: remarks || '',
            status: PCFStatus.AUDIT_REVIEW, // Submit for audit review first
            dateCreated: new Date().toISOString(),
            dateSubmitted: new Date().toISOString(),
            // Late submission tracking
            isLate,
            daysLate: isLate ? daysLate : 0,
            deadlineDay: settings.deadlineDay,
            expenseMonth: expenseMonth, // Store which month these expenses are for
        };

        const docId = await FirestoreService.createDocument(PCF_COLLECTION, newLiquidation);

        // NOTIFICATION: Notify Auditors of new PCF
        try {
            await NotificationsService.notifyAuditorOnNewItem(
                'PCF',
                docId,
                userName,
                totalAmount
            );
        } catch (error) {
            console.error('Failed to create PCF notification:', error);
        }

        return docId;
    }

    /**
     * Create a draft liquidation (for saving without submitting)
     */
    static async createDraftLiquidation(
        userId: string,
        userName: string,
        businessId: string,
        expenses: PCFExpenseItem[],
        receiptsLink?: string,
        remarks?: string
    ): Promise<string> {
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalVat = expenses.reduce((sum, e) => sum + e.vat, 0);
        const totalEwt = expenses.reduce((sum, e) => sum + e.ewt, 0);
        const netAmount = totalAmount - totalEwt + totalVat;

        const newLiquidation: Omit<PCFLiquidation, 'id'> = {
            userId,
            userName,
            businessId,
            expenses,
            totalAmount,
            totalVat,
            totalEwt,
            netAmount,
            receiptsLink: receiptsLink || '',
            attachments: [],
            remarks: remarks || '',
            status: PCFStatus.DRAFT,
            dateCreated: new Date().toISOString(),
        };

        const docId = await FirestoreService.createDocument(PCF_COLLECTION, newLiquidation);
        return docId;
    }

    /**
     * Submit a draft for approval
     * FIX: Now includes late submission check based on expense dates
     */
    static async submitForApproval(liquidationId: string): Promise<void> {
        // Fetch the draft to get expense dates
        const liquidation = await this.getLiquidationById(liquidationId);
        if (!liquidation) {
            throw new Error('Liquidation not found');
        }

        // Check deadline for late submission based on expense dates
        const settings = await SettingsService.getPcfSettings();
        const submissionDate = new Date();
        const expenseDates = liquidation.expenses.map(e => e.date).filter(Boolean);
        const { isLate, daysLate, expenseMonth } = SettingsService.calculateLatenessFromExpenses(
            submissionDate,
            expenseDates,
            settings.deadlineDay
        );

        await FirestoreService.updateDocument(PCF_COLLECTION, liquidationId, {
            status: PCFStatus.AUDIT_REVIEW,
            dateSubmitted: new Date().toISOString(),
            isLate,
            daysLate: isLate ? daysLate : 0,
            deadlineDay: settings.deadlineDay,
            expenseMonth,
        });

        // NOTIFICATION: Notify Auditor (`AUDIT_REVIEW` status)
        try {
            await NotificationsService.createNotification({
                ...NOTIFICATION_TYPES.LIQUIDATION_FILED, // Or LIQUIDATION_READY_FOR_AUDIT if preferred
                type: 'AUDIT',
                subType: 'PENDING_ACTION',
                message: `New PCF Liquidation Filed: #${liquidationId.slice(-6)} by ${liquidation.userName}`,
                requisitionId: liquidationId,
                targetRoles: ['AUDITOR'],
                actionUrl: `/pcf-audit-review`,
                metadata: {
                    requisitionNumber: liquidationId.slice(-6),
                    requesterName: liquidation.userName,
                    amount: liquidation.totalAmount,
                    stage: 'Audit Review'
                }
            });
        } catch (error) {
            console.error('Failed to create auditor notification for PCF:', error);
        }
    }

    /**
     * Approve audit review - moves liquidation to PENDING_APPROVAL for manager
     * Only authorized auditors can perform this action
     */
    static async approveAuditReview(
        liquidationId: string,
        auditorId: string,
        auditorName: string,
        auditRemarks?: string
    ): Promise<void> {
        const liquidation = await this.getLiquidationById(liquidationId);
        if (!liquidation) {
            throw new Error('Liquidation not found');
        }
        if (liquidation.status !== PCFStatus.AUDIT_REVIEW) {
            throw new Error(`Cannot approve audit review: Liquidation is in ${liquidation.status} status`);
        }

        // Create audit note entry for history
        const auditNoteEntry: PCFAuditNoteEntry = {
            id: `audit-${Date.now()}`,
            action: 'CLEARED',
            note: auditRemarks || 'Audit review approved',
            actorId: auditorId,
            actorName: auditorName,
            timestamp: new Date().toISOString()
        };

        // Append to existing history or create new array
        const existingHistory = liquidation.auditNotesHistory || [];

        await FirestoreService.updateDocument(PCF_COLLECTION, liquidationId, {
            status: PCFStatus.PENDING_APPROVAL,
            auditReviewedBy: auditorId,
            auditReviewedByName: auditorName,
            dateAuditReviewed: new Date().toISOString(),
            auditRemarks: auditRemarks || '',
            auditClearedAt: new Date().toISOString(),
            auditNotesHistory: [...existingHistory, auditNoteEntry]
        });

        // NOTIFICATION: Notify Manager of PCF ready for approval
        try {
            await NotificationsService.createNotification({
                ...NOTIFICATION_TYPES.PENDING_APPROVAL,
                message: `PCF Liquidation #${liquidationId.slice(-6)} audited and ready for approval`,
                requisitionId: liquidationId,
                targetRoles: ['MANAGER'], // Target generic MANAGER role
                actionUrl: `/pcf-approvals`, // Use dedicated approvals view
                metadata: {
                    requisitionNumber: liquidationId.slice(-6),
                    requesterName: liquidation.userName,
                    amount: liquidation.totalAmount,
                    stage: 'Manager Approval'
                }
            });
        } catch (error) {
            console.error('Failed to create manager notification for PCF:', error);
        }
    }

    /**
     * Get all liquidations pending audit review (for auditor view)
     */
    static async getAuditReviewLiquidations(): Promise<PCFLiquidation[]> {
        const liquidations = await FirestoreService.getDocuments<PCFLiquidation>(
            PCF_COLLECTION,
            [where('status', '==', PCFStatus.AUDIT_REVIEW)]
        );
        return liquidations.sort((a, b) =>
            new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
        );
    }

    /**
     * FAST TRACK: Approve and Auto-Create PRF
     * 1. Update PCF status to APPROVED_WAITING_RELEASE
     * 2. Auto-create PRF with status: APPROVED (skips approval queue)
     */
    static async approveAndReplenish(
        liquidationId: string,
        approverId: string,
        approverName: string,
        businessId: string,
        custodianName: string
    ): Promise<{ prfId: string }> {
        let newPrfId = '';

        await runTransaction(db, async (transaction) => {
            // Step 1: Get the liquidation
            const liquidationRef = doc(db, PCF_COLLECTION, liquidationId);
            const liquidationSnap = await transaction.get(liquidationRef);

            if (!liquidationSnap.exists()) {
                throw new Error('PCF Liquidation not found');
            }

            const liquidation = liquidationSnap.data() as PCFLiquidation;

            if (liquidation.status !== PCFStatus.PENDING_APPROVAL) {
                throw new Error(`Cannot approve: Liquidation is in ${liquidation.status} status`);
            }

            // Step 2: Generate PCF Replenishment ID (uses its own PCF-00001 sequence)
            newPrfId = await CounterService.getNextId('PCF');

            // Step 3: Create auto-approved PRF (FAST TRACK - skips manager approval)
            const prfRef = doc(db, REQUISITIONS_COLLECTION, newPrfId);

            // Build PRF items from PCF expenses
            // FIX: Use coaName || classification for backward compatibility
            const prfItems: RequisitionItem[] = liquidation.expenses.map((expense, index) => ({
                itemId: `pcf-${liquidationId}-${index}`,
                name: `${expense.coaName || expense.classification || 'Expense'}: ${expense.itemDescription}`,
                quantity: 1,
                uom: 'lot',
                price: expense.amount,
                stockOnHand: 0,
            }));

            const supplierDetails: SupplierDetails = {
                name: 'PCF Replenishment',
                tin: '',
                address: '',
                paymentMode: 'Cash',
                terms: 'Immediate',
            };

            const newPrf: Partial<Requisition> = {
                id: newPrfId,
                status: RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL, // Go through BR process
                businessId: businessId,
                description: `[PCF_REPLENISHMENT] PCF Replenishment for ${custodianName}`,
                remarks: `Auto-generated from PCF Liquidation ${liquidationId}. Approved by ${approverName}. Goes through BR process.`,
                items: prfItems,
                totalAmount: liquidation.totalAmount,
                requesterId: liquidation.userId,
                requesterName: liquidation.userName,
                dateCreated: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                // Link to parent PCF for auto-update when funds are released
                linkedPcfId: liquidationId,
                // Flag to skip liquidation after fund release (already liquidated via PCF)
                isPcfReplenishment: true,
                prfDetails: {
                    supplier: supplierDetails,
                    preparedBy: approverId,
                    preparedByName: approverName,
                    datePrepared: new Date().toISOString(),
                    timestamp: new Date().toISOString(),
                },
                history: [{
                    date: new Date().toISOString(),
                    actorId: approverId,
                    actorName: approverName,
                    action: 'PCF_REPLENISHMENT_CREATED',
                    comments: `Auto-created from PCF Liquidation approval. Routed through BR workflow.`,
                    stage: RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL,
                    timestamp: new Date().toISOString(),
                }],
            };

            transaction.set(prfRef, newPrf);

            // Step 4: Update PCF Status
            transaction.update(liquidationRef, {
                // The prompt says "Approve and Replenish", forcing creating PRF.
                // Logic says: "1. Update PCF status to APPROVED_WAITING_RELEASE" in comment, but effectively REPLENISHED if funds released?
                // Actually, let's stick to REPLENISHED if the PRF is created. Or closer to typical flow.
                // Given "Fast Track", let's assume REPLENISHED or APPROVED_WAITING_RELEASE.
                // Let's use APPROVED_WAITING_RELEASE as it waits for the PRF to be paid.
                status: PCFStatus.APPROVED_WAITING_RELEASE,
                dateApproved: new Date().toISOString(),
                approvedBy: approverId,
                approvedByName: approverName,
                replenishmentPrfId: newPrfId,
            });
        });

        // NOTIFICATION: Notify Custodian (Filer) that PCF is replenished/approved
        try {
            const liquidation = await this.getLiquidationById(liquidationId);
            if (liquidation) {
                await NotificationsService.createNotification({
                    ...NOTIFICATION_TYPES.LIQUIDATION_CLEARED,
                    message: `Your PCF Liquidation #${liquidationId.slice(-6)} has been approved. Replenishment PRF: #${newPrfId.slice(-6)}`,
                    requisitionId: liquidationId,
                    targetRoles: [liquidation.userId],
                    actionUrl: `/pcf`,
                    metadata: {
                        requisitionNumber: liquidationId.slice(-6),
                        amount: liquidation.totalAmount,
                        stage: 'Replenished'
                    }
                });
            }
        } catch (error) {
            console.error('Failed to notify custodian of PCF approval:', error);
        }

        return { prfId: newPrfId };
    }

    /**
     * Mark liquidation as replenished (after funds released)
     */
    static async markReplenished(liquidationId: string): Promise<void> {
        await FirestoreService.updateDocument(PCF_COLLECTION, liquidationId, {
            status: PCFStatus.REPLENISHED,
        });
    }

    /**
     * Reject a liquidation
     */
    static async rejectLiquidation(
        liquidationId: string,
        rejectedById: string,
        rejectedByName: string,
        reason: string
    ): Promise<void> {
        // Get existing liquidation to preserve history
        const liquidation = await this.getLiquidationById(liquidationId);

        // Create audit note entry for history
        const auditNoteEntry: PCFAuditNoteEntry = {
            id: `reject-${Date.now()}`,
            action: 'REJECTED',
            note: reason,
            actorId: rejectedById,
            actorName: rejectedByName,
            timestamp: new Date().toISOString()
        };

        // Append to existing history or create new array
        const existingHistory = liquidation?.auditNotesHistory || [];

        await FirestoreService.updateDocument(PCF_COLLECTION, liquidationId, {
            status: PCFStatus.REJECTED,
            rejectedBy: rejectedById,
            rejectedByName: rejectedByName,
            rejectionReason: reason,
            auditNotesHistory: [...existingHistory, auditNoteEntry]
        });

        // NOTIFICATION: Notify Custodian (Filer) of Rejection
        try {
            if (liquidation) {
                await NotificationsService.createNotification({
                    type: 'PCF',
                    subType: 'REJECTED',
                    message: `Your PCF Liquidation #${liquidationId.slice(-6)} was rejected. Reason: ${reason}`,
                    requisitionId: liquidationId,
                    targetRoles: [liquidation.userId],
                    actionUrl: `/pcf`,
                    priority: 'HIGH'
                });
            }
        } catch (error) {
            console.error('Failed to notify custodian of PCF rejection:', error);
        }
    }

    /**
     * Cancel a liquidation (returns amount to balance since CANCELLED is not in active statuses)
     */
    static async cancelLiquidation(
        liquidationId: string,
        cancelledById: string,
        cancelledByName: string,
        reason: string
    ): Promise<void> {
        await FirestoreService.updateDocument(PCF_COLLECTION, liquidationId, {
            status: PCFStatus.CANCELLED,
            cancelledBy: cancelledById,
            cancelledByName: cancelledByName,
            cancellationReason: reason,
            dateCancelled: new Date().toISOString(),
        });
    }

    /**
     * Get a single liquidation by ID
     */
    static async getLiquidationById(liquidationId: string): Promise<PCFLiquidation | null> {
        return await FirestoreService.getDocument<PCFLiquidation>(PCF_COLLECTION, liquidationId);
    }

    /**
     * Refile a rejected liquidation - resets to AUDIT_REVIEW
     * Clears rejection data and allows the user to submit again
     */
    static async refileLiquidation(
        liquidationId: string,
        expenses: PCFExpenseItem[],
        receiptsLink?: string,
        remarks?: string
    ): Promise<void> {
        // Calculate totals
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalVat = expenses.reduce((sum, e) => sum + e.vat, 0);
        const totalEwt = expenses.reduce((sum, e) => sum + e.ewt, 0);
        const netAmount = totalAmount - totalEwt + totalVat;

        // Get existing liquidation to preserve history
        const liquidation = await this.getLiquidationById(liquidationId);

        // Create audit note entry for refile action
        const auditNoteEntry: PCFAuditNoteEntry = {
            id: `refile-${Date.now()}`,
            action: 'REFILE',
            note: remarks || 'Liquidation refiled for approval',
            actorId: liquidation?.userId || '',
            actorName: liquidation?.userName || '',
            timestamp: new Date().toISOString()
        };

        // Append to existing history or create new array
        const existingHistory = liquidation?.auditNotesHistory || [];

        await FirestoreService.updateDocument(PCF_COLLECTION, liquidationId, {
            expenses,
            totalAmount,
            totalVat,
            totalEwt,
            netAmount,
            receiptsLink: receiptsLink || '',
            remarks: remarks || '',
            status: PCFStatus.AUDIT_REVIEW,
            dateSubmitted: new Date().toISOString(),
            // Clear rejection data
            rejectedBy: null,
            rejectedByName: null,
            rejectionReason: null,
            auditNotesHistory: [...existingHistory, auditNoteEntry]
        });

        // NOTIFICATION: Notify Auditors of Refiled PCF
        try {
            await NotificationsService.notifyAuditorOnNewItem(
                'PCF',
                liquidationId,
                liquidation?.userName,
                totalAmount
            );
        } catch (error) {
            console.error('Failed to create PCF refile notification:', error);
        }
    }

    /**
     * Update a draft liquidation
     */
    static async updateDraftLiquidation(
        liquidationId: string,
        expenses: PCFExpenseItem[],
        receiptsLink?: string,
        remarks?: string
    ): Promise<void> {
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalVat = expenses.reduce((sum, e) => sum + e.vat, 0);
        const totalEwt = expenses.reduce((sum, e) => sum + e.ewt, 0);
        const netAmount = totalAmount - totalEwt + totalVat;

        await FirestoreService.updateDocument(PCF_COLLECTION, liquidationId, {
            expenses,
            totalAmount,
            totalVat,
            totalEwt,
            netAmount,
            receiptsLink: receiptsLink || '',
            remarks: remarks || '',
        });
    }
}
