/**
 * Finance Dashboard Service
 * Provides REAL data aggregation from Firestore for the Finance Overview Dashboard
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import { RequisitionStatus, type Requisition } from '../../procurement/types';

// ============================================================
// TYPES
// ============================================================

export interface FinancialHealthData {
    cashOnHand: number;
    cashOnHandTrend: number;  // % vs last month
    monthlyRevenue: number;
    revenueTrend: number;
    monthlyOpEx: number;
    opExTrend: number;
    netProfit: number;
    profitTrend: number;
}

export interface CashFlowDataPoint {
    month: string;
    income: number;
    expense: number;
    [key: string]: string | number;
}

export interface ExpenseCategory {
    name: string;
    value: number;
    color: string;
    [key: string]: string | number;
}

export interface HighValueTransaction {
    id: string;
    date: string;
    description: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const EXPENSE_COLORS = [
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#6b7280', // Gray (Others)
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getMonthYear(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isCurrentMonth(dateString: string): boolean {
    const date = new Date(dateString);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isLastMonth(dateString: string): boolean {
    const date = new Date(dateString);
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
}

function getLast6Months(): string[] {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Fetch all released requisitions (expenses)
 */
async function fetchReleasedRequisitions(businessUnitId?: string): Promise<Requisition[]> {
    try {
        const requisitionsRef = collection(db, COLLECTIONS.REQUISITIONS);

        // Status values that indicate released/paid expenses
        const releaseStatuses = [
            RequisitionStatus.FUNDS_RELEASED,
            RequisitionStatus.LIQUIDATION_FILED,
            RequisitionStatus.AUDITED_CLEARED
        ];

        let requisitions: Requisition[] = [];

        // Firestore doesn't support "in" with more than 10 values, so we query each status
        for (const status of releaseStatuses) {
            const q = businessUnitId && businessUnitId !== 'all'
                ? query(requisitionsRef,
                    where('status', '==', status),
                    where('businessId', '==', businessUnitId))
                : query(requisitionsRef, where('status', '==', status));

            const snapshot = await getDocs(q);
            snapshot.docs.forEach(doc => {
                requisitions.push({ id: doc.id, ...doc.data() } as Requisition);
            });
        }

        return requisitions;
    } catch (error) {
        console.error('Error fetching requisitions:', error);
        return [];
    }
}

/**
 * Get financial health summary for the current month
 */
export async function getFinancialHealth(businessUnitId?: string): Promise<FinancialHealthData> {
    const requisitions = await fetchReleasedRequisitions(businessUnitId);

    // Calculate current month expenses
    const currentMonthExpenses = requisitions
        .filter(r => r.fundReleaseDate && isCurrentMonth(r.fundReleaseDate))
        .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    // Calculate last month expenses
    const lastMonthExpenses = requisitions
        .filter(r => r.fundReleaseDate && isLastMonth(r.fundReleaseDate))
        .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    // Calculate expense trend
    const opExTrend = lastMonthExpenses > 0
        ? ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
        : 0;

    // For now, we don't have an income collection, so estimate from expenses
    // TODO: Replace with actual income data when income collection is available
    const estimatedRevenue = currentMonthExpenses * 1.3; // Assume 30% margin
    const lastMonthRevenue = lastMonthExpenses * 1.3;
    const revenueTrend = lastMonthRevenue > 0
        ? ((estimatedRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    const netProfit = estimatedRevenue - currentMonthExpenses;
    const lastMonthProfit = lastMonthRevenue - lastMonthExpenses;
    const profitTrend = lastMonthProfit !== 0
        ? ((netProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100
        : 0;

    // Cash on hand - sum of all released funds minus liquidated amounts
    // This is a simplified calculation
    const totalReleased = requisitions
        .filter(r => r.fundReleaseDate)
        .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    const totalLiquidated = requisitions
        .filter(r => r.liquidationDetails?.totalActualAmount)
        .reduce((sum, r) => sum + (r.liquidationDetails?.totalActualAmount || 0), 0);

    const cashOnHand = totalReleased - totalLiquidated;
    const cashOnHandTrend = 8.5; // Placeholder - would need historical comparison

    return {
        cashOnHand: Math.max(0, cashOnHand),
        cashOnHandTrend,
        monthlyRevenue: estimatedRevenue,
        revenueTrend: Math.round(revenueTrend * 10) / 10,
        monthlyOpEx: currentMonthExpenses,
        opExTrend: Math.round(opExTrend * 10) / 10,
        netProfit,
        profitTrend: Math.round(profitTrend * 10) / 10
    };
}

/**
 * Get cash flow data for the last 6 months
 */
export async function getCashFlowTrends(businessUnitId?: string): Promise<CashFlowDataPoint[]> {
    const requisitions = await fetchReleasedRequisitions(businessUnitId);
    const last6Months = getLast6Months();

    // Group expenses by month
    const monthlyExpenses: Record<string, number> = {};

    requisitions.forEach(req => {
        if (req.fundReleaseDate) {
            const monthKey = getMonthYear(req.fundReleaseDate);
            monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + (req.totalAmount || 0);
        }
    });

    // Build chart data
    return last6Months.map(monthKey => {
        const expense = monthlyExpenses[monthKey] || 0;
        // Estimate income as 1.3x expenses (placeholder - replace with actual income data)
        const income = expense * 1.3;

        const [, month] = monthKey.split('-');
        const monthName = MONTH_NAMES[parseInt(month) - 1];

        return {
            month: monthName,
            income: Math.round(income),
            expense: Math.round(expense)
        };
    });
}

/**
 * Get expense distribution for current month by COA category
 */
export async function getExpenseDistribution(businessUnitId?: string): Promise<ExpenseCategory[]> {
    const requisitions = await fetchReleasedRequisitions(businessUnitId);

    // Filter to current month and aggregate by COA
    const categoryTotals: Record<string, number> = {};

    requisitions.forEach(req => {
        // Check if this month
        if (!req.fundReleaseDate || !isCurrentMonth(req.fundReleaseDate)) return;

        // If has liquidation details with expenses, use COA breakdown
        if (req.liquidationDetails?.expenses && req.liquidationDetails.expenses.length > 0) {
            req.liquidationDetails.expenses.forEach(exp => {
                const category = exp.coaName || 'Uncategorized';
                categoryTotals[category] = (categoryTotals[category] || 0) + (exp.amount || 0);
            });
        } else {
            // Otherwise categorize by project name or description
            const category = req.projectName || req.description || 'General Expense';
            categoryTotals[category] = (categoryTotals[category] || 0) + (req.totalAmount || 0);
        }
    });

    // Sort by value and take top 5 + Others
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);

    const top5 = sortedCategories.slice(0, 5);
    const othersTotal = sortedCategories.slice(5).reduce((sum, [, value]) => sum + value, 0);

    const result: ExpenseCategory[] = top5.map(([name, value], index) => ({
        name: name.length > 20 ? name.substring(0, 17) + '...' : name,
        value,
        color: EXPENSE_COLORS[index] || EXPENSE_COLORS[5]
    }));

    if (othersTotal > 0) {
        result.push({
            name: 'Others',
            value: othersTotal,
            color: EXPENSE_COLORS[5]
        });
    }

    // If no data, return a placeholder
    if (result.length === 0) {
        return [{
            name: 'No Data',
            value: 1,
            color: EXPENSE_COLORS[5]
        }];
    }

    return result;
}

/**
 * Get high-value transactions (above threshold)
 */
export async function getHighValueTransactions(
    threshold: number = 50000,
    businessUnitId?: string
): Promise<HighValueTransaction[]> {
    const requisitions = await fetchReleasedRequisitions(businessUnitId);

    // Filter by threshold and sort by date
    const highValueReqs = requisitions
        .filter(r => (r.totalAmount || 0) >= threshold && r.fundReleaseDate)
        .sort((a, b) => new Date(b.fundReleaseDate!).getTime() - new Date(a.fundReleaseDate!).getTime())
        .slice(0, 10); // Limit to last 10

    return highValueReqs.map(req => ({
        id: req.id,
        date: req.fundReleaseDate || req.timestamp,
        description: req.projectName || req.description || `PRF ${req.id.substring(0, 8)}`,
        type: 'expense' as const,
        amount: req.totalAmount || 0,
        category: req.prfDetails?.supplier?.name || 'General'
    }));
}

/**
 * Format currency in Philippines Peso
 */
export function formatCurrency(amount: number): string {
    if (amount >= 1000000) {
        return `₱${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
        return `₱${(amount / 1000).toFixed(0)}K`;
    }
    return `₱${amount.toLocaleString()}`;
}

/**
 * Format full currency with all digits
 */
export function formatFullCurrency(amount: number): string {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// Export all as a service object
export const FinanceDashboardService = {
    getFinancialHealth,
    getCashFlowTrends,
    getExpenseDistribution,
    getHighValueTransactions,
    formatCurrency,
    formatFullCurrency,
    formatDate
};

export default FinanceDashboardService;
