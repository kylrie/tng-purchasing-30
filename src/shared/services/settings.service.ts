import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { Unsubscribe } from 'firebase/firestore';

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
const APPROVER_ASSIGNMENTS_DOC = 'approver_assignments';

// =====================================================
// APPROVER ASSIGNMENTS INTERFACE
// =====================================================

/**
 * Finance Head assignment per Business Unit
 * Maps business unit ID to Finance Head user ID
 */
export interface FinanceHeadAssignment {
    userId: string;
    userName: string;
    businessUnitIds: string[]; // Which BUs this finance head handles
}

/**
 * BOD Approver (multiple users can be assigned)
 */
export interface BodApprover {
    userId: string;
    userName: string;
}

export interface ApproverAssignments {
    // Finance Head - BU-specific (multiple, each handles specific BUs)
    financeHeads?: FinanceHeadAssignment[];

    // General Manager (single user)
    gmUid?: string;
    gmName?: string;

    // CFO Approver (single user) - renamed from BOD Approver
    cfoUid?: string;
    cfoName?: string;

    // BOD Approvers (multiple users) - renamed from Check Prep Officer
    bodApprovers?: BodApprover[];

    // Audit trail
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

const DEFAULT_APPROVER_ASSIGNMENTS: ApproverAssignments = {
    financeHeads: [],
    bodApprovers: [],
};

// =====================================================
// FOOD COST SETTINGS INTERFACE
// =====================================================
export interface FoodCostSettings {
    excellent: number;      // Green - Excellent margin (e.g., 25%)
    good: number;           // Green - Good margin (e.g., 30%)
    warning: number;        // Yellow - Warning (e.g., 35%)
    danger: number;         // Red - Too high (e.g., 40%)
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

const DEFAULT_FOOD_COST_SETTINGS: FoodCostSettings = {
    excellent: 25,
    good: 30,
    warning: 35,
    danger: 40,
};

const FOOD_COST_CONFIG_DOC = 'food_cost_config';

// =====================================================
// EXPENSE SHARING SETTINGS INTERFACE
// =====================================================
export interface ExpenseAllocation {
    targetBuId: string;
    targetBuName: string;
    percentage: number;  // e.g., 40 = 40%
}

export interface AllocationRule {
    sourceBuId: string;      // The "Head Office" BU that creates the expense
    sourceBuName: string;    // Display name for UI
    isEnabled: boolean;
    allocations: ExpenseAllocation[];
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

export interface ExpenseSharingSettings {
    rules: AllocationRule[];
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

const DEFAULT_EXPENSE_SHARING_SETTINGS: ExpenseSharingSettings = {
    rules: []
};

const EXPENSE_SHARING_DOC = 'expense_sharing';

// =====================================================
// COA (CHART OF ACCOUNTS) SETTINGS INTERFACE
// =====================================================
export interface COASettings {
    options: string[];      // List of COA options
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

const DEFAULT_COA_SETTINGS: COASettings = {
    options: [
        'Food Supplies',
        'Beverages',
        'Office Supplies',
        'Transportation',
        'Utilities',
        'Repairs & Maintenance',
        'Professional Fees',
        'Rent',
        'Miscellaneous',
        'Other'
    ]
};

const COA_CONFIG_DOC = 'coa_config';

// =====================================================
// STORAGE AREA SETTINGS INTERFACE
// =====================================================
export interface StorageAreaSettings {
    areas: string[];        // List of storage area names
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

const DEFAULT_STORAGE_AREAS: StorageAreaSettings = {
    areas: [
        'Kitchen',
        'Storage Room',
        'Bar',
        'Walk-in Cooler',
        'Office'
    ]
};

const STORAGE_AREAS_DOC = 'storage_areas';

// =====================================================
// TAX SETTINGS INTERFACE (Configurable VAT/EWT Defaults)
// =====================================================
export interface TaxSettings {
    defaultVatPercentage: number;   // Default VAT rate (e.g., 12%)
    defaultEwtPercentage: number;   // Default EWT rate (e.g., 2%)
    vatOptions: number[];           // Available VAT percentages for dropdown
    ewtOptions: number[];           // Available EWT percentages for dropdown
    lastUpdated?: string;
    updatedBy?: string;
    updatedByName?: string;
}

const DEFAULT_TAX_SETTINGS: TaxSettings = {
    defaultVatPercentage: 12,
    defaultEwtPercentage: 2,
    vatOptions: [0, 5, 12],
    ewtOptions: [1, 2, 5, 10, 15],
};

const TAX_CONFIG_DOC = 'tax_config';


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

    // =====================================================
    // APPROVER ASSIGNMENTS METHODS
    // =====================================================

    /**
     * Get workflow approver assignments (Finance Head, GM, BOD, Check Prep Officer)
     * Returns empty object if not configured
     */
    static async getApproverAssignments(): Promise<ApproverAssignments> {
        try {
            const assignments = await FirestoreService.getDocument<ApproverAssignments>(
                SETTINGS_COLLECTION,
                APPROVER_ASSIGNMENTS_DOC
            );

            if (!assignments) {
                return { ...DEFAULT_APPROVER_ASSIGNMENTS };
            }

            return {
                ...DEFAULT_APPROVER_ASSIGNMENTS,
                ...assignments,
            };
        } catch (error) {
            console.error('[SettingsService] Error fetching approver assignments:', error);
            return { ...DEFAULT_APPROVER_ASSIGNMENTS };
        }
    }

    /**
     * Update workflow approver assignments
     */
    static async updateApproverAssignments(
        assignments: Partial<ApproverAssignments>,
        userId?: string,
        userName?: string
    ): Promise<void> {
        const updatePayload: Partial<ApproverAssignments> = {
            ...assignments,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
            updatedByName: userName,
        };

        await FirestoreService.setDocument(
            SETTINGS_COLLECTION,
            APPROVER_ASSIGNMENTS_DOC,
            updatePayload
        );
    }

    // =====================================================
    // FOOD COST SETTINGS METHODS
    // =====================================================

    /**
     * Get food cost threshold settings
     * Returns defaults if not configured
     */
    static async getFoodCostSettings(): Promise<FoodCostSettings> {
        try {
            const settings = await FirestoreService.getDocument<FoodCostSettings>(
                SETTINGS_COLLECTION,
                FOOD_COST_CONFIG_DOC
            );

            if (!settings) {
                return { ...DEFAULT_FOOD_COST_SETTINGS };
            }

            return {
                ...DEFAULT_FOOD_COST_SETTINGS,
                ...settings,
            };
        } catch (error) {
            console.error('[SettingsService] Error fetching food cost settings:', error);
            return { ...DEFAULT_FOOD_COST_SETTINGS };
        }
    }

    /**
     * Update food cost threshold settings
     */
    static async updateFoodCostSettings(
        settings: Partial<FoodCostSettings>,
        userId?: string,
        userName?: string
    ): Promise<void> {
        const updatePayload: Partial<FoodCostSettings> = {
            ...settings,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
            updatedByName: userName,
        };

        await FirestoreService.setDocument(
            SETTINGS_COLLECTION,
            FOOD_COST_CONFIG_DOC,
            updatePayload
        );
    }

    // =====================================================
    // EXPENSE SHARING METHODS
    // =====================================================

    /**
     * Get expense sharing rules
     * Returns empty rules array if not configured
     */
    static async getExpenseSharingRules(): Promise<ExpenseSharingSettings> {
        try {
            const settings = await FirestoreService.getDocument<ExpenseSharingSettings>(
                SETTINGS_COLLECTION,
                EXPENSE_SHARING_DOC
            );

            if (!settings) {
                return { ...DEFAULT_EXPENSE_SHARING_SETTINGS };
            }

            return {
                ...DEFAULT_EXPENSE_SHARING_SETTINGS,
                ...settings,
            };
        } catch (error) {
            console.error('[SettingsService] Error fetching expense sharing rules:', error);
            return { ...DEFAULT_EXPENSE_SHARING_SETTINGS };
        }
    }

    /**
     * Update expense sharing rules
     */
    static async updateExpenseSharingRules(
        settings: ExpenseSharingSettings,
        userId?: string,
        userName?: string
    ): Promise<void> {
        const updatePayload: ExpenseSharingSettings = {
            ...settings,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
            updatedByName: userName,
        };

        await FirestoreService.setDocument(
            SETTINGS_COLLECTION,
            EXPENSE_SHARING_DOC,
            updatePayload
        );
    }

    /**
     * Get allocation rule for a specific source BU
     * Returns null if no rule exists or rule is disabled
     */
    static async getAllocationRuleForBu(sourceBuId: string): Promise<AllocationRule | null> {
        try {
            const settings = await this.getExpenseSharingRules();
            const rule = settings.rules.find(r => r.sourceBuId === sourceBuId && r.isEnabled);
            return rule || null;
        } catch (error) {
            console.error('[SettingsService] Error getting allocation rule for BU:', error);
            return null;
        }
    }

    // =====================================================
    // COA (CHART OF ACCOUNTS) METHODS
    // =====================================================

    /**
     * Get COA options
     * Returns defaults if not configured
     */
    static async getCOAOptions(): Promise<COASettings> {
        try {
            const doc = await FirestoreService.getDocument<COASettings>(
                SETTINGS_COLLECTION,
                COA_CONFIG_DOC
            );
            // Handle null/undefined and spread defaults
            if (!doc) return { ...DEFAULT_COA_SETTINGS };
            // Ensure options array exists and has values
            if (!doc.options || doc.options.length === 0) {
                return { ...doc, options: DEFAULT_COA_SETTINGS.options };
            }
            return doc;
        } catch (error) {
            console.error('[SettingsService] Error getting COA options:', error);
            return { ...DEFAULT_COA_SETTINGS };
        }
    }

    /**
     * Update COA options
     */
    static async updateCOAOptions(
        options: string[],
        userId?: string,
        userName?: string
    ): Promise<void> {
        const updatePayload: COASettings = {
            options,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
            updatedByName: userName,
        };

        await FirestoreService.setDocument(
            SETTINGS_COLLECTION,
            COA_CONFIG_DOC,
            updatePayload
        );
    }

    // =====================================================
    // STORAGE AREA METHODS
    // =====================================================

    /**
     * Get storage area options
     * Returns defaults if not configured
     */
    static async getStorageAreas(): Promise<StorageAreaSettings> {
        try {
            const doc = await FirestoreService.getDocument<StorageAreaSettings>(
                SETTINGS_COLLECTION,
                STORAGE_AREAS_DOC
            );
            if (!doc) return { ...DEFAULT_STORAGE_AREAS };
            if (!doc.areas || doc.areas.length === 0) {
                return { ...doc, areas: DEFAULT_STORAGE_AREAS.areas };
            }
            return doc;
        } catch (error) {
            console.error('[SettingsService] Error getting storage areas:', error);
            return { ...DEFAULT_STORAGE_AREAS };
        }
    }

    /**
     * Update storage area options
     */
    static async updateStorageAreas(
        areas: string[],
        userId?: string,
        userName?: string
    ): Promise<void> {
        const updatePayload: StorageAreaSettings = {
            areas,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
            updatedByName: userName,
        };

        await FirestoreService.setDocument(
            SETTINGS_COLLECTION,
            STORAGE_AREAS_DOC,
            updatePayload
        );
    }

    // =====================================================
    // TAX SETTINGS METHODS
    // =====================================================

    /**
     * Get tax settings (VAT/EWT defaults)
     * Returns defaults if not configured
     */
    static async getTaxSettings(): Promise<TaxSettings> {
        try {
            const settings = await FirestoreService.getDocument<TaxSettings>(
                SETTINGS_COLLECTION,
                TAX_CONFIG_DOC
            );

            if (!settings) {
                return { ...DEFAULT_TAX_SETTINGS };
            }

            return {
                ...DEFAULT_TAX_SETTINGS,
                ...settings,
            };
        } catch (error) {
            console.error('[SettingsService] Error fetching tax settings:', error);
            return { ...DEFAULT_TAX_SETTINGS };
        }
    }

    /**
     * Update tax settings
     */
    static async updateTaxSettings(
        settings: Partial<TaxSettings>,
        userId?: string,
        userName?: string
    ): Promise<void> {
        const updatePayload: Partial<TaxSettings> = {
            ...settings,
            lastUpdated: new Date().toISOString(),
            updatedBy: userId,
            updatedByName: userName,
        };

        await FirestoreService.setDocument(
            SETTINGS_COLLECTION,
            TAX_CONFIG_DOC,
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

    // =====================================================
    // SUBSCRIPTION METHODS (Real-time Updates)
    // =====================================================

    /**
     * Subscribe to PCF Settings
     */
    static subscribeToPcfSettings(
        callback: (settings: PCFSettings) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToDocument<PCFSettings>(
            SETTINGS_COLLECTION,
            PCF_CONFIG_DOC,
            (data) => {
                if (data) {
                    callback({ ...DEFAULT_PCF_SETTINGS, ...data });
                } else {
                    callback({ ...DEFAULT_PCF_SETTINGS });
                }
            }
        );
    }

    /**
     * Subscribe to Approver Assignments
     */
    static subscribeToApproverAssignments(
        callback: (assignments: ApproverAssignments) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToDocument<ApproverAssignments>(
            SETTINGS_COLLECTION,
            APPROVER_ASSIGNMENTS_DOC,
            (data) => {
                if (data) {
                    callback({ ...DEFAULT_APPROVER_ASSIGNMENTS, ...data });
                } else {
                    callback({ ...DEFAULT_APPROVER_ASSIGNMENTS });
                }
            }
        );
    }

    /**
     * Subscribe to Food Cost Settings
     */
    static subscribeToFoodCostSettings(
        callback: (settings: FoodCostSettings) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToDocument<FoodCostSettings>(
            SETTINGS_COLLECTION,
            FOOD_COST_CONFIG_DOC,
            (data) => {
                if (data) {
                    callback({ ...DEFAULT_FOOD_COST_SETTINGS, ...data });
                } else {
                    callback({ ...DEFAULT_FOOD_COST_SETTINGS });
                }
            }
        );
    }

    /**
     * Subscribe to Storage Area Settings
     */
    static subscribeToStorageAreas(
        callback: (settings: StorageAreaSettings) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToDocument<StorageAreaSettings>(
            SETTINGS_COLLECTION,
            STORAGE_AREAS_DOC,
            (data) => {
                if (data && data.areas && data.areas.length > 0) {
                    callback(data);
                } else {
                    callback({ ...DEFAULT_STORAGE_AREAS });
                }
            }
        );
    }

    /**
     * Subscribe to Tax Settings
     */
    static subscribeToTaxSettings(
        callback: (settings: TaxSettings) => void
    ): Unsubscribe {
        return FirestoreService.subscribeToDocument<TaxSettings>(
            SETTINGS_COLLECTION,
            TAX_CONFIG_DOC,
            (data) => {
                if (data) {
                    callback({ ...DEFAULT_TAX_SETTINGS, ...data });
                } else {
                    callback({ ...DEFAULT_TAX_SETTINGS });
                }
            }
        );
    }
}
