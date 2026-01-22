import { FirestoreService, where, orderBy, Timestamp } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { FirestoreNotification } from '../types/firebase.types';
import type { UserRole, Requisition, RequisitionStatus } from '../../features/procurement/types';
import type { Unsubscribe } from 'firebase/firestore';

// ============================================================
// NOTIFICATION TYPE CONSTANTS
// ============================================================

export const NOTIFICATION_TYPES = {
    // Filer Notifications (status updates for requesters)
    BURF_SUBMITTED: { type: 'BURF' as const, subType: 'SUBMITTED' as const },
    BURF_APPROVED: { type: 'BURF' as const, subType: 'APPROVED' as const },
    BURF_REJECTED: { type: 'BURF' as const, subType: 'REJECTED' as const },
    BURF_CONVERTED_TO_PRF: { type: 'BURF' as const, subType: 'CONVERTED' as const },

    PRF_SUBMITTED: { type: 'PRF' as const, subType: 'SUBMITTED' as const },
    PRF_APPROVED: { type: 'PRF' as const, subType: 'APPROVED' as const },
    PRF_REJECTED: { type: 'PRF' as const, subType: 'REJECTED' as const },
    PRF_FUNDS_RELEASED: { type: 'PRF' as const, subType: 'APPROVED' as const },

    LIQUIDATION_FILED: { type: 'LIQUIDATION' as const, subType: 'SUBMITTED' as const },
    LIQUIDATION_CLEARED: { type: 'LIQUIDATION' as const, subType: 'CLEARED' as const },
    LIQUIDATION_REJECTED: { type: 'LIQUIDATION' as const, subType: 'REJECTED' as const },
    LIQUIDATION_REMINDER: { type: 'REMINDER' as const, subType: 'REMINDER' as const, priority: 'HIGH' as const },

    // Approver Notifications (pending action alerts)
    PENDING_APPROVAL: { type: 'ALERT' as const, subType: 'PENDING_ACTION' as const },

    // Auditor Notifications
    PCF_READY_FOR_AUDIT: { type: 'AUDIT' as const, subType: 'PENDING_ACTION' as const },
    LIQUIDATION_READY_FOR_AUDIT: { type: 'AUDIT' as const, subType: 'PENDING_ACTION' as const },
} as const;

// ============================================================
// STATUS TO STAGE NAME MAPPING
// ============================================================

const STATUS_STAGE_NAMES: Partial<Record<RequisitionStatus, string>> = {
    'BURF_PENDING_MANAGER': 'Manager Approval',
    'BURF_PENDING_CIC': 'CIC Review',
    'READY_FOR_PRF': 'Ready for PRF',
    'PRF_PENDING_MANAGER': 'BUM Approval',
    'PENDING_GM_PRF_APPROVAL': 'GM PRF Review',
    'PENDING_FINANCE_HEAD_BR_APPROVAL': 'Finance Head Budget Review',
    'PENDING_GM_BR_APPROVAL': 'GM Budget Approval',
    'PENDING_BOD_APPROVAL': 'BOD Approval',
    'FOR_CHECK_PREPARATION': 'Check Preparation',
    'PENDING_CHECK_AUTH_BOD': 'BOD Check Authorization',
    'FOR_FUND_RELEASE': 'Fund Release',
    'FUNDS_RELEASED': 'Funds Released',
    'LIQUIDATION_FILED': 'Liquidation Filed',
    'AUDITED_CLEARED': 'Audit Cleared',
};

/**
 * Notification Management Service
 * Handles system notifications for workflow events
 */
export class NotificationsService {
    // ============================================================
    // CORE CRUD OPERATIONS
    // ============================================================

    /**
     * Create a new notification with enhanced metadata
     */
    static async createNotification(data: {
        type: FirestoreNotification['type'];
        message: string;
        requisitionId?: string;
        targetRoles: (UserRole | string)[];
        subType?: FirestoreNotification['subType'];
        priority?: FirestoreNotification['priority'];
        actionUrl?: string;
        metadata?: FirestoreNotification['metadata'];
    }): Promise<string> {
        const newDoc: Partial<FirestoreNotification> = {
            ...data,
            read: false,
            priority: data.priority || 'NORMAL',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        return await FirestoreService.createDocument<FirestoreNotification>(
            COLLECTIONS.NOTIFICATIONS,
            newDoc as FirestoreNotification
        );
    }

    /**
     * Get notifications for a specific role or user
     */
    static async getNotificationsByRole(roleOrUserId: UserRole | string): Promise<(FirestoreNotification & { id: string })[]> {
        return await FirestoreService.getDocuments<FirestoreNotification>(
            COLLECTIONS.NOTIFICATIONS,
            [
                where('targetRoles', 'array-contains', roleOrUserId),
                orderBy('createdAt', 'desc'),
            ]
        );
    }

    /**
     * Get unread notifications for a specific role or user
     */
    static async getUnreadNotificationsByRole(roleOrUserId: UserRole | string): Promise<(FirestoreNotification & { id: string })[]> {
        return await FirestoreService.getDocuments<FirestoreNotification>(
            COLLECTIONS.NOTIFICATIONS,
            [
                where('targetRoles', 'array-contains', roleOrUserId),
                where('read', '==', false),
                orderBy('createdAt', 'desc'),
            ]
        );
    }

    /**
     * Mark a notification as read
     */
    static async markAsRead(notificationId: string): Promise<void> {
        await FirestoreService.updateDocument<FirestoreNotification>(
            COLLECTIONS.NOTIFICATIONS,
            notificationId,
            { read: true, updatedAt: Timestamp.now() }
        );
    }

    /**
     * Mark all notifications as read for a specific role or user
     */
    static async markAllAsReadForRole(roleOrUserId: UserRole | string): Promise<void> {
        const unreadNotifications = await this.getUnreadNotificationsByRole(roleOrUserId);

        const updatePromises = unreadNotifications.map(notification =>
            this.markAsRead(notification.id)
        );

        await Promise.all(updatePromises);
    }

    /**
     * Subscribe to notifications for a specific role or user (real-time)
     */
    static subscribeToNotifications(
        roleOrUserId: UserRole | string,
        callback: (notifications: (FirestoreNotification & { id: string })[]) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToCollection<FirestoreNotification>(
            COLLECTIONS.NOTIFICATIONS,
            callback,
            [
                where('targetRoles', 'array-contains', roleOrUserId),
                orderBy('createdAt', 'desc'),
            ],
            onError
        );
    }

    /**
     * Delete a notification
     */
    static async deleteNotification(notificationId: string): Promise<void> {
        await FirestoreService.deleteDocument(COLLECTIONS.NOTIFICATIONS, notificationId);
    }

    /**
     * Delete all notifications for a specific requisition
     */
    static async deleteNotificationsByRequisition(requisitionId: string): Promise<void> {
        const notifications = await FirestoreService.getDocuments<FirestoreNotification>(
            COLLECTIONS.NOTIFICATIONS,
            [where('requisitionId', '==', requisitionId)]
        );

        const deletePromises = notifications.map(notification =>
            this.deleteNotification(notification.id)
        );

        await Promise.all(deletePromises);
    }

    // ============================================================
    // WORKFLOW NOTIFICATION FACTORIES
    // ============================================================

    /**
     * Notify the filer when their submission status changes
     */
    static async notifyFilerOnStatusChange(
        requisition: Requisition,
        newStatus: RequisitionStatus,
        actorName: string,
        isApproval: boolean = true
    ): Promise<void> {
        const stageName = STATUS_STAGE_NAMES[newStatus] || newStatus;
        const isBurf = newStatus.startsWith('BURF_') || newStatus === 'READY_FOR_PRF';
        const type = isBurf ? 'BURF' : 'PRF';
        const subType = isApproval ? 'APPROVED' : 'REJECTED';

        const message = isApproval
            ? `Your ${type} #${requisition.id.slice(-6)} has been approved and moved to ${stageName}`
            : `Your ${type} #${requisition.id.slice(-6)} was rejected at ${stageName}`;

        try {
            await this.createNotification({
                type,
                subType,
                message,
                requisitionId: requisition.id,
                targetRoles: [requisition.requesterId],
                actionUrl: isBurf ? `/burf/${requisition.id}` : `/prf/${requisition.id}`,
                priority: isApproval ? 'NORMAL' : 'HIGH',
                metadata: {
                    requisitionNumber: requisition.id.slice(-6),
                    requesterName: requisition.requesterName,
                    amount: requisition.totalAmount,
                    stage: stageName,
                    actorName,
                },
            });
        } catch (error) {
            console.error('Failed to create filer notification:', error);
        }
    }

    /**
     * Notify the filer when their BURF is converted to PRF
     */
    static async notifyFilerOnConversion(
        originalBurfId: string,
        newPrfId: string,
        requesterId: string,
        requesterName?: string
    ): Promise<void> {
        try {
            await this.createNotification({
                ...NOTIFICATION_TYPES.BURF_CONVERTED_TO_PRF,
                message: `Your BURF #${originalBurfId.slice(-6)} has been converted to PRF #${newPrfId.slice(-6)}`,
                requisitionId: newPrfId,
                targetRoles: [requesterId],
                actionUrl: `/prf/${newPrfId}`,
                metadata: {
                    requisitionNumber: newPrfId.slice(-6),
                    requesterName,
                },
            });
        } catch (error) {
            console.error('Failed to create conversion notification:', error);
        }
    }

    /**
     * Notify approvers when there's a new item pending their approval
     */
    static async notifyApproverOnNewItem(
        requisition: Requisition,
        approverIds: string[],
        stageName: string
    ): Promise<void> {
        const isBurf = requisition.status.startsWith('BURF_');
        const type = isBurf ? 'BURF' : 'PRF';

        try {
            await this.createNotification({
                ...NOTIFICATION_TYPES.PENDING_APPROVAL,
                message: `New ${type} #${requisition.id.slice(-6)} requires your approval (${stageName})`,
                requisitionId: requisition.id,
                targetRoles: approverIds,
                actionUrl: isBurf ? `/burf` : `/procurement-approvals`,
                priority: requisition.isUrgent ? 'URGENT' : 'NORMAL',
                metadata: {
                    requisitionNumber: requisition.id.slice(-6),
                    requesterName: requisition.requesterName,
                    amount: requisition.totalAmount,
                    stage: stageName,
                },
            });
        } catch (error) {
            console.error('Failed to create approver notification:', error);
        }
    }

    /**
     * Notify filer when funds are released
     */
    static async notifyFilerOnFundRelease(
        requisition: Requisition,
        releaserName: string
    ): Promise<void> {
        try {
            await this.createNotification({
                ...NOTIFICATION_TYPES.PRF_FUNDS_RELEASED,
                message: `Funds released for PRF #${requisition.id.slice(-6)} - ₱${requisition.totalAmount?.toLocaleString()}`,
                requisitionId: requisition.id,
                targetRoles: [requisition.requesterId],
                actionUrl: `/prf/${requisition.id}`,
                priority: 'HIGH',
                metadata: {
                    requisitionNumber: requisition.id.slice(-6),
                    requesterName: requisition.requesterName,
                    amount: requisition.totalAmount,
                    stage: 'Funds Released',
                    actorName: releaserName,
                },
            });
        } catch (error) {
            console.error('Failed to create fund release notification:', error);
        }
    }

    /**
     * Notify auditors when there's a new item to audit
     */
    static async notifyAuditorOnNewItem(
        type: 'PCF' | 'LIQUIDATION',
        itemId: string,
        requesterName?: string,
        amount?: number
    ): Promise<void> {
        const notificationType = type === 'PCF'
            ? NOTIFICATION_TYPES.PCF_READY_FOR_AUDIT
            : NOTIFICATION_TYPES.LIQUIDATION_READY_FOR_AUDIT;

        try {
            await this.createNotification({
                ...notificationType,
                message: `New ${type} ready for audit review: #${itemId.slice(-6)}`,
                requisitionId: itemId,
                targetRoles: ['AUDITOR'], // Target the AUDITOR role
                actionUrl: type === 'PCF' ? `/pcf-audit-review` : `/liquidation`,
                priority: 'NORMAL',
                metadata: {
                    requisitionNumber: itemId.slice(-6),
                    requesterName,
                    amount,
                    stage: `${type} Audit`,
                },
            });
        } catch (error) {
            console.error('Failed to create auditor notification:', error);
        }
    }

    /**
     * Create a liquidation reminder for users with pending liquidations
     */
    static async createLiquidationReminder(
        userId: string,
        requisitionId: string,
        requesterName?: string,
        daysSinceFundRelease?: number
    ): Promise<void> {
        // Check for existing reminder to avoid duplicates
        const existingReminders = await FirestoreService.getDocuments<FirestoreNotification>(
            COLLECTIONS.NOTIFICATIONS,
            [
                where('requisitionId', '==', requisitionId),
                where('subType', '==', 'REMINDER'),
                where('read', '==', false),
            ]
        );

        // Skip if there's already an unread reminder for this requisition
        if (existingReminders.length > 0) {
            return;
        }

        const urgency = (daysSinceFundRelease || 0) > 7 ? 'URGENT' : 'HIGH';
        const daysText = daysSinceFundRelease ? ` (${daysSinceFundRelease} days since fund release)` : '';

        try {
            await this.createNotification({
                ...NOTIFICATION_TYPES.LIQUIDATION_REMINDER,
                message: `Reminder: Liquidation pending for PRF #${requisitionId.slice(-6)}${daysText}`,
                requisitionId,
                targetRoles: [userId],
                actionUrl: `/procurement/liquidation`,
                priority: urgency,
                metadata: {
                    requisitionNumber: requisitionId.slice(-6),
                    requesterName,
                    stage: 'Liquidation Pending',
                },
            });
        } catch (error) {
            console.error('Failed to create liquidation reminder:', error);
        }
    }

    /**
     * Notify filer when their liquidation is processed
     */
    static async notifyFilerOnLiquidationResult(
        requisition: Requisition,
        isCleared: boolean,
        auditorName: string,
        reason?: string
    ): Promise<void> {
        const notificationType = isCleared
            ? NOTIFICATION_TYPES.LIQUIDATION_CLEARED
            : NOTIFICATION_TYPES.LIQUIDATION_REJECTED;

        const message = isCleared
            ? `Your liquidation for PRF #${requisition.id.slice(-6)} has been cleared`
            : `Your liquidation for PRF #${requisition.id.slice(-6)} was rejected${reason ? `: ${reason}` : ''}`;

        try {
            await this.createNotification({
                ...notificationType,
                message,
                requisitionId: requisition.id,
                targetRoles: [requisition.requesterId],
                actionUrl: `/procurement/liquidation`,
                priority: isCleared ? 'NORMAL' : 'HIGH',
                metadata: {
                    requisitionNumber: requisition.id.slice(-6),
                    requesterName: requisition.requesterName,
                    amount: requisition.liquidationDetails?.totalActualAmount,
                    stage: isCleared ? 'Audit Cleared' : 'Liquidation Rejected',
                    actorName: auditorName,
                },
            });
        } catch (error) {
            console.error('Failed to create liquidation result notification:', error);
        }
    }
}

