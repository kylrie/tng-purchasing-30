import { useState, useEffect, useCallback } from 'react';
import { InventoryDashboardService } from '../services/inventory-dashboard.service';
import type { DashboardKPIs, DashboardPeriod } from '../services/inventory-dashboard.service';
import { getRollingStaffVariance } from '../services/staff-variance.service';
import type { StaffVarianceRecord } from '../services/staff-variance.service';
import { InvestigationsService } from '../services/investigations.service';
import type { InvestigationCase } from '../services/investigations.service';

export function useInventoryDashboard(businessId: string | undefined, timeFilter: DashboardPeriod) {
    const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
    const [shiftVariances, setShiftVariances] = useState<StaffVarianceRecord[]>([]);
    const [investigations, setInvestigations] = useState<InvestigationCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        if (!businessId) return;
        setLoading(true);
        setError(null);
        try {
            const [kpiData, varianceData] = await Promise.all([
                InventoryDashboardService.getDashboardKPIs(businessId, timeFilter),
                getRollingStaffVariance(businessId, 7)
            ]);
            setKpis(kpiData);
            setShiftVariances(varianceData);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
            console.error('Error fetching dashboard data:', err);
            setError(message);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    }, [businessId, timeFilter]);

    // Fetch KPI and Variance data on mount/filter change
    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Subscribe to real-time investigations
    useEffect(() => {
        if (!businessId) return;

        const unsubscribe = InvestigationsService.subscribeToInvestigations(
            businessId,
            (cases) => {
                setInvestigations(cases);
            }
        );

        return () => unsubscribe();
    }, [businessId]);

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
