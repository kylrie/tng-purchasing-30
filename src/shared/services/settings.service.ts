import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';

// =====================================================
// PCF SETTINGS INTERFACE
// =====================================================
export interface PCFSettings {
    deadlineDay: number;        // Day of month (1-31) for liquidation deadline
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

// Default settings
const DEFAULT_PCF_SETTINGS: PCFSettings = {
    deadlineDay: 5,  // Default to 5th of each month
};

const SETTINGS_COLLECTION = COLLECTIONS.SETTINGS;
const PCF_CONFIG_DOC = 'pcf_config';

// =====================================================
// SETTINGS SERVICE
// =====================================================
export class SettingsService {
    /**
     * Get PCF settings (deadline day, etc.)
     * Returns defaults if not configured
     */
    static async getPcfSettings(): Promise<PCFSettings> {
        try {
            const settings = await FirestoreService.getDocument<PCFSettings>(
                SETTINGS_COLLECTION,
                PCF_CONFIG_DOC
            );

            if (!settings) {
                // Return defaults if not yet configured
                return { ...DEFAULT_PCF_SETTINGS };
            }

            return {
                ...DEFAULT_PCF_SETTINGS,
                ...settings,
            };
        } catch (error) {
            console.error('[SettingsService] Error fetching PCF settings:', error);
            return { ...DEFAULT_PCF_SETTINGS };
        }
    }

    /**
     * Update PCF settings
     */
    static async updatePcfSettings(
        settings: Partial<PCFSettings>,
        userId?: string,
        userName?: string
    ): Promise<void> {
        const updatePayload: Partial<PCFSettings> = {
            ...settings,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
            updatedByName: userName,
        };

        await FirestoreService.setDocument(
            SETTINGS_COLLECTION,
            PCF_CONFIG_DOC,
            updatePayload
        );
    }

    /**
     * Calculate if a submission is late based on expense dates and deadline settings.
     * 
     * LOGIC: Expenses from Month X are due by Day Y of Month X+1
     * Example: November expenses → due by December 5th
     *          December expenses → due by January 5th
     * 
     * @param submissionDate - The date of submission (usually now)
     * @param expenseMonth - The month the expenses belong to (0-11, JS month index)
     * @param expenseYear - The year the expenses belong to
     * @param deadlineDay - The deadline day of the month (1-31)
     * @returns Object with isLate flag, daysLate count, and the deadline date
     */
    static calculateLatenessForExpenseMonth(
        submissionDate: Date,
        expenseMonth: number,
        expenseYear: number,
        deadlineDay: number
    ): { isLate: boolean; daysLate: number; deadlineDate: Date } {
        // Deadline is in the NEXT month after the expense month
        let deadlineMonth = expenseMonth + 1;
        let deadlineYear = expenseYear;

        // Handle year rollover (December expenses → January deadline)
        if (deadlineMonth > 11) {
            deadlineMonth = 0; // January
            deadlineYear += 1;
        }

        // Create deadline date
        const deadline = new Date(
            deadlineYear,
            deadlineMonth,
            deadlineDay,
            23, 59, 59 // End of deadline day
        );

        // Handle edge case: if deadline day > days in month, use last day of month
        const lastDayOfMonth = new Date(
            deadlineYear,
            deadlineMonth + 1,
            0
        ).getDate();

        if (deadlineDay > lastDayOfMonth) {
            deadline.setDate(lastDayOfMonth);
        }

        // Compare dates
        if (submissionDate > deadline) {
            const timeDiff = submissionDate.getTime() - deadline.getTime();
            const daysLate = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            return { isLate: true, daysLate, deadlineDate: deadline };
        }

        return { isLate: false, daysLate: 0, deadlineDate: deadline };
    }

    /**
     * Calculate lateness based on expense item dates.
     * Uses the EARLIEST expense date to determine which month's deadline applies.
     * 
     * @param submissionDate - The date of submission
     * @param expenseDates - Array of expense date strings (YYYY-MM-DD format)
     * @param deadlineDay - The deadline day of the month
     */
    static calculateLatenessFromExpenses(
        submissionDate: Date,
        expenseDates: string[],
        deadlineDay: number
    ): { isLate: boolean; daysLate: number; expenseMonth: number; expenseYear: number; deadlineDate: Date } {
        if (!expenseDates.length) {
            // No expenses - use current month minus 1 as default
            const lastMonth = new Date(submissionDate);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const result = this.calculateLatenessForExpenseMonth(
                submissionDate,
                lastMonth.getMonth(),
                lastMonth.getFullYear(),
                deadlineDay
            );
            return {
                ...result,
                expenseMonth: lastMonth.getMonth(),
                expenseYear: lastMonth.getFullYear()
            };
        }

        // Find the earliest expense date to determine the expense month
        const parsedDates = expenseDates
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        if (!parsedDates.length) {
            // Fallback to last month
            const lastMonth = new Date(submissionDate);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const result = this.calculateLatenessForExpenseMonth(
                submissionDate,
                lastMonth.getMonth(),
                lastMonth.getFullYear(),
                deadlineDay
            );
            return {
                ...result,
                expenseMonth: lastMonth.getMonth(),
                expenseYear: lastMonth.getFullYear()
            };
        }

        // Use earliest expense date to determine expense month
        const earliestExpense = parsedDates[0];
        const expenseMonth = earliestExpense.getMonth();
        const expenseYear = earliestExpense.getFullYear();

        const result = this.calculateLatenessForExpenseMonth(
            submissionDate,
            expenseMonth,
            expenseYear,
            deadlineDay
        );

        return {
            ...result,
            expenseMonth,
            expenseYear
        };
    }

    /**
     * Simple check: Is current submission past this month's deadline?
     * (for showing warning in UI - doesn't consider expense dates)
     */
    static calculateLateness(
        submissionDate: Date,
        deadlineDay: number
    ): { isLate: boolean; daysLate: number } {
        // Get deadline for the current month
        const deadline = new Date(
            submissionDate.getFullYear(),
            submissionDate.getMonth(),
            deadlineDay,
            23, 59, 59 // End of deadline day
        );

        // Handle edge case: if deadline day > days in month, use last day of month
        const lastDayOfMonth = new Date(
            submissionDate.getFullYear(),
            submissionDate.getMonth() + 1,
            0
        ).getDate();

        if (deadlineDay > lastDayOfMonth) {
            deadline.setDate(lastDayOfMonth);
        }

        // Compare dates
        if (submissionDate > deadline) {
            const timeDiff = submissionDate.getTime() - deadline.getTime();
            const daysLate = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            return { isLate: true, daysLate };
        }

        return { isLate: false, daysLate: 0 };
    }
}
