import { FirestoreService, where, orderBy, Timestamp } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { FirestoreNotification, FirestoreUser } from '../types/firebase.types';
import { UserRole } from '../../features/procurement/types';
import type { Requisition, RequisitionStatus } from '../../features/procurement/types';
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
     * Helper to resolve Roles to User IDs
     */
    private static async resolveTargetRoles(targets: (UserRole | string)[]): Promise<string[]> {
        const resolvedIds = new Set<string>();
        const rolesToQuery = new Set<string>();

        // Check each target
        // If it looks like a role (is in UserRole values), query for it
        // Otherwise treat as UID
        const validRoles = Object.values(UserRole) as string[];

        for (const target of targets) {
            if (validRoles.includes(target)) {
                rolesToQuery.add(target);
            } else {
                resolvedIds.add(target);
            }
        }

        // Batch query for all roles
        if (rolesToQuery.size > 0) {
            try {
                // Firestore 'in' query supports up to 10 values
                const rolesArray = Array.from(rolesToQuery);
                // Chunk if > 10 (though unlikely for notification targets)
                const chunks = [];
                for (let i = 0; i < rolesArray.length; i += 10) {
                    chunks.push(rolesArray.slice(i, i + 10));
                }

                for (const chunk of chunks) {
                    const users = await FirestoreService.getDocuments<FirestoreUser>(
                        COLLECTIONS.USERS,
                        [where('role', 'in', chunk)]
                    );
                    users.forEach(u => resolvedIds.add(u.id));
                }
            } catch (error) {
                console.error('Error resolving roles to UIDs:', error);
                // If query fails, we at least have the explicit UIDs
                // We could add the roles back as fallback, but the security rule blocks them anyway
            }
        }

        return Array.from(resolvedIds);
    }

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
        // Resolve roles to UIDs to satisfy strict security rules
        const resolvedTargetIds = await this.resolveTargetRoles(data.targetRoles);

        // Sanitize metadata to remove undefined values (Firestore doesn't accept undefined)
        const sanitizedMetadata = data.metadata ?
            Object.fromEntries(
// eslint-disable-next-line @typescript-eslint/no-unused-vars
                Object.entries(data.metadata).filter(([_, v]) => v !== undefined)
            ) : undefined;

        // Build the document without undefined fields
        const newDoc: Partial<FirestoreNotification> = {
            type: data.type,
            message: data.message,
            targetRoles: resolvedTargetIds, // Use resolved UIDs
            userId: resolvedTargetIds[0], // FIX: Populate legacy userId (recipientId) for backward compat
            read: false,
            priority: data.priority || 'NORMAL',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        // Only add optional fields if they have values
        if (data.requisitionId) newDoc.requisitionId = data.requisitionId;
        if (data.subType) newDoc.subType = data.subType;
        if (data.actionUrl) newDoc.actionUrl = data.actionUrl;
        if (sanitizedMetadata && Object.keys(sanitizedMetadata).length > 0) {
            newDoc.metadata = sanitizedMetadata as FirestoreNotification['metadata'];
        }

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
                where('targetRoles', 'array-contains', roleOrUserId)
                // orderBy('createdAt', 'desc') // Removed to prevent index/permission issues
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
            ? `Your ${type} #${requisition.id} has been approved and moved to ${stageName}`
            : `Your ${type} #${requisition.id} was rejected at ${stageName}`;

        try {
            await this.createNotification({
                type,
                subType,
                message,
                requisitionId: requisition.id,
                targetRoles: [requisition.requesterId],
                actionUrl: isBurf
                    ? (newStatus === 'READY_FOR_PRF' ? `/?action=prepare-prf&id=${requisition.id}` : `/burf/${requisition.id}`)
                    : `/prf/${requisition.id}?id=${requisition.id}`,
                priority: isApproval ? 'NORMAL' : 'HIGH',
                metadata: {
                    requisitionNumber: requisition.id,
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
                message: `Your BURF #${originalBurfId} has been converted to PRF #${newPrfId}`,
                requisitionId: newPrfId,
                targetRoles: [requesterId],
                actionUrl: `/prf/${newPrfId}?id=${newPrfId}`,
                metadata: {
                    requisitionNumber: newPrfId,
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

        let actionUrl = '/'; // Default

        switch (requisition.status) {
            case 'BURF_PENDING_MANAGER':
                actionUrl = `/?tab=burf&id=${requisition.id}`;
                break;
            case 'BURF_PENDING_CIC':
                actionUrl = `/?tab=cic&id=${requisition.id}`;
                break;
            case 'PRF_PENDING_MANAGER':
                actionUrl = `/?tab=prf&id=${requisition.id}`;
                break;
            case 'PENDING_GM_PRF_APPROVAL':
                actionUrl = `/?tab=gmprf&id=${requisition.id}`;
                break;
            default:
                // Fallback for other approvals
                actionUrl = `/?id=${requisition.id}`;
        }

        try {
            await this.createNotification({
                ...NOTIFICATION_TYPES.PENDING_APPROVAL,
                message: `New ${type} #${requisition.id} requires your approval (${stageName})`,
                requisitionId: requisition.id,
                targetRoles: approverIds,
                actionUrl,
                priority: requisition.isUrgent ? 'URGENT' : 'NORMAL',
                metadata: {
                    requisitionNumber: requisition.id,
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
                message: `Funds released for PRF #${requisition.id} - ₱${requisition.totalAmount?.toLocaleString()}`,
                requisitionId: requisition.id,
                targetRoles: [requisition.requesterId],
                actionUrl: `/prf/${requisition.id}?id=${requisition.id}`,
                priority: 'HIGH',
                metadata: {
                    requisitionNumber: requisition.id,
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
                message: `New ${type} ready for audit review: #${itemId}`,
                requisitionId: itemId,
                targetRoles: ['AUDITOR'], // Target the AUDITOR role
                actionUrl: type === 'PCF' ? `/pcf-audit-review` : `/liquidation`,
                priority: 'NORMAL',
                metadata: {
                    requisitionNumber: itemId,
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
                where('targetRoles', 'array-contains', userId),
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
                message: `Reminder: Liquidation pending for PRF #${requisitionId}${daysText}`,
                requisitionId,
                targetRoles: [userId],
                actionUrl: `/liquidation/${requisitionId}`,
                priority: urgency,
                metadata: {
                    requisitionNumber: requisitionId,
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
            ? `Your liquidation for PRF #${requisition.id} has been cleared`
            : `Your liquidation for PRF #${requisition.id} was rejected${reason ? `: ${reason}` : ''}`;

        try {
            await this.createNotification({
                ...notificationType,
                message,
                requisitionId: requisition.id,
                targetRoles: [requisition.requesterId],
                actionUrl: `/liquidation/${requisition.id}`,
                priority: isCleared ? 'NORMAL' : 'HIGH',
                metadata: {
                    requisitionNumber: requisition.id,
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



    /**
     * Notify Purchasing Officer (CC) about PRF status updates
     */
    static async notifyPurchasingOfficer(
        requisition: Requisition,
        message: string
    ): Promise<void> {
        // Only notify if there is a preparedBy user (Purchasing Officer)
        if (!requisition.prfDetails?.preparedBy) {
            return;
        }

        try {
            await this.createNotification({
                type: 'INFO',
                message,
                requisitionId: requisition.id,
                targetRoles: [requisition.prfDetails.preparedBy],
                actionUrl: `/prf/${requisition.id}?id=${requisition.id}`,
                priority: 'NORMAL',
                metadata: {
                    requisitionNumber: requisition.id,
                    requesterName: requisition.requesterName,
                    amount: requisition.totalAmount,
                    stage: requisition.status,
                },
            });
        } catch (error) {
            console.error('Failed to create purchasing officer notification:', error);
        }
    }
}

