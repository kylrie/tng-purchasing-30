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

function getDateRangeFromPeriod(period: DashboardPeriod, customRange?: { start: Date; end: Date }): [Date, Date] {
    if (period === 'custom' && customRange) {
        return [customRange.start, customRange.end];
    }
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

export function useInventoryDashboard(
    userOrBuId: User | string | undefined,
    timeFilter: DashboardPeriod,
    customRange?: { start: Date; end: Date }
) {
    const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
    const [shiftVariances, setShiftVariances] = useState<StaffVarianceRecord[]>([]);
    const [investigations, setInvestigations] = useState<InvestigationCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const customRangeKey = customRange ? `${customRange.start.getTime()}-${customRange.end.getTime()}` : '';

    const fetchDashboardData = useCallback(async () => {
        if (!userOrBuId) return;
        setLoading(true);
        setError(null);
        try {
            // ── Single source of truth: let the service compute all KPIs ──
            const [kpiData, varianceData] = await Promise.all([
                InventoryDashboardService.getDashboardKPIs(userOrBuId, timeFilter, customRange),
                getRollingStaffVariance(userOrBuId, 7)
            ]);

            if (kpiData) {
                // We rely on the backend service's kpiData.categoryRisks (derived from inventory_aggregates)
                // to supply accurate Expected Usage, Actual Usage, and Loss Value.
                // We do NOT overwrite it with pos_sales since pos_sales does not have costs.

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
    }, [userOrBuId, timeFilter, customRangeKey]);

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
