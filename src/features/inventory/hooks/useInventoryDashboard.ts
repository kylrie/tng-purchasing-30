import { useState, useEffect } from 'react';
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

    const fetchDashboardData = async () => {
        if (!businessId) return;
        setLoading(true);
        try {
            const [kpiData, varianceData] = await Promise.all([
                InventoryDashboardService.getDashboardKPIs(businessId, timeFilter),
                getRollingStaffVariance(businessId, 7)
            ]);
            setKpis(kpiData);
            setShiftVariances(varianceData);
        } catch (error) {
            console.error('Error fetching dashboard static data:', error);
        } finally {
            // Small timeout to prevent flicker on fast loads
            setTimeout(() => setLoading(false), 300);
        }
    };

    // Fetch standard KPI and Variance data on mount/filter change
    useEffect(() => {
        fetchDashboardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessId, timeFilter]);

    // Subscribe to real-time investigations
    useEffect(() => {
        if (!businessId) return;

        // Subscribe sets up an onSnapshot listener
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
        refreshData: fetchDashboardData
    };
}
