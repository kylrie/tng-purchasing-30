import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { InventoryReportsService } from './inventory.reports.service';
import { InventoryService } from './inventory.service';
import type { PosSaleRecord } from '../../pos/types/pos-import.types';

const COL = {
    POS_SALES: 'pos_sales',
};

// ============================================================
// TYPES
// ============================================================

export interface SuspiciousItem {
    itemName: string;
    category: string;
    expectedClosing: number;   // theoreticalStock
    actualClosing: number;     // currentStock (physical count)
    varianceQty: number;       // expected - actual
    varianceValue: number;     // varianceQty × costPerUnit
    variancePercent: number;
    costPerUnit: number;
    status: 'Normal' | 'Watch' | 'Investigate';
}

export interface CategoryRiskRecord {
    id: string;
    name: string;
    variancePercent: number;
    lossValue: number;
    expectedValue: number;
    actualValue: number;
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

    /**
     * Fetch pos_sales records for a business unit within a date range.
     * Uses `createdAt` (Timestamp) for filtering.
     */
    static async getSalesByDateRange(
        businessUnitId: string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<PosSaleRecord[]> {
        const { start, end } = customRange && period === 'custom' ? customRange : getDateRange(period);

        const q = query(
            collection(db, COL.POS_SALES),
            where('businessUnitId', '==', businessUnitId),
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
        businessUnitId: string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<number> {
        try {
            const sales = await this.getSalesByDateRange(businessUnitId, period, customRange);
            return sales.reduce((sum, s) => sum + (s.amount || 0), 0);
        } catch (error) {
            console.error('Error fetching net sales:', error);
            return 0;
        }
    }

    /**
     * Card 2: Theoretical Usage Value (food cost from imported POS sales)
     */
    static async getTheoreticalUsage(
        businessUnitId: string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<number> {
        try {
            const sales = await this.getSalesByDateRange(businessUnitId, period, customRange);
            return sales.reduce((sum, s) => sum + (s.costs || 0), 0);
        } catch (error) {
            console.error('Error calculating theoretical usage:', error);
            return 0;
        }
    }

    /**
     * Card 3: Actual Usage Value
     */
    static async getActualUsage(businessUnitId: string): Promise<number> {
        try {
            const sessions = await InventoryReportsService.getCompletedSessions(businessUnitId);

            if (sessions.length < 2) {
                return 0;
            }

            const endSession = sessions[0];
            const startSession = sessions[1];

            const report = await InventoryReportsService.generateVarianceReport(
                startSession.id,
                endSession.id
            );

            let totalActualUsage = 0;
            for (const item of report.items) {
                const usedQty = item.starting + item.purchased - item.actual;
                totalActualUsage += usedQty * item.costPerUnit;
            }

            return totalActualUsage;
        } catch (error) {
            console.error('Error calculating actual usage:', error);
            return 0;
        }
    }

    /**
     * Section 2: Top 10 Suspicious Items & Category Risks
     * Compares theoreticalStock (expected) vs currentStock (physical count)
     */
    static async getInventoryAnalysis(businessUnitId: string): Promise<{ suspiciousItems: SuspiciousItem[], categoryRisks: CategoryRiskRecord[] }> {
        try {
            const items = await InventoryService.getInventory(businessUnitId, 'FINISHED_GOOD');

            const allItems: SuspiciousItem[] = items
                .filter(item => item.isActive)
                .map(item => {
                    const expected = item.theoreticalStock ?? item.currentStock;
                    const actual = item.currentStock;
                    const varianceQty = expected - actual;
                    const varianceValue = varianceQty * item.costPerUnit;
                    const variancePercent = expected > 0
                        ? (varianceQty / expected) * 100
                        : 0;

                    return {
                        itemName: item.name,
                        category: item.category || 'Other',
                        expectedClosing: expected,
                        actualClosing: actual,
                        varianceQty,
                        varianceValue,
                        variancePercent,
                        costPerUnit: item.costPerUnit,
                        status: getItemStatus(variancePercent),
                    };
                });

            // Build Category Risks
            const categoryMap = new Map<string, { expected: number, actual: number, loss: number }>();

            allItems.forEach(item => {
                const mapItem = categoryMap.get(item.category) || { expected: 0, actual: 0, loss: 0 };
                mapItem.expected += item.expectedClosing * item.costPerUnit;
                mapItem.actual += item.actualClosing * item.costPerUnit;
                mapItem.loss += item.varianceValue;
                categoryMap.set(item.category, mapItem);
            });

            const categoryRisks: CategoryRiskRecord[] = Array.from(categoryMap.entries()).map(([name, data]) => {
                const variancePercent = data.expected > 0 ? (data.loss / data.expected) * 100 : 0;
                return {
                    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    name,
                    variancePercent,
                    lossValue: data.loss,
                    expectedValue: data.expected,
                    actualValue: data.actual
                };
            }).sort((a, b) => Math.abs(b.lossValue) - Math.abs(a.lossValue));

            // Return top 10 suspicious items
            const suspiciousItems = [...allItems]
                .sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue))
                .slice(0, 10);

            return { suspiciousItems, categoryRisks };
        } catch (error) {
            console.error('Error calculating inventory analysis:', error);
            return { suspiciousItems: [], categoryRisks: [] };
        }
    }

    /**
     * Get all 5 KPI cards + suspicious items in one call
     */
    static async getDashboardKPIs(
        businessUnitId: string,
        period: DashboardPeriod,
        customRange?: DateRange
    ): Promise<DashboardKPIs> {
        const periodLabels: Record<DashboardPeriod, string> = {
            today: 'Today',
            week: 'This Week',
            month: 'This Month',
            custom: 'Custom Range'
        };
        const periodLabel = periodLabels[period];

        try {
            const [netSales, theoreticalUsage, actualUsage, inventoryAnalysis] = await Promise.all([
                this.getNetSales(businessUnitId, period, customRange),
                this.getTheoreticalUsage(businessUnitId, period, customRange),
                this.getActualUsage(businessUnitId),
                this.getInventoryAnalysis(businessUnitId)
            ]);

            const recordedWaste = 0;
            const unexplainedVariance = actualUsage - theoreticalUsage - recordedWaste;

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
                recordedWaste,
                suspiciousItems: inventoryAnalysis.suspiciousItems,
                categoryRisks: inventoryAnalysis.categoryRisks
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
                categoryRisks: []
            };
        }
    }
}

export default InventoryDashboardService;
