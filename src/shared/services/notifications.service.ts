import { FirestoreService, where, orderBy, Timestamp } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { FirestoreNotification } from '../types/firebase.types';
import type { UserRole } from '../../features/auth/types';
import type { Unsubscribe } from 'firebase/firestore';

/**
 * Notification Management Service
 * Handles system notifications for workflow events
 */
export class NotificationsService {
    /**
     * Create a new notification
     */
    static async createNotification(data: {
        type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO';
        message: string;
        requisitionId?: string;
        targetRoles: (UserRole | string)[]; // Can include user IDs
    }): Promise<string> {
        const newDoc = {
            ...data,
            read: false,
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
}
