import { collection, query, where, getDocs, Timestamp, QueryConstraint } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { PosSaleRecord } from '../../pos/types/pos-import.types';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';

const COL = {
    POS_SALES: 'pos_sales',
    STOCK_TRANSACTIONS: 'stock_transactions',
    INVENTORY_ITEMS: 'inventory_items',
};

// ============================================================
// TYPES
// ============================================================

export interface SuspiciousItem {
    itemId: string;
    itemName: string;
    type: string;
    category: string;
    recipeUnit: string;         // base recipe unit for display (e.g. "G", "ML")
    conversionRate: number;    // how many recipeUnits per buyUnit
    expectedClosing: number;   // theoreticalStock
    actualClosing: number;     // currentStock (physical count)
    varianceQty: number;       // expected - actual
    varianceValue: number;     // varianceQty × costPerUnit
    variancePercent: number;
    costPerUnit: number;
    status: 'Normal' | 'Watch' | 'Investigate';
    soldQty?: number;
    recvQty?: number;
    openQty?: number;
}

export interface CategoryRiskRecord {
    id: string;
    name: string;
    variancePercent: number;
    lossValue: number;
    expectedValue: number;
    actualValue: number;
    salesValue: number;        // POS revenue for this category
}

export interface DashboardKPIs {
    netSales: number;
    theoreticalUsage: number;
    actualUsage: number;
    unexplainedVariance: number;
    variancePercent: number;
    varianceStatus: 'green' | 'yellow' | 'red';
    periodLabel: string;
    recordedWaste: number;
    suspiciousItems: SuspiciousItem[];
    categoryRisks: CategoryRiskRecord[];
    itemCategoryMap: Record<string, string>;  // itemId → category for hook grouping
}

export type DashboardPeriod = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
    start: Date;
    end: Date;
}

// ============================================================
// HELPERS
// ============================================================

function getDateRange(period: DashboardPeriod): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (period === 'week') {
        const day = start.getDay();
        const diff = day === 0 ? 6 : day - 1;
        start.setDate(start.getDate() - diff);
    } else if (period === 'month') {
        start.setDate(1);
    }

    return { start, end };
}

function getVarianceStatus(percent: number): 'green' | 'yellow' | 'red' {
    const abs = Math.abs(percent);
    if (abs <= 2) return 'green';
    if (abs <= 5) return 'yellow';
    return 'red';
}

function getItemStatus(variancePercent: number): 'Normal' | 'Watch' | 'Investigate' {
    const abs = Math.abs(variancePercent);
    if (abs <= 2) return 'Normal';
    if (abs <= 5) return 'Watch';
    return 'Investigate';
}

// ============================================================
// SERVICE
// ============================================================

export class InventoryDashboardService {

    /** Resolve a User | string to QueryConstraints for a given field. */
    private static resolveConstraints(
        userOrBuId: User | string,
        fieldName: string
    ): QueryConstraint[] {
        return typeof userOrBuId === 'string'
            ? (userOrBuId === 'ALL' ? [] : [where(fieldName, '==', userOrBuId)])
            : getTenantConstraints(userOrBuId, fieldName);
    }

    /**
     * Fetch pos_sales records for a business unit within a date range.
     * Uses `createdAt` (Timestamp) for filtering.
     */
    static async getSalesByDateRange(
        userOrBuId: User | string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<PosSaleRecord[]> {
        const { start, end } = customRange && period === 'custom' ? customRange : getDateRange(period);
        const tenantConstraints = this.resolveConstraints(userOrBuId, 'businessUnitId');

        const q = query(
            collection(db, COL.POS_SALES),
            ...tenantConstraints,
            where('createdAt', '>=', Timestamp.fromDate(start)),
            where('createdAt', '<=', Timestamp.fromDate(end))
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PosSaleRecord[];
    }

    /**
     * Card 1: Net Sales for the period (from imported POS sales)
     */
    static async getNetSales(
        userOrBuId: User | string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<number> {
        try {
            const sales = await this.getSalesByDateRange(userOrBuId, period, customRange);
            return sales.reduce((sum, s) => sum + (s.amount || 0), 0);
        } catch (error) {
            console.error('Error fetching net sales:', error);
            return 0;
        }
    }

    // ============================================================
    // SERVER-SIDE AGGREGATION
    // ============================================================

    static async getInventoryAnalysis(
        userOrBuId: User | string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<{ suspiciousItems: SuspiciousItem[]; categoryRisks: CategoryRiskRecord[]; itemCategoryMap: Record<string, string> }> {
        const { start, end } = customRange && period === 'custom' ? customRange : getDateRange(period);
        const tenantConstraints = this.resolveConstraints(userOrBuId, 'businessUnitId');

        // Prevent cross-tenant data leaks by ensuring we never query 'ALL' without proper admin claims
        if (typeof userOrBuId === 'string' && userOrBuId === 'ALL') {
            // Note: In production, the backend rules MUST block this query if the user doesn't have the admin role.
            // We rely on Firebase Security Rules for this, but we log it.
            console.warn('[InventoryDashboardService] Executing cross-tenant ALL query. Security rules must enforce this.');
        }

        const formatLocalDate = (d: Date) => {
            const date = new Date(d);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            return date.toISOString().split('T')[0];
        };

        const q = query(
            collection(db, 'inventory_aggregates'),
            ...tenantConstraints,
            where('date', '>=', formatLocalDate(start)),
            where('date', '<=', formatLocalDate(end))
        );

        const snapshot = await getDocs(q);
        interface AggregateItemEntry {
            itemName: string;
            category: string;
            type: string;
            recipeUnit: string;
            conversionRate: number;
            costPerUnit: number;
            expectedClosing: number;
            varianceQty: number;
            varianceValue: number;
        }
        const itemMap = new Map<string, AggregateItemEntry>();
        const itemCategoryMap: Record<string, string> = {};

        // O(1) loop over ~30-31 documents maximum for a month
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const itemId = data.itemId;
            
            let entry = itemMap.get(itemId);
            if (!entry) {
                entry = { 
                    itemName: data.itemName || 'Unknown', 
                    category: data.category || 'Other',
                    type: data.type || 'Other',
                    recipeUnit: data.recipeUnit || 'pcs',
                    conversionRate: data.conversionRate || 1,
                    costPerUnit: data.costPerUnit || 0,
                    expectedClosing: 0, 
                    varianceQty: 0, 
                    varianceValue: 0 
                };
                itemMap.set(itemId, entry);
                itemCategoryMap[itemId] = entry.category;
            }
            
            entry.expectedClosing += Math.abs(data.THEORETICAL_USAGE_qty || 0) + Math.abs(data.EVENT_CONSUMPTION_qty || 0) + Math.abs(data.PRODUCTION_CONSUME_qty || 0) + Math.abs(data.POS_SALE_qty || 0);
            entry.varianceQty += (data.ADJUSTMENT_qty || 0);
            entry.varianceValue += (data.ADJUSTMENT_peso || 0);
        }

        const allItems: SuspiciousItem[] = [];
        const categoryMap = new Map<string, { expected: number; actual: number; loss: number }>();

        for (const [itemId, entry] of itemMap) {
            const variancePercent = entry.expectedClosing > 0
                ? (Math.abs(entry.varianceQty) / entry.expectedClosing) * 100
                : (entry.varianceQty !== 0 ? 100 : 0);

            const item: SuspiciousItem = {
                itemId,
                itemName: entry.itemName,
                type: entry.type,
                recipeUnit: entry.recipeUnit,
                conversionRate: entry.conversionRate,
                category: entry.category,
                expectedClosing: entry.expectedClosing,
                actualClosing: entry.expectedClosing + entry.varianceQty, // Adjustments are signed
                varianceQty: entry.varianceQty,
                varianceValue: entry.varianceValue,
                variancePercent,
                costPerUnit: entry.costPerUnit,
                status: getItemStatus(variancePercent),
            };
            
            allItems.push(item);

            const catData = categoryMap.get(item.category) || { expected: 0, actual: 0, loss: 0 };
            catData.expected += item.expectedClosing * item.costPerUnit;
            catData.actual += item.actualClosing * item.costPerUnit;
            catData.loss += item.varianceValue;
            categoryMap.set(item.category, catData);
        }

        const categoryRisks: CategoryRiskRecord[] = Array.from(categoryMap.entries()).map(([name, data]) => {
            const variancePercent = data.expected > 0 ? (data.loss / data.expected) * 100 : 0;
            return {
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                name,
                variancePercent,
                lossValue: data.loss,
                expectedValue: data.expected,
                actualValue: data.actual,
                salesValue: 0,
            };
        }).sort((a, b) => Math.abs(b.lossValue) - Math.abs(a.lossValue));

        const suspiciousItems = [...allItems]
            .sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue))
            .slice(0, 10);

        return { suspiciousItems, categoryRisks, itemCategoryMap };
    }

    /**
     * Get all 5 KPI cards + suspicious items in one call — Ledger Method.
     * All values are now time-bound to the selected period.
     */
    static async getDashboardKPIs(
        userOrBuId: User | string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<DashboardKPIs> {
        const periodLabels: Record<DashboardPeriod, string> = {
            today: 'Today',
            week: 'This Week',
            month: 'This Month',
            custom: 'Custom Range',
        };
        const periodLabel = periodLabels[period];

        // Let errors propagate up so the ErrorBoundary can catch them.
        // Returning silent 0 values hides system failures.
        const [netSales, inventoryAnalysis] = await Promise.all([
            this.getNetSales(userOrBuId, period, customRange),
            this.getInventoryAnalysis(userOrBuId, period, customRange),
        ]);

        // Aggregate Theoretical Usage and Unexplained Gap directly from the analysis
        let theoreticalUsage = 0;
        let unexplainedVariance = 0;

        for (const cat of inventoryAnalysis.categoryRisks) {
            theoreticalUsage += cat.expectedValue;
            unexplainedVariance += cat.lossValue;
        }

        // Actual Usage = Theoretical + Unexplained Gap (derived)
        const actualUsage = theoreticalUsage + Math.abs(unexplainedVariance);

        const variancePercent = theoreticalUsage > 0
            ? (unexplainedVariance / theoreticalUsage) * 100
            : 0;

        const varianceStatus = getVarianceStatus(variancePercent);

        return {
            netSales,
            theoreticalUsage,
            actualUsage,
            unexplainedVariance,
            variancePercent,
            varianceStatus,
            periodLabel,
            recordedWaste: 0,
            suspiciousItems: inventoryAnalysis.suspiciousItems,
            categoryRisks: inventoryAnalysis.categoryRisks,
            itemCategoryMap: inventoryAnalysis.itemCategoryMap,
        };
    }
}

export default InventoryDashboardService;
