/**
 * useBudgetMonitor Hook
 * 
 * Real-time listener for budget utilization monitoring.
 * Calculates percentage utilization and derives status for each budget.
 * 
 * @param businessUnitId - Filter budgets by Business Unit (optional, null for all)
 * @param fiscalYear - Filter by fiscal year (defaults to current year)
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../shared/types/firebase.types';

export type BudgetStatus = 'safe' | 'warning' | 'critical';

export interface BudgetWithStatus {
    id: string;
    businessUnitId: string;
    coaId: string;
    fiscalYear: number;
    month?: number;
    totalLimit: number;
    currentSpent: number;
    reserved: number; // Amount reserved (soft hold)
    currency: string;
    // Calculated fields
    percentage: number;
    remaining: number;
    status: BudgetStatus;
}

interface UseBudgetMonitorOptions {
    businessUnitId?: string | null;
    fiscalYear?: number;
}

interface UseBudgetMonitorResult {
    budgets: BudgetWithStatus[];
    loading: boolean;
    error: string | null;
    // Aggregated stats
    totalBudget: number;
    totalSpent: number;
    overallPercentage: number;
    criticalCount: number;
    warningCount: number;
}

/**
 * Derives the status based on utilization percentage
 */
function deriveStatus(percentage: number): BudgetStatus {
    if (percentage >= 100) return 'critical';
    if (percentage >= 80) return 'warning';
    return 'safe';
}

/**
 * Custom hook for real-time budget monitoring
 */
export function useBudgetMonitor(options: UseBudgetMonitorOptions = {}): UseBudgetMonitorResult {
    const {
        businessUnitId = null,
        fiscalYear = new Date().getFullYear()
    } = options;

    const [budgets, setBudgets] = useState<BudgetWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Build query based on filters
        let budgetQuery;

        if (businessUnitId) {
            // Filter by specific Business Unit and fiscal year
            budgetQuery = query(
                collection(db, COLLECTIONS.BUDGETS),
                where('businessUnitId', '==', businessUnitId),
                where('fiscalYear', '==', fiscalYear)
            );
        } else {
            // All budgets for the fiscal year
            budgetQuery = query(
                collection(db, COLLECTIONS.BUDGETS),
                where('fiscalYear', '==', fiscalYear),
                orderBy('businessUnitId')
            );
        }

        // Set up real-time listener
        const unsubscribe = onSnapshot(
            budgetQuery,
            (snapshot) => {
                const budgetData: BudgetWithStatus[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const totalLimit = data.totalLimit || 0;
                    const currentSpent = data.currentSpent || 0;
                    const reserved = data.reserved || 0;

                    // Calculate percentage including reserved (avoid division by zero)
                    const totalUtilized = currentSpent + reserved;
                    const percentage = totalLimit > 0
                        ? Math.round((totalUtilized / totalLimit) * 100)
                        : 0;

                    const remaining = totalLimit - currentSpent - reserved;
                    const status = deriveStatus(percentage);

                    return {
                        id: doc.id,
                        businessUnitId: data.businessUnitId,
                        coaId: data.coaId,
                        fiscalYear: data.fiscalYear,
                        month: data.month,
                        totalLimit,
                        currentSpent,
                        reserved,
                        currency: data.currency || 'PHP',
                        percentage,
                        remaining,
                        status,
                    };
                });

                // Sort by urgency: critical first, then warning, then safe
                // Within same status, sort by percentage descending
                budgetData.sort((a, b) => {
                    const statusOrder = { critical: 0, warning: 1, safe: 2 };
                    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
                    if (statusDiff !== 0) return statusDiff;
                    return b.percentage - a.percentage;
                });

                setBudgets(budgetData);
                setLoading(false);
            },
            (err) => {
                console.error('Budget monitor error:', err);
                setError('Failed to load budget data');
                setLoading(false);
            }
        );

        // Cleanup listener on unmount or when filters change
        return () => unsubscribe();
    }, [businessUnitId, fiscalYear]);

    // Calculate aggregated statistics
    const totalBudget = budgets.reduce((sum, b) => sum + b.totalLimit, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.currentSpent, 0);
    const overallPercentage = totalBudget > 0
        ? Math.round((totalSpent / totalBudget) * 100)
        : 0;
    const criticalCount = budgets.filter(b => b.status === 'critical').length;
    const warningCount = budgets.filter(b => b.status === 'warning').length;

    return {
        budgets,
        loading,
        error,
        totalBudget,
        totalSpent,
        overallPercentage,
        criticalCount,
        warningCount,
    };
}

export default useBudgetMonitor;
