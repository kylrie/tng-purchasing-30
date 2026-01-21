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
 */

import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS, type ChartOfAccount } from '../../../shared/types/firebase.types';
import { useBudgetMonitor, type BudgetWithStatus } from '../../../hooks/useBudgetMonitor';
import { useAuth } from '../../../contexts/AuthContext';
import { BudgetProgressBar } from './BudgetProgressBar';
import './BudgetDashboardWidget.css';

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
            <div className={`budget-widget ${compact ? 'compact' : ''}`}>
                <div className="budget-widget-header">
                    <h3>{title}</h3>
                </div>
                <div className="budget-widget-loading">
                    <div className="loading-spinner" />
                    <span>Loading budgets...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`budget-widget ${compact ? 'compact' : ''} error`}>
                <div className="budget-widget-header">
                    <h3>{title}</h3>
                </div>
                <div className="budget-widget-error">
                    <span>⚠️ {error}</span>
                </div>
            </div>
        );
    }

    if (budgets.length === 0) {
        return (
            <div className={`budget-widget ${compact ? 'compact' : ''}`}>
                <div className="budget-widget-header">
                    <h3>{title}</h3>
                </div>
                <div className="budget-widget-empty">
                    <span>No budgets configured for this period.</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`budget-widget ${compact ? 'compact' : ''}`}>
            {/* Header with title and alerts */}
            <div className="budget-widget-header">
                <h3>{title}</h3>
                <div className="budget-widget-alerts">
                    {criticalCount > 0 && (
                        <span className="alert-badge critical">
                            {criticalCount} Critical
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="alert-badge warning">
                            {warningCount} Warning
                        </span>
                    )}
                </div>
            </div>

            {/* Summary stats */}
            <div className="budget-widget-summary">
                <div className="summary-stat">
                    <span className="stat-label">Total Budget</span>
                    <span className="stat-value">{formatCurrency(totalBudget)}</span>
                </div>
                <div className="summary-stat">
                    <span className="stat-label">Total Spent</span>
                    <span className="stat-value">{formatCurrency(totalSpent)}</span>
                </div>
                <div className="summary-stat">
                    <span className="stat-label">Overall</span>
                    <span className={`stat-value percentage ${overallPercentage >= 100 ? 'critical' :
                        overallPercentage >= 80 ? 'warning' : 'safe'
                        }`}>
                        {overallPercentage}%
                    </span>
                </div>
            </div>

            {/* Budget list */}
            <div className="budget-widget-list">
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
                    />
                ))}
            </div>

            {/* See more / See less toggle */}
            {hasMore && (
                <button
                    className="budget-widget-toggle"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded
                        ? `Show less ↑`
                        : `See ${budgets.length - maxVisible} more ↓`
                    }
                </button>
            )}
        </div>
    );
};

export default BudgetDashboardWidget;
