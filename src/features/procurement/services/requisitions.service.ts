import { FirestoreService, where, orderBy } from '../../shared/services/firestore.service';
import { COLLECTIONS } from '../../shared/types/firebase.types';
import type { FirestoreRequisition } from '../../shared/types/firebase.types';
import { RequisitionStatus } from '../types';
import { UserRole } from '../../features/auth/types';
import { generateRequisitionId, getCurrentDateString } from '../../shared/utils/firestore.utils';
import { NotificationsService } from '../../shared/services/notifications.service';
import type { Unsubscribe } from 'firebase/firestore';

/**
 * Requisitions Service
 * Handles requisition-related operations and business logic
 */
export class RequisitionsService {
    /**
     * Create a new requisition with auto-generated ID
     */
    static async createRequisition(
        data: Omit<FirestoreRequisition, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        // Get the last requisition to generate new ID
        const allRequisitions = await this.getAllRequisitions();
        const lastId = allRequisitions.length > 0 ? allRequisitions[0].id : undefined;
        const newId = generateRequisitionId(lastId);

        // Create requisition with custom ID
        await FirestoreService.setDocument<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            newId,
            {
                ...data,
                dateCreated: data.dateCreated || getCurrentDateString(),
            }
        );

        // Create notification if submitted for approval
        if (data.status === RequisitionStatus.BURF_PENDING_MANAGER) {
            await NotificationsService.createNotification({
                type: 'BURF',
                message: `New BURF Request ${newId} pending approval.`,
                requisitionId: newId,
                targetRoles: [UserRole.MANAGER, UserRole.SUPER_ADMIN],
            });
        }

        return newId;
    }

    /**
     * Get a single requisition by ID
     */
    static async getRequisition(id: string): Promise<FirestoreRequisition | null> {
        return await FirestoreService.getDocument<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            id
        );
    }

    /**
     * Get all requisitions (use with caution)
     */
    static async getAllRequisitions(): Promise<FirestoreRequisition[]> {
        return await FirestoreService.getDocuments<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            [orderBy('dateCreated', 'desc')]
        );
    }

    /**
     * Get requisitions by business
     */
    static async getRequisitionsByBusiness(businessId: string): Promise<FirestoreRequisition[]> {
        return await FirestoreService.getDocuments<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            [
                where('businessId', '==', businessId),
                orderBy('dateCreated', 'desc'),
            ]
        );
    }

    /**
     * Get requisitions by user (requester)
     */
    static async getRequisitionsByUser(userId: string): Promise<FirestoreRequisition[]> {
        return await FirestoreService.getDocuments<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            [
                where('requesterId', '==', userId),
                orderBy('dateCreated', 'desc'),
            ]
        );
    }

    /**
     * Get requisitions by status
     */
    static async getRequisitionsByStatus(status: RequisitionStatus): Promise<FirestoreRequisition[]> {
        return await FirestoreService.getDocuments<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            [
                where('status', '==', status),
                orderBy('dateCreated', 'desc'),
            ]
        );
    }

    /**
     * Get requisitions pending approval for a specific role
     */
    static async getRequisitionsPendingForRole(role: UserRole): Promise<FirestoreRequisition[]> {
        const statusMap: Record<UserRole, RequisitionStatus[]> = {
            [UserRole.MANAGER]: [RequisitionStatus.BURF_PENDING_MANAGER, RequisitionStatus.PRF_PENDING_MANAGER],
            [UserRole.CIC]: [RequisitionStatus.BURF_PENDING_CIC],
            [UserRole.FINANCE]: [RequisitionStatus.APPROVED_FOR_PAYMENT],
            [UserRole.AUDITOR]: [RequisitionStatus.LIQUIDATION_FILED],
            [UserRole.PURCHASING_OFFICER]: [RequisitionStatus.READY_FOR_PRF],
            [UserRole.EMPLOYEE]: [],
            [UserRole.SUPER_ADMIN]: [],
        };

        const relevantStatuses = statusMap[role];
        if (!relevantStatuses || relevantStatuses.length === 0) {
            return [];
        }

        // Get all requisitions and filter by status
        const allRequisitions = await this.getAllRequisitions();
        return allRequisitions.filter(req => relevantStatuses.includes(req.status));
    }

    /**
     * Update a requisition
     */
    static async updateRequisition(
        id: string,
        data: Partial<Omit<FirestoreRequisition, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<void> {
        await FirestoreService.updateDocument<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            id,
            data
        );
    }

    /**
     * Update requisition status and trigger notifications
     */
    static async updateRequisitionStatus(
        id: string,
        status: RequisitionStatus,
        comment?: string
    ): Promise<void> {
        await this.updateRequisition(id, { status });

        // Create appropriate notifications based on status
        const notificationMap: Partial<Record<RequisitionStatus, { message: string; roles: UserRole[]; type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO' }>> = {
            [RequisitionStatus.BURF_PENDING_CIC]: {
                message: `BURF ${id} approved by Manager. Inventory Check Required.`,
                roles: [UserRole.CIC, UserRole.SUPER_ADMIN],
                type: 'BURF',
            },
            [RequisitionStatus.READY_FOR_PRF]: {
                message: `BURF ${id} inventory checked. Ready for PRF.`,
                roles: [UserRole.PURCHASING_OFFICER, UserRole.SUPER_ADMIN],
                type: 'BURF',
            },
            [RequisitionStatus.PRF_PENDING_MANAGER]: {
                message: `PRF Prepared for ${id}. Manager approval required.`,
                roles: [UserRole.MANAGER, UserRole.SUPER_ADMIN],
                type: 'PRF',
            },
            [RequisitionStatus.APPROVED_FOR_PAYMENT]: {
                message: `PRF ${id} approved. Ready for Payment Processing.`,
                roles: [UserRole.FINANCE, UserRole.SUPER_ADMIN],
                type: 'PRF',
            },
            [RequisitionStatus.FUNDS_RELEASED]: {
                message: `Funds released for ${id}. Please proceed with purchase.`,
                roles: [UserRole.EMPLOYEE, UserRole.PURCHASING_OFFICER],
                type: 'LIQUIDATION',
            },
            [RequisitionStatus.LIQUIDATION_FILED]: {
                message: `Liquidation filed for ${id}. Audit required.`,
                roles: [UserRole.AUDITOR, UserRole.FINANCE, UserRole.SUPER_ADMIN],
                type: 'LIQUIDATION',
            },
            [RequisitionStatus.REJECTED]: {
                message: `Requisition ${id} rejected${comment ? `: ${comment}` : ''}. Please review.`,
                roles: [UserRole.EMPLOYEE, UserRole.PURCHASING_OFFICER],
                type: 'INFO',
            },
        };

        const notification = notificationMap[status];
        if (notification) {
            await NotificationsService.createNotification({
                type: notification.type,
                message: notification.message,
                requisitionId: id,
                targetRoles: notification.roles,
            });
        }
    }

    /**
     * Delete a requisition
     */
    static async deleteRequisition(id: string): Promise<void> {
        await FirestoreService.deleteDocument(COLLECTIONS.REQUISITIONS, id);
        // Also delete related notifications
        await NotificationsService.deleteNotificationsByRequisition(id);
    }

    /**
     * Subscribe to requisitions for a specific business (real-time)
     */
    static subscribeToRequisitionsByBusiness(
        businessId: string,
        callback: (requisitions: FirestoreRequisition[]) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToCollection<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            callback,
            [
                where('businessId', '==', businessId),
                orderBy('dateCreated', 'desc'),
            ],
            onError
        );
    }

    /**
     * Subscribe to requisitions for a specific user (real-time)
     */
    static subscribeToRequisitionsByUser(
        userId: string,
        callback: (requisitions: FirestoreRequisition[]) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToCollection<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            callback,
            [
                where('requesterId', '==', userId),
                orderBy('dateCreated', 'desc'),
            ],
            onError
        );
    }

    /**
     * Subscribe to all requisitions (real-time)
     * Use only for SUPER_ADMIN
     */
    static subscribeToAllRequisitions(
        callback: (requisitions: FirestoreRequisition[]) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToCollection<FirestoreRequisition>(
            COLLECTIONS.REQUISITIONS,
            callback,
            [orderBy('dateCreated', 'desc')],
            onError
        );
    }
}
