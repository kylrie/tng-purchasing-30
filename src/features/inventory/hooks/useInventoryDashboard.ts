import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { InventoryDashboardService } from '../services/inventory-dashboard.service';
import type { DashboardKPIs, DashboardPeriod } from '../services/inventory-dashboard.service';
import { getRollingStaffVariance } from '../services/staff-variance.service';
import type { StaffVarianceRecord } from '../services/staff-variance.service';
import { InvestigationsService } from '../services/investigations.service';
import type { InvestigationCase } from '../services/investigations.service';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';

function getDateRangeFromPeriod(period: DashboardPeriod): [Date, Date] {
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
    return [start, end];
}

export function useInventoryDashboard(userOrBuId: User | string | undefined, timeFilter: DashboardPeriod) {
    const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
    const [shiftVariances, setShiftVariances] = useState<StaffVarianceRecord[]>([]);
    const [investigations, setInvestigations] = useState<InvestigationCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        if (!userOrBuId) return;
        setLoading(true);
        setError(null);
        const dateRange = getDateRangeFromPeriod(timeFilter);
        
        // Log 1: Hook Inputs
        console.log("1. Hook Inputs:", { userOrBuId, dateRange });
        try {
            const startTs = Timestamp.fromDate(dateRange[0]);
            const endTs = Timestamp.fromDate(dateRange[1]);
            
            const tenantConstraints = typeof userOrBuId === 'string'
                ? (userOrBuId === 'ALL' ? [] : [where('businessUnitId', '==', userOrBuId)])
                : getTenantConstraints(userOrBuId, 'businessUnitId');
            
            // Log 2: Date Formats
            console.log("2. Date Formats (Firestore Timestamps):", { startTs, endTs });

            // Diagnostic Query 1: THEORETICAL_USAGE
            // NOTE: stock_transactions are written with field `timestamp` (not `createdAt`)
            const usageQuery = query(
                collection(db, 'stock_transactions'),
                ...tenantConstraints,
                where('type', '==', 'THEORETICAL_USAGE'),
                where('timestamp', '>=', startTs),
                where('timestamp', '<=', endTs)
            );
            
            // Diagnostic Query 2: ADJUSTMENT
            // NOTE: Same field — use `timestamp` not `createdAt`
            const adjustmentQuery = query(
                collection(db, 'stock_transactions'),
                ...tenantConstraints,
                where('type', '==', 'ADJUSTMENT'),
                where('timestamp', '>=', startTs),
                where('timestamp', '<=', endTs)
            );

            // Diagnostic Query 3: RECEIVE
            const receiveQuery = query(
                collection(db, 'stock_transactions'),
                ...tenantConstraints,
                where('type', '==', 'RECEIVE'),
                where('timestamp', '>=', startTs),
                where('timestamp', '<=', endTs)
            );

            // Fetch and wrap in try/catch to log specific index errors
            let usageSnap, adjSnap, recvSnap;
            try {
                [usageSnap, adjSnap, recvSnap] = await Promise.all([
                    getDocs(usageQuery),
                    getDocs(adjustmentQuery),
                    getDocs(receiveQuery)
                ]);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error("FIREBASE QUERY ERROR (Index missing?):", message);
                throw err; // Re-throw to hit the outer catch block
            }

            // Log 3: Raw Query Results 
            console.log("3. Raw Transactions Found:", {
                theoreticalUsageCount: usageSnap.docs.length,
                adjustmentCount: adjSnap.docs.length,
                receiveCount: recvSnap.docs.length
            });

            let expectedUsage = 0;
            const itemStats: Record<string, { soldQty: number, recvQty: number }> = {};

            usageSnap.forEach(doc => {
                const data = doc.data();
                // Use pre-computed totalValue (unitCost * quantity) written at import time.
                // Fall back to qty * unitCost for older transactions that may not have totalValue.
                const value = data.totalValue ?? (Math.abs(data.quantity || 0) * (data.unitCost || 0));
                expectedUsage += value;
                
                const itemId = data.itemId;
                if (!itemStats[itemId]) itemStats[itemId] = { soldQty: 0, recvQty: 0 };
                itemStats[itemId].soldQty += Math.abs(data.quantity || 0);
            });

            let unexplainedGap = 0;
            adjSnap.forEach(doc => {
                const data = doc.data();
                const value = data.totalValue ?? (Math.abs(data.quantity || 0) * (data.unitCost || 0));
                unexplainedGap += value;
            });

            // Actual Usage = Expected (theoretical) + Unexplained (adjustments/shrinkage)
            const actualUsage = expectedUsage + unexplainedGap;

            recvSnap.forEach(doc => {
                const data = doc.data();
                const itemId = data.itemId;
                if (!itemStats[itemId]) itemStats[itemId] = { soldQty: 0, recvQty: 0 };
                itemStats[itemId].recvQty += Math.abs(data.quantity || 0);
            });

            // ── POS Sales by FG/Menu Category ──
            // Category Risk Panel must group by the Finished Good's category (e.g. 'Food',
            // 'Beverage') — NOT by the raw-material inventory category ('Dry Goods', 'Mixers').
            // POS sales records already carry the FG category, so we use them directly.
            const posSalesQuery = query(
                collection(db, 'pos_sales'),
                ...tenantConstraints,
                where('createdAt', '>=', startTs),
                where('createdAt', '<=', endTs)
            );
            const posSalesSnap = await getDocs(posSalesQuery);

            // Build per-FG-category aggregates from POS sales:
            //   salesValue   = sum(amount)  — POS revenue
            //   expectedValue = sum(costs)  — theoretical food cost (recipe cost × qty sold)
            const categoryRiskMap: Record<string, { sales: number; expected: number; loss: number }> = {};
            posSalesSnap.forEach(doc => {
                const data = doc.data();
                const cat = (data.category || 'Other').trim();
                if (!categoryRiskMap[cat]) categoryRiskMap[cat] = { sales: 0, expected: 0, loss: 0 };
                categoryRiskMap[cat].sales += (data.amount || 0);
                categoryRiskMap[cat].expected += (data.costs || 0);
            });

            // Attribute ADJUSTMENT (unexplained gap/loss) to a 'Kitchen Loss' fallback
            // since direct stock-count adjustments aren't tied to a specific FG sale.
            if (unexplainedGap > 0) {
                if (!categoryRiskMap['Kitchen Loss']) categoryRiskMap['Kitchen Loss'] = { sales: 0, expected: 0, loss: 0 };
                categoryRiskMap['Kitchen Loss'].loss += unexplainedGap;
            }

            // Log 4: Math Check
            console.log("4. Calculated KPIs:", { expectedUsage, unexplainedGap, categoryRiskMap });

            // Since this is diagnostic mode, we still load the rest of the KPIs from the service 
            // but we override the theoreticalUsage and unexplainedVariance with our direct transaction query results!
            const [kpiData, varianceData] = await Promise.all([
                InventoryDashboardService.getDashboardKPIs(userOrBuId, timeFilter),
                getRollingStaffVariance(userOrBuId, 7)
            ]);

            if (kpiData) {
                kpiData.theoreticalUsage = expectedUsage;
                kpiData.actualUsage = actualUsage;
                kpiData.unexplainedVariance = unexplainedGap;
                
                // Recalculate variance percentage based on new values
                if (expectedUsage > 0) {
                    kpiData.variancePercent = (unexplainedGap / expectedUsage) * 100;
                    const absVP = Math.abs(kpiData.variancePercent);
                    kpiData.varianceStatus = absVP <= 2 ? 'green' : absVP <= 5 ? 'yellow' : 'red';
                } else {
                    kpiData.variancePercent = 0;
                    kpiData.varianceStatus = 'green';
                }

                // ── Build Category Risk Panel from FG/Menu categories ──
                // Replace the service-level inventory-category grouping with POS-derived
                // FG categories so Sales, Expected, and Loss all align.
                kpiData.categoryRisks = Object.entries(categoryRiskMap).map(([name, data]) => ({
                    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    name,
                    salesValue: data.sales,
                    expectedValue: data.expected,
                    actualValue: data.expected - data.loss,
                    lossValue: data.loss,
                    variancePercent: data.expected > 0
                        ? (data.loss / data.expected) * 100
                        : 0,
                })).sort((a, b) => Math.abs(b.salesValue) - Math.abs(a.salesValue));

                if (kpiData.suspiciousItems) {
                    // DEFENSIVE: Strip out any FINISHED_GOOD items that might have leaked
                    // through. Only RAW_MATERIAL and PRODUCTION belong on this dashboard.
                    const TRACKABLE_TYPES = new Set(['RAW_MATERIAL', 'PRODUCTION']);
                    const trackableItems = kpiData.suspiciousItems.filter(
                        (item) => TRACKABLE_TYPES.has(item.type)
                    );

                    kpiData.suspiciousItems = trackableItems
                        .map(item => {
                            const stats = itemStats[item.itemId] || { soldQty: 0, recvQty: 0 };
                            const soldQty = stats.soldQty;
                            const recvQty = stats.recvQty;
                            const expClose = item.expectedClosing || 0;
                            
                            // Calculate OPEN: EXP. CLOSE = OPEN + RECV - SOLD => OPEN = EXP. CLOSE - RECV + SOLD
                            const openQty = expClose - recvQty + soldQty;
                            
                            return {
                                ...item,
                                soldQty,
                                recvQty,
                                openQty
                            };
                        })
                        // Only show items with a real variance — hide perfectly balanced rows
                        .filter(item => item.varianceQty !== 0 || item.varianceValue !== 0);
                }
            }

            setKpis(kpiData);
            setShiftVariances(varianceData);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
            console.error("FIREBASE QUERY ERROR:", message);
            setError(message);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    }, [userOrBuId, timeFilter]);

    // Fetch KPI and Variance data on mount/filter change
    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Subscribe to real-time investigations
    useEffect(() => {
        if (!userOrBuId) return;

        const unsubscribe = InvestigationsService.subscribeToInvestigations(
            userOrBuId,
            (cases) => {
                setInvestigations(cases);
            }
        );

        return () => unsubscribe();
    }, [userOrBuId]);

    return {
        kpis,
        shiftVariances,
        investigations,
        loading,
        error,
        refreshData: fetchDashboardData,
        refetch: fetchDashboardData,
    };
}
