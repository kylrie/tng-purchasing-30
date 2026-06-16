import { collection, query, where, getDocs, Timestamp, QueryConstraint } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { PosSaleRecord } from '../../pos/types/pos-import.types';
import type { InventoryItem } from '../types/InventoryItem';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';
import { resolveItemCostPerUnit } from '../utils/inventory.utils';

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
    // LEDGER AGGREGATION — Transaction-based queries
    // ============================================================

    /**
     * Aggregate stock_transactions by type(s) for a date range.
     * Joins with inventory_items to get costPerUnit for peso calculation.
     * Returns Map<itemId, { itemName, category, totalQty, totalPeso, costPerUnit }>
     *
     * Uses client-side date filtering to avoid composite Firestore indexes
     * (same proven pattern as ReconService.aggregateTransactions).
     *
     * @param tenantConstraints - Pre-computed QueryConstraints for BU scoping.
     */
    private static async aggregateStockTransactions(
        tenantConstraints: QueryConstraint[],
        startDate: Date,
        endDate: Date,
        types: string[]
    ): Promise<Map<string, { itemName: string; category: string; totalQty: number; totalPeso: number; costPerUnit: number; type: string; recipeUnit: string; conversionRate: number }>> {
        const result = new Map<string, { itemName: string; category: string; totalQty: number; totalPeso: number; costPerUnit: number; type: string; recipeUnit: string; conversionRate: number }>();

        try {
            // 1. Fetch all inventory items for costPerUnit + category lookup
            const itemsQ = query(
                collection(db, COL.INVENTORY_ITEMS),
                ...tenantConstraints
            );
            const itemsSnap = await getDocs(itemsQ);
            const costMap = new Map<string, { costPerUnit: number; name: string; category: string; type: string; recipeUnit: string; conversionRate: number }>();
            for (const d of itemsSnap.docs) {
                const data = d.data() as InventoryItem;
                costMap.set(d.id, {
                    costPerUnit: resolveItemCostPerUnit(data),
                    name: data.name || 'Unknown',
                    category: data.category || 'Other',
                    type: data.type || 'Other',
                    recipeUnit: data.units?.recipeUnit || 'pcs',
                    conversionRate: data.units?.conversion || 1,
                });
            }

            // 2. Fetch stock_transactions scoped to the same tenant constraints
            const txQ = query(
                collection(db, COL.STOCK_TRANSACTIONS),
                ...tenantConstraints
            );
            const txSnap = await getDocs(txQ);

            for (const docSnap of txSnap.docs) {
                const data = docSnap.data();
                const txType = data.type as string;
                if (!types.includes(txType)) continue;

                // Client-side date filter
                const txDate = data.timestamp?.toDate?.() || new Date(data.timestamp);
                if (txDate < startDate || txDate > endDate) continue;

                const itemId = data.itemId as string;
                const qty = Math.abs(data.quantity as number || 0);
                const itemInfo = costMap.get(itemId);
                const costPerUnit = itemInfo?.costPerUnit || 0;
                const peso = qty * costPerUnit;

                let entry = result.get(itemId);
                if (!entry) {
                    entry = {
                        itemName: (data.itemName as string) || itemInfo?.name || 'Unknown',
                        category: itemInfo?.category || 'Other',
                        totalQty: 0,
                        totalPeso: 0,
                        costPerUnit: costPerUnit,
                        type: itemInfo?.type || 'Other',
                        recipeUnit: itemInfo?.recipeUnit || 'pcs',
                        conversionRate: itemInfo?.conversionRate || 1,
                    };
                    result.set(itemId, entry);
                }
                entry.totalQty += qty;
                entry.totalPeso += peso;
            }
        } catch (error) {
            console.error('Error aggregating stock transactions:', error);
        }

        return result;
    }

    /**
     * Card 2: Theoretical Usage (CoGS) — Ledger Method
     * Sum quantity × costPerUnit for THEORETICAL_USAGE transactions in the date range.
     * These are created by BOM explosion during POS import.
     */
    static async getTheoreticalUsage(
        userOrBuId: User | string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<number> {
        const { start, end } = customRange && period === 'custom' ? customRange : getDateRange(period);
        const tenantConstraints = this.resolveConstraints(userOrBuId, 'businessUnitId');
        const txMap = await this.aggregateStockTransactions(
            tenantConstraints, start, end, ['THEORETICAL_USAGE']
        );
        let total = 0;
        for (const [, entry] of txMap) {
            total += entry.totalPeso;
        }
        return total;
    }

    /**
     * Unexplained Gap (Loss) — Ledger Method
     * Sum quantity × costPerUnit for ADJUSTMENT transactions in the date range.
     * These are created by ReconService.savePhysicalCounts() when physical
     * counts differ from system-expected stock.
     */
    static async getUnexplainedGap(
        userOrBuId: User | string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<number> {
        const { start, end } = customRange && period === 'custom' ? customRange : getDateRange(period);
        const tenantConstraints = this.resolveConstraints(userOrBuId, 'businessUnitId');
        const txMap = await this.aggregateStockTransactions(
            tenantConstraints, start, end, ['ADJUSTMENT']
        );
        // ADJUSTMENT quantity is signed: negative = loss, positive = surplus
        // We want the net gap (negative = unexplained loss)
        let total = 0;
        for (const [, entry] of txMap) {
            total += entry.totalPeso;
        }
        return total;
    }

    /**
     * Top 10 Suspicious Items & Category Risks — Ledger Method
     * Groups ADJUSTMENT transactions by itemId, sums peso value,
     * sorts descending by absolute peso value, slices top 10.
     * Completely time-bound to the selected period.
     */
    static async getInventoryAnalysis(
        userOrBuId: User | string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<{ suspiciousItems: SuspiciousItem[]; categoryRisks: CategoryRiskRecord[]; itemCategoryMap: Record<string, string> }> {
        const { start, end } = customRange && period === 'custom' ? customRange : getDateRange(period);
        const tenantConstraints = this.resolveConstraints(userOrBuId, 'businessUnitId');

        try {
            // Get all ADJUSTMENT transactions grouped by item
            const adjustmentMap = await this.aggregateStockTransactions(
                tenantConstraints, start, end, ['ADJUSTMENT']
            );

            // Get THEORETICAL_USAGE transactions grouped by item (for expected closing calc)
            const theoreticalMap = await this.aggregateStockTransactions(
                tenantConstraints, start, end, ['THEORETICAL_USAGE']
            );

            // Build suspicious items from ADJUSTMENT transactions
            const allItems: SuspiciousItem[] = [];
            const itemCategoryMap: Record<string, string> = {};

            for (const [itemId, adjEntry] of adjustmentMap) {
                const theoEntry = theoreticalMap.get(itemId) || null;
                const expectedClosing = theoEntry?.totalQty || 0;
                const varianceQty = adjEntry.totalQty; // ADJUSTMENT qty (signed)
                const varianceValue = adjEntry.totalPeso; // ADJUSTMENT peso (signed)
                const variancePercent = expectedClosing > 0
                    ? (Math.abs(varianceQty) / expectedClosing) * 100
                    : (varianceQty !== 0 ? 100 : 0);

                itemCategoryMap[itemId] = adjEntry.category;

                allItems.push({
                    itemId,
                    itemName: adjEntry.itemName,
                    type: adjEntry.type,
                    recipeUnit: adjEntry.recipeUnit,
                    conversionRate: adjEntry.conversionRate,
                    category: adjEntry.category,
                    expectedClosing,
                    actualClosing: expectedClosing - varianceQty,
                    varianceQty,
                    varianceValue,
                    variancePercent,
                    costPerUnit: adjEntry.costPerUnit,
                    status: getItemStatus(variancePercent),
                });
            }

            // Build Category Risks from the same ADJUSTMENT data
            const categoryMap = new Map<string, { expected: number; actual: number; loss: number }>();

            allItems.forEach(item => {
                const catData = categoryMap.get(item.category) || { expected: 0, actual: 0, loss: 0 };
                catData.expected += item.expectedClosing * item.costPerUnit;
                catData.actual += item.actualClosing * item.costPerUnit;
                catData.loss += item.varianceValue;
                categoryMap.set(item.category, catData);
            });

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

            // Top 10 suspicious items sorted by absolute peso value
            const suspiciousItems = [...allItems]
                .sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue))
                .slice(0, 10);

            return { suspiciousItems, categoryRisks, itemCategoryMap };
        } catch (error) {
            console.error('Error calculating inventory analysis:', error);
            return { suspiciousItems: [], categoryRisks: [], itemCategoryMap: {} };
        }
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

        try {
            const [netSales, theoreticalUsage, unexplainedVariance, inventoryAnalysis] = await Promise.all([
                this.getNetSales(userOrBuId, period, customRange),
                this.getTheoreticalUsage(userOrBuId, period, customRange),
                this.getUnexplainedGap(userOrBuId, period, customRange),
                this.getInventoryAnalysis(userOrBuId, period, customRange),
            ]);

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
        } catch (error) {
            console.error('Error loading dashboard KPIs:', error);
            return {
                netSales: 0,
                theoreticalUsage: 0,
                actualUsage: 0,
                unexplainedVariance: 0,
                variancePercent: 0,
                varianceStatus: 'green',
                periodLabel,
                recordedWaste: 0,
                suspiciousItems: [],
                categoryRisks: [],
                itemCategoryMap: {},
            };
        }
    }
}

export default InventoryDashboardService;
