/**
 * BudgetDashboardWidget Component
 * 
 * Dashboard widget displaying budget utilization across all accounts
 * for a specific Business Unit or organization-wide.
 * 
 * Features:
 * - Real-time updates via useBudgetMonitor hook
 * - Urgency-sorted list (critical first)
 * - Summary statistics
 * - Collapsible for compact view
 * - Self-contained COA name lookup
 * - Click-to-drill-down PRF list
 */

import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS, type ChartOfAccount } from '../../../shared/types/firebase.types';
import { useBudgetMonitor, type BudgetWithStatus } from '../../../hooks/useBudgetMonitor';
import { useAuth } from '../../../contexts/useAuth';
import { BudgetProgressBar } from './BudgetProgressBar';
import { BudgetPrfDrawer } from './BudgetPrfDrawer';

interface BudgetDashboardWidgetProps {
    /** Filter by specific Business Unit ID (null for all) */
    businessUnitId?: string | null;
    /** Fiscal year to display (defaults to current year) */
    fiscalYear?: number;
    /** Maximum number of items to show before "See More" */
    maxVisible?: number;
    /** Widget title */
    title?: string;
    /** Compact mode for smaller widget */
    compact?: boolean;
    /** External COA lookup function (optional - falls back to internal) */
    getCoaName?: (coaId: string) => string;
    /** BU lookup function to get names */
    getBusinessUnitName?: (buId: string) => string;
}

// Selected budget state for drill-down
interface SelectedBudget {
    coaId: string;
    coaName: string;
    businessUnitId?: string;
    fiscalYear?: number;
    month?: number;
}

export const BudgetDashboardWidget: React.FC<BudgetDashboardWidgetProps> = ({
    businessUnitId = null,
    fiscalYear,
    maxVisible = 5,
    title = 'Budget Utilization',
    compact = false,
    getCoaName: externalGetCoaName,
    getBusinessUnitName,
}) => {
    const { currentUser } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [coaMap, setCoaMap] = useState<Map<string, string>>(new Map());
    const [selectedBudget, setSelectedBudget] = useState<SelectedBudget | null>(null);

    // Fetch COA data for name lookup
    useEffect(() => {
        const fetchCoaData = async () => {
            try {
                const coaSnapshot = await getDocs(collection(db, COLLECTIONS.CHART_OF_ACCOUNTS));
                const map = new Map<string, string>();
                coaSnapshot.docs.forEach(doc => {
                    const data = doc.data() as ChartOfAccount;
                    map.set(doc.id, data.name || doc.id);
                });
                setCoaMap(map);
            } catch (err) {
                console.error('Error fetching COA data for widget:', err);
            }
        };
        fetchCoaData();
    }, []);

    // Internal COA name lookup
    const internalGetCoaName = (coaId: string): string => {
        return coaMap.get(coaId) || coaId;
    };

    // Use external function if provided, otherwise use internal
    const getCoaName = externalGetCoaName || internalGetCoaName;

    // Use user's business unit if not specified
    const effectiveBuId = businessUnitId ?? currentUser?.businessId ?? null;

    const {
        budgets,
        loading,
        error,
        totalBudget,
        totalSpent,
        overallPercentage,
        criticalCount,
        warningCount,
    } = useBudgetMonitor({
        businessUnitId: effectiveBuId,
        fiscalYear
    });

    // Determine which budgets to show
    const visibleBudgets = expanded ? budgets : budgets.slice(0, maxVisible);
    const hasMore = budgets.length > maxVisible;

    // Helper to get display label
    const getBudgetLabel = (budget: BudgetWithStatus) => {
        const coaName = getCoaName(budget.coaId);
        if (!businessUnitId && getBusinessUnitName) {
            // Show BU name if viewing all
            const buName = getBusinessUnitName(budget.businessUnitId);
            return `${buName} - ${coaName}`;
        }
        return coaName;
    };

    // Format currency for summary
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className={`bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors ${compact ? 'p-4' : 'p-6'}`}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className={`font-bold text-slate-800 dark:text-white ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
                </div>
                <div className="flex flex-col items-center justify-center p-8 gap-3 text-slate-400 dark:text-slate-500">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-purple-500 animate-spin" />
                    <span>Loading budgets...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors ${compact ? 'p-4' : 'p-6'}`}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className={`font-bold text-slate-800 dark:text-white ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
                </div>
                <div className="p-6 text-center text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg">
                    <span>⚠️ {error}</span>
                </div>
            </div>
        );
    }

    if (budgets.length === 0) {
        return (
            <div className={`bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors ${compact ? 'p-4' : 'p-6'}`}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className={`font-bold text-slate-800 dark:text-white ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
                </div>
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 italic">
                    <span>No budgets configured for this period.</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors ${compact ? 'p-4' : 'p-6'}`}>
            {/* Header with title and alerts */}
            <div className="flex justify-between items-center mb-5">
                <h3 className={`font-bold text-slate-800 dark:text-white ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
                <div className="flex gap-2">
                    {criticalCount > 0 && (
                        <span className="px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 animate-pulse">
                            {criticalCount} Critical
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40">
                            {warningCount} Warning
                        </span>
                    )}
                </div>
            </div>

            {/* Summary stats */}
            <div className={`flex flex-wrap gap-4 p-4 mb-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/30 ${compact ? 'p-3 gap-3' : ''}`}>
                <div className="flex-1 min-w-[30%] text-center flex flex-col">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Budget</span>
                    <span className={`font-bold text-slate-900 dark:text-slate-100 ${compact ? 'text-[15px]' : 'text-base'}`}>{formatCurrency(totalBudget)}</span>
                </div>
                <div className="flex-1 min-w-[30%] text-center flex flex-col">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Spent</span>
                    <span className={`font-bold text-slate-900 dark:text-slate-100 ${compact ? 'text-[15px]' : 'text-base'}`}>{formatCurrency(totalSpent)}</span>
                </div>
                <div className="flex-1 min-w-[30%] text-center flex flex-col">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Overall</span>
                    <span className={`font-bold font-mono ${compact ? 'text-[15px]' : 'text-base'} ${overallPercentage >= 100 ? 'text-rose-600 dark:text-rose-400' :
                        overallPercentage >= 80 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                        {overallPercentage}%
                    </span>
                </div>
            </div>

            {/* Budget list */}
            <div className={`flex flex-col gap-2 overflow-y-auto ${compact ? 'max-h-[280px]' : 'max-h-[400px]'}`}>
                {visibleBudgets.map(budget => (
                    <BudgetProgressBar
                        key={budget.id}
                        label={getBudgetLabel(budget)}
                        spent={budget.currentSpent}
                        reserved={budget.reserved}
                        limit={budget.totalLimit}
                        currency={budget.currency}
                        status={budget.status}
                        compact={compact}
                        onClick={() => setSelectedBudget({
                            coaId: budget.coaId,
                            coaName: getBudgetLabel(budget),
                            businessUnitId: budget.businessUnitId,
                            fiscalYear: budget.fiscalYear,
                            month: budget.month,
                        })}
                    />
                ))}
            </div>

            {/* See more / See less toggle */}
            {hasMore && (
                <button
                    className="block w-full mt-4 p-2.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:text-purple-700 dark:hover:text-purple-300 transition-all"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded
                        ? `Show less ↑`
                        : `See ${budgets.length - maxVisible} more ↓`
                    }
                </button>
            )}

            {/* PRF Drill-Down Drawer */}
            <BudgetPrfDrawer
                isOpen={selectedBudget !== null}
                onClose={() => setSelectedBudget(null)}
                coaId={selectedBudget?.coaId || ''}
                coaName={selectedBudget?.coaName}
                businessUnitId={selectedBudget?.businessUnitId}
                fiscalYear={selectedBudget?.fiscalYear}
                month={selectedBudget?.month}
            />
        </div>
    );
};

export default BudgetDashboardWidget;
