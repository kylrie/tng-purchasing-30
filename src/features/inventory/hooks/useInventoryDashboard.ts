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
        try {
            // ── Single source of truth: let the service compute all KPIs ──
            const [kpiData, varianceData] = await Promise.all([
                InventoryDashboardService.getDashboardKPIs(userOrBuId, timeFilter),
                getRollingStaffVariance(userOrBuId, 7)
            ]);

            if (kpiData) {
                // ── POS Sales by FG/Menu Category ──
                // Category Risk Panel must group by the Finished Good's category
                // (e.g. 'Food', 'Beverage') — NOT by the raw-material inventory
                // category ('Dry Goods', 'Mixers'). POS sales records already carry
                // the FG category, so we query them directly.
                const dateRange = getDateRangeFromPeriod(timeFilter);
                const startTs = Timestamp.fromDate(dateRange[0]);
                const endTs = Timestamp.fromDate(dateRange[1]);
                const tenantConstraints = typeof userOrBuId === 'string'
                    ? (userOrBuId === 'ALL' ? [] : [where('businessUnitId', '==', userOrBuId)])
                    : getTenantConstraints(userOrBuId, 'businessUnitId');

                const posSalesQuery = query(
                    collection(db, 'pos_sales'),
                    ...tenantConstraints,
                    where('createdAt', '>=', startTs),
                    where('createdAt', '<=', endTs)
                );
                const posSalesSnap = await getDocs(posSalesQuery);

                const categoryRiskMap: Record<string, { sales: number; expected: number; loss: number }> = {};
                posSalesSnap.forEach(doc => {
                    const data = doc.data();
                    const cat = (data.category || 'Other').trim();
                    if (!categoryRiskMap[cat]) categoryRiskMap[cat] = { sales: 0, expected: 0, loss: 0 };
                    categoryRiskMap[cat].sales += (data.amount || 0);
                    categoryRiskMap[cat].expected += (data.costs || 0);
                });

                // Attribute ADJUSTMENT (unexplained gap/loss) to 'Kitchen Loss'
                if (kpiData.unexplainedVariance > 0) {
                    if (!categoryRiskMap['Kitchen Loss']) categoryRiskMap['Kitchen Loss'] = { sales: 0, expected: 0, loss: 0 };
                    categoryRiskMap['Kitchen Loss'].loss += kpiData.unexplainedVariance;
                }

                // Replace service-level inventory-category grouping with POS-derived
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
                    kpiData.suspiciousItems = kpiData.suspiciousItems
                        .filter((item) => TRACKABLE_TYPES.has(item.type))
                        // Only show items with a real variance — hide perfectly balanced rows
                        .filter(item => item.varianceQty !== 0 || item.varianceValue !== 0);
                }
            }

            setKpis(kpiData);
            setShiftVariances(varianceData);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
            console.error("Dashboard data error:", message);
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
