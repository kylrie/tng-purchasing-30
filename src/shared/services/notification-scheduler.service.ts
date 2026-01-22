import { FirestoreService, where } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { FirestoreRequisition } from '../types/firebase.types';
import { NotificationsService } from './notifications.service';
import { RequisitionStatus } from '../../features/procurement/types';

/**
 * Notification Scheduler Service
 * Handles periodic reminders and scheduled notifications
 * 
 * Features:
 * - 3-hour interval check for pending liquidations
 * - Login trigger for immediate check
 * - Deduplication to avoid spamming users
 */
export class NotificationSchedulerService {
    private static intervalId: ReturnType<typeof setInterval> | null = null;
    private static readonly REMINDER_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
    private static lastCheckTime: number = 0;
    private static readonly MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum between checks

    /**
     * Start the scheduler for a specific user
     */
    static startScheduler(userId: string): void {
        // Clear any existing interval
        this.stopScheduler();

        // Start new interval
        this.intervalId = setInterval(() => {
            this.checkAndNotifyPendingLiquidations(userId);
        }, this.REMINDER_INTERVAL_MS);

        console.log('[NotificationScheduler] Started scheduler for user:', userId);
    }

    /**
     * Stop the scheduler
     */
    static stopScheduler(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[NotificationScheduler] Stopped scheduler');
        }
    }

    /**
     * Check and notify users about pending liquidations
     * This method checks for PRFs with FUNDS_RELEASED status that haven't been liquidated
     */
    static async checkAndNotifyPendingLiquidations(userId: string): Promise<void> {
        // Throttle checks to avoid spamming
        const now = Date.now();
        if (now - this.lastCheckTime < this.MIN_CHECK_INTERVAL_MS) {
            console.log('[NotificationScheduler] Skipping check - too soon since last check');
            return;
        }
        this.lastCheckTime = now;

        try {
            // Find all PRFs with FUNDS_RELEASED status for this user
            const pendingLiquidations = await FirestoreService.getDocuments<FirestoreRequisition>(
                COLLECTIONS.REQUISITIONS,
                [
                    where('requesterId', '==', userId),
                    where('status', '==', RequisitionStatus.FUNDS_RELEASED),
                ]
            );

            console.log(`[NotificationScheduler] Found ${pendingLiquidations.length} pending liquidations for user ${userId}`);

            // Create reminders for each pending liquidation
            for (const req of pendingLiquidations) {
                // Calculate days since fund release
                // Use type assertion since fundReleaseDate is an extended runtime property
                const reqData = req as any; // Use any to safely check types

                let releaseDate: Date;

                if (reqData.fundReleaseDate) {
                    // Handle Firestore Timestamp
                    if (typeof reqData.fundReleaseDate.toDate === 'function') {
                        releaseDate = reqData.fundReleaseDate.toDate();
                    }
                    // Handle String or Number
                    else {
                        releaseDate = new Date(reqData.fundReleaseDate);
                    }
                } else {
                    // Fallback to updatedAt if available, otherwise now
                    if (req.updatedAt && typeof req.updatedAt.toDate === 'function') {
                        releaseDate = req.updatedAt.toDate();
                    } else {
                        releaseDate = new Date();
                    }
                }

                // Check for invalid date
                if (isNaN(releaseDate.getTime())) {
                    console.warn(`[NotificationScheduler] Invalid date for requisition ${req.id}`, reqData);
                    releaseDate = new Date();
                }

                const daysSinceFundRelease = Math.floor(
                    (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                console.log(`[NotificationScheduler] Processing reminder for ${req.id}, days pending: ${daysSinceFundRelease}`);

                await NotificationsService.createLiquidationReminder(
                    userId,
                    req.id,
                    undefined, // requesterName will be fetched if needed
                    daysSinceFundRelease
                );
            }
        } catch (error) {
            console.error('[NotificationScheduler] Error checking pending liquidations:', error);
        }
    }

    /**
     * Called when user logs in - triggers immediate check and starts scheduler
     */
    static async onUserLogin(userId: string): Promise<void> {
        console.log('[NotificationScheduler] User logged in:', userId);

        // Start the periodic scheduler
        this.startScheduler(userId);

        // Trigger immediate check for pending liquidations
        await this.checkAndNotifyPendingLiquidations(userId);
    }

    /**
     * Called when user logs out - stops the scheduler
     */
    static onUserLogout(): void {
        this.stopScheduler();
        this.lastCheckTime = 0;
    }
}
