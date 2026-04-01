import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { InventoryDashboardService } from '../services/inventory-dashboard.service';
import type { DashboardKPIs, DashboardPeriod } from '../services/inventory-dashboard.service';
import { getRollingStaffVariance } from '../services/staff-variance.service';
import type { StaffVarianceRecord } from '../services/staff-variance.service';
import { InvestigationsService } from '../services/investigations.service';
import type { InvestigationCase } from '../services/investigations.service';

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

export function useInventoryDashboard(businessId: string | undefined, timeFilter: DashboardPeriod) {
    const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
    const [shiftVariances, setShiftVariances] = useState<StaffVarianceRecord[]>([]);
    const [investigations, setInvestigations] = useState<InvestigationCase[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        if (!businessId) return;
        setLoading(true);

        const dateRange = getDateRangeFromPeriod(timeFilter);
        
        // Log 1: Hook Inputs
        console.log("1. Hook Inputs:", { businessUnitId: businessId, dateRange });

        try {
            const startTs = Timestamp.fromDate(dateRange[0]);
            const endTs = Timestamp.fromDate(dateRange[1]);
            
            // Log 2: Date Formats
            console.log("2. Date Formats (Firestore Timestamps):", { startTs, endTs });

            // Diagnostic Query 1: THEORETICAL_USAGE
            // NOTE: stock_transactions are written with field `timestamp` (not `createdAt`)
            const usageQuery = query(
                collection(db, 'stock_transactions'),
                where('businessUnitId', '==', businessId),
                where('type', '==', 'THEORETICAL_USAGE'),
                where('timestamp', '>=', startTs),
                where('timestamp', '<=', endTs)
            );
            
            // Diagnostic Query 2: ADJUSTMENT
            // NOTE: Same field — use `timestamp` not `createdAt`
            const adjustmentQuery = query(
                collection(db, 'stock_transactions'),
                where('businessUnitId', '==', businessId),
                where('type', '==', 'ADJUSTMENT'),
                where('timestamp', '>=', startTs),
                where('timestamp', '<=', endTs)
            );

            // Fetch and wrap in try/catch to log specific index errors
            let usageSnap, adjSnap;
            try {
                [usageSnap, adjSnap] = await Promise.all([
                    getDocs(usageQuery),
                    getDocs(adjustmentQuery)
                ]);
            } catch (err: any) {
                console.error("FIREBASE QUERY ERROR (Index missing?):", err.message);
                throw err; // Re-throw to hit the outer catch block
            }

            // Log 3: Raw Query Results 
            // Note: If you get zero docs here, verify the string typed in stock_transactions EXACTLY matches
            // 'THEORETICAL_USAGE' and 'ADJUSTMENT' or if there is no data for this specific businessId
            console.log("3. Raw Transactions Found:", {
                theoreticalUsageCount: usageSnap.docs.length,
                adjustmentCount: adjSnap.docs.length
            });

            let expectedUsage = 0;
            usageSnap.forEach(doc => {
                const data = doc.data();
                // Use pre-computed totalValue (unitCost * quantity) written at import time.
                // Fall back to qty * unitCost for older transactions that may not have totalValue.
                const value = data.totalValue ?? (Math.abs(data.quantity || 0) * (data.unitCost || 0));
                expectedUsage += value;
            });

            let unexplainedGap = 0;
            adjSnap.forEach(doc => {
                const data = doc.data();
                const value = data.totalValue ?? (Math.abs(data.quantity || 0) * (data.unitCost || 0));
                unexplainedGap += value;
            });

            // Log 4: Math Check
            console.log("4. Calculated KPIs:", { expectedUsage, unexplainedGap });

            // Since this is diagnostic mode, we still load the rest of the KPIs from the service 
            // but we override the theoreticalUsage and unexplainedVariance with our direct transaction query results!
            const [kpiData, varianceData] = await Promise.all([
                InventoryDashboardService.getDashboardKPIs(businessId, timeFilter),
                getRollingStaffVariance(businessId, 7)
            ]);

            if (kpiData) {
                kpiData.theoreticalUsage = expectedUsage;
                kpiData.unexplainedVariance = unexplainedGap;
                
                // Recalculate variance percentage based on new values
                if (expectedUsage > 0) {
                    kpiData.variancePercent = (unexplainedGap / expectedUsage) * 100;
                    const absVP = Math.abs(kpiData.variancePercent);
                    kpiData.varianceStatus = absVP <= 2 ? 'green' : absVP <= 5 ? 'yellow' : 'red';
                }
            }

            setKpis(kpiData);
            setShiftVariances(varianceData);

        } catch (error: any) {
            console.error("FIREBASE QUERY ERROR:", error.message);
        } finally {
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
