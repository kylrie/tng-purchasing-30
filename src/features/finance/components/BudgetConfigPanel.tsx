/**
 * BudgetConfigPanel - Monthly Budget Configuration Component
 * 
 * Role-Based Access Control (RBAC):
 * - FINANCE_HEAD / SUPER_ADMIN: Full admin view with form to create/update budgets
 * - Other roles: Read-only table view of current budgets
 * 
 * Features:
 * - Monthly budget limits with week selection
 * - Weekly spending breakdown display
 * - Yearly fiscal summary (sum of monthly budgets)
 * 
 * Uses Cloud Functions for all write operations to ensure security.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { usePermissions } from '../../../hooks/usePermissions';
import { COLLECTIONS, type ChartOfAccount } from '../../../shared/types/firebase.types';
import type { Business } from '../../procurement/types';
import './BudgetConfigPanel.css';

// Types
interface WeeklySpent {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
    week5: number;
}

interface Budget {
    id: string;
    businessUnitId: string;
    coaId: string;
    fiscalYear: number;
    month: number;
    totalLimit: number;
    currentSpent: number;
    weeklySpent?: WeeklySpent;
    currency: string;
}

interface YearlySummary {
    key: string;
    businessUnitId: string;
    coaId: string;
    fiscalYear: number;
    totalYearlyLimit: number;
    totalYearlySpent: number;
    monthlyBudgets: Budget[];
}

interface SetBudgetLimitResponse {
    success: boolean;
    budgetId: string;
    action: 'created' | 'updated';
    message: string;
}

interface BudgetConfigPanelProps {
    businesses: Business[];
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export const BudgetConfigPanel: React.FC<BudgetConfigPanelProps> = ({ businesses }) => {
    const { hasPermission } = usePermissions();

    // State
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [coaList, setCoaList] = useState<ChartOfAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
    const [filterBU, setFilterBU] = useState<string>(''); // Filter by Business Unit

    // Form state
    const [selectedBU, setSelectedBU] = useState('');
    const [selectedCOA, setSelectedCOA] = useState('');
    const [coaSearchQuery, setCoaSearchQuery] = useState('');
    const [showCoaDropdown, setShowCoaDropdown] = useState(false);
    const [limitAmount, setLimitAmount] = useState<number>(0);
    const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [currency, setCurrency] = useState('PHP');

    // Filter COA list based on search query
    const filteredCoaList = coaList.filter(coa => {
        const query = coaSearchQuery.toLowerCase();
        return coa.code.toLowerCase().includes(query) ||
            coa.name.toLowerCase().includes(query);
    });

    // Check if user can manage budgets
    const canManageBudgets = hasPermission('budget:manage');

    // Filter budgets by selected BU
    const filteredBudgets = useMemo(() => {
        if (!filterBU) return budgets;
        return budgets.filter(b => b.businessUnitId === filterBU);
    }, [budgets, filterBU]);

    // Calculate yearly summaries from filtered monthly budgets
    const yearlySummaries = useMemo<YearlySummary[]>(() => {
        const summaryMap = new Map<string, YearlySummary>();

        filteredBudgets.forEach(budget => {
            const key = `${budget.businessUnitId}_${budget.coaId}_${budget.fiscalYear}`;

            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    key,
                    businessUnitId: budget.businessUnitId,
                    coaId: budget.coaId,
                    fiscalYear: budget.fiscalYear,
                    totalYearlyLimit: 0,
                    totalYearlySpent: 0,
                    monthlyBudgets: [],
                });
            }

            const summary = summaryMap.get(key)!;
            summary.totalYearlyLimit += budget.totalLimit;
            summary.totalYearlySpent += budget.currentSpent;
            summary.monthlyBudgets.push(budget);
        });

        // Sort monthly budgets within each summary
        summaryMap.forEach(summary => {
            summary.monthlyBudgets.sort((a, b) => a.month - b.month);
        });

        return Array.from(summaryMap.values()).sort((a, b) =>
            a.businessUnitId.localeCompare(b.businessUnitId) ||
            a.coaId.localeCompare(b.coaId) ||
            b.fiscalYear - a.fiscalYear
        );
    }, [filteredBudgets]);

    // Fetch all data on mount
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch budgets
            const budgetsSnapshot = await getDocs(collection(db, COLLECTIONS.BUDGETS));
            const budgetsData = budgetsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Budget[];
            // Sort by BU, COA, year, month
            budgetsData.sort((a, b) =>
                a.businessUnitId.localeCompare(b.businessUnitId) ||
                a.coaId.localeCompare(b.coaId) ||
                b.fiscalYear - a.fiscalYear ||
                a.month - b.month
            );
            setBudgets(budgetsData);

            // Fetch COA
            const coaSnapshot = await getDocs(collection(db, COLLECTIONS.CHART_OF_ACCOUNTS));
            const coaData = coaSnapshot.docs
                .map(doc => ({
                    code: doc.id,
                    ...doc.data()
                } as ChartOfAccount))
                .filter(coa => coa.isActive !== false)
                .sort((a, b) => a.code.localeCompare(b.code));
            setCoaList(coaData);

        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedBU || !selectedCOA || !limitAmount || !fiscalYear || !selectedMonth) {
            setError('Please fill in all required fields');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const functions = getFunctions();
            const setBudgetLimit = httpsCallable<unknown, SetBudgetLimitResponse>(
                functions,
                'setBudgetLimit'
            );

            const result = await setBudgetLimit({
                businessUnitId: selectedBU,
                coaId: selectedCOA,
                limitAmount: Number(limitAmount),
                fiscalYear: Number(fiscalYear),
                month: Number(selectedMonth),
                currency,
            });

            setSuccess(result.data.message || `Budget ${result.data.action} successfully!`);

            // Reset form
            setSelectedBU('');
            setSelectedCOA('');
            setCoaSearchQuery('');
            setLimitAmount(0);

            // Refresh budgets list
            fetchData();

        } catch (err: any) {
            console.error('Error saving budget:', err);

            if (err.code === 'functions/permission-denied') {
                setError('Access Denied: Only Finance Heads can set budget limits.');
            } else if (err.code === 'functions/failed-precondition') {
                setError(err.message || 'Cannot set limit below current spent amount.');
            } else {
                setError(err.message || 'Failed to save budget. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    }, [selectedBU, selectedCOA, limitAmount, fiscalYear, selectedMonth, currency]);

    // Format currency for display
    const formatCurrency = (amount: number, currencyCode: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    // Get business name by ID
    const getBusinessName = (id: string) => {
        return businesses.find(b => b.id === id)?.name || id;
    };

    // Get COA name by code
    const getCoaName = (code: string) => {
        return coaList.find(c => c.code === code)?.name || code;
    };

    // Calculate utilization percentage
    const getUtilization = (spent: number, limit: number) => {
        if (limit === 0) return 0;
        return Math.round((spent / limit) * 100);
    };

    // Toggle yearly summary expansion
    const toggleYearExpansion = (key: string) => {
        setExpandedYears(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    if (loading) {
        return (
            <div className="budget-panel loading">
                <div className="spinner"></div>
                <p>Loading budget data...</p>
            </div>
        );
    }

    return (
        <div className={`budget-panel ${canManageBudgets ? 'admin' : 'read-only'}`}>
            <div className="budget-panel-header">
                <h2>Budget Configuration</h2>
                <div className="header-controls">
                    <div className="filter-group">
                        <label>Filter by BU:</label>
                        <select
                            value={filterBU}
                            onChange={(e) => setFilterBU(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Business Units</option>
                            {businesses.map(bu => (
                                <option key={bu.id} value={bu.id}>{bu.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="view-toggle">
                        <button
                            className={viewMode === 'monthly' ? 'active' : ''}
                            onClick={() => setViewMode('monthly')}
                        >
                            Monthly
                        </button>
                        <button
                            className={viewMode === 'yearly' ? 'active' : ''}
                            onClick={() => setViewMode('yearly')}
                        >
                            Yearly Summary
                        </button>
                    </div>
                </div>
                {!canManageBudgets && (
                    <span className="read-only-badge">Read-Only</span>
                )}
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="alert alert-error">
                    <span className="alert-icon">⚠️</span>
                    {error}
                    <button className="alert-close" onClick={() => setError(null)}>×</button>
                </div>
            )}
            {success && (
                <div className="alert alert-success">
                    <span className="alert-icon">✓</span>
                    {success}
                    <button className="alert-close" onClick={() => setSuccess(null)}>×</button>
                </div>
            )}

            {/* Admin Form */}
            {canManageBudgets && (
                <div className="budget-form-section">
                    <h3>Set Monthly Budget Limit</h3>
                    <form onSubmit={handleSave} className="budget-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="businessUnit">Business Unit *</label>
                                <select
                                    id="businessUnit"
                                    value={selectedBU}
                                    onChange={(e) => setSelectedBU(e.target.value)}
                                    required
                                >
                                    <option value="">Select Business Unit...</option>
                                    {businesses.map(bu => (
                                        <option key={bu.id} value={bu.id}>{bu.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group coa-search-group">
                                <label htmlFor="coa">Chart of Account *</label>
                                <div className="coa-search-container">
                                    <input
                                        type="text"
                                        id="coa"
                                        value={coaSearchQuery}
                                        onChange={(e) => {
                                            setCoaSearchQuery(e.target.value);
                                            setShowCoaDropdown(true);
                                            if (selectedCOA) setSelectedCOA('');
                                        }}
                                        onFocus={() => setShowCoaDropdown(true)}
                                        placeholder="Type to search COA..."
                                        autoComplete="off"
                                    />
                                    {showCoaDropdown && filteredCoaList.length > 0 && (
                                        <div className="coa-dropdown">
                                            {filteredCoaList.map(coa => (
                                                <div
                                                    key={coa.code}
                                                    className={`coa-option ${selectedCOA === coa.code ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSelectedCOA(coa.code);
                                                        setCoaSearchQuery(`${coa.code} - ${coa.name}`);
                                                        setShowCoaDropdown(false);
                                                    }}
                                                >
                                                    <span className="coa-code">{coa.code}</span>
                                                    <span className="coa-name">{coa.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="fiscalYear">Fiscal Year *</label>
                                <select
                                    id="fiscalYear"
                                    value={fiscalYear}
                                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                                    required
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="month">Month *</label>
                                <select
                                    id="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    required
                                >
                                    {MONTH_NAMES.map((name, idx) => (
                                        <option key={idx + 1} value={idx + 1}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="limitAmount">Monthly Limit *</label>
                                <input
                                    type="number"
                                    id="limitAmount"
                                    value={limitAmount}
                                    onChange={(e) => setLimitAmount(Number(e.target.value))}
                                    min={0}
                                    step={100}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="currency">Currency</label>
                                <select
                                    id="currency"
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                >
                                    <option value="PHP">PHP</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Budget'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Budgets Display */}
            <div className="budgets-table-section">
                <h3>{viewMode === 'yearly' ? 'Yearly Fiscal Summary' : 'Monthly Budgets'}</h3>

                {viewMode === 'yearly' ? (
                    // Yearly Summary View
                    yearlySummaries.length === 0 ? (
                        <p className="no-data">No budgets configured yet.</p>
                    ) : (
                        <div className="yearly-summaries">
                            {yearlySummaries.map(summary => {
                                const utilization = getUtilization(summary.totalYearlySpent, summary.totalYearlyLimit);
                                const utilizationClass = utilization >= 90 ? 'critical' : utilization >= 75 ? 'warning' : 'normal';
                                const isExpanded = expandedYears.has(summary.key);

                                return (
                                    <div key={summary.key} className="yearly-card">
                                        <div className="yearly-header" onClick={() => toggleYearExpansion(summary.key)}>
                                            <div className="yearly-info">
                                                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                                <strong>{getBusinessName(summary.businessUnitId)}</strong>
                                                <span className="separator">|</span>
                                                <span>{getCoaName(summary.coaId)}</span>
                                                <span className="year-badge">{summary.fiscalYear}</span>
                                            </div>
                                            <div className="yearly-amounts">
                                                <span className="amount-label">Yearly Total:</span>
                                                <span className="amount">{formatCurrency(summary.totalYearlyLimit, 'PHP')}</span>
                                                <span className="amount-label">Spent:</span>
                                                <span className="amount spent">{formatCurrency(summary.totalYearlySpent, 'PHP')}</span>
                                                <div className={`utilization-bar ${utilizationClass}`}>
                                                    <div className="utilization-fill" style={{ width: `${Math.min(utilization, 100)}%` }}></div>
                                                    <span className="utilization-text">{utilization}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="monthly-breakdown">
                                                <table className="budgets-table compact">
                                                    <thead>
                                                        <tr>
                                                            <th>Month</th>
                                                            <th>Limit</th>
                                                            <th>Spent</th>
                                                            <th>Week 1</th>
                                                            <th>Week 2</th>
                                                            <th>Week 3</th>
                                                            <th>Week 4</th>
                                                            <th>Week 5</th>
                                                            <th>Utilization</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {summary.monthlyBudgets.map(budget => {
                                                            const monthUtil = getUtilization(budget.currentSpent, budget.totalLimit);
                                                            const monthUtilClass = monthUtil >= 90 ? 'critical' : monthUtil >= 75 ? 'warning' : 'normal';
                                                            const weekly = budget.weeklySpent || { week1: 0, week2: 0, week3: 0, week4: 0, week5: 0 };

                                                            return (
                                                                <tr key={budget.id}>
                                                                    <td>{MONTH_NAMES[budget.month - 1]}</td>
                                                                    <td className="amount">{formatCurrency(budget.totalLimit, budget.currency)}</td>
                                                                    <td className="amount">{formatCurrency(budget.currentSpent, budget.currency)}</td>
                                                                    <td className="amount weekly">{formatCurrency(weekly.week1, budget.currency)}</td>
                                                                    <td className="amount weekly">{formatCurrency(weekly.week2, budget.currency)}</td>
                                                                    <td className="amount weekly">{formatCurrency(weekly.week3, budget.currency)}</td>
                                                                    <td className="amount weekly">{formatCurrency(weekly.week4, budget.currency)}</td>
                                                                    <td className="amount weekly">{formatCurrency(weekly.week5, budget.currency)}</td>
                                                                    <td>
                                                                        <div className={`utilization-bar small ${monthUtilClass}`}>
                                                                            <div className="utilization-fill" style={{ width: `${Math.min(monthUtil, 100)}%` }}></div>
                                                                            <span className="utilization-text">{monthUtil}%</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    // Monthly View
                    filteredBudgets.length === 0 ? (
                        <p className="no-data">{filterBU ? 'No budgets for selected Business Unit.' : 'No budgets configured yet.'}</p>
                    ) : (
                        <div className="table-container">
                            <table className="budgets-table">
                                <thead>
                                    <tr>
                                        <th>Business Unit</th>
                                        <th>COA</th>
                                        <th>Year</th>
                                        <th>Month</th>
                                        <th>Limit</th>
                                        <th>Spent</th>
                                        <th>Remaining</th>
                                        <th>Utilization</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBudgets.map(budget => {
                                        const remaining = budget.totalLimit - budget.currentSpent;
                                        const utilization = getUtilization(budget.currentSpent, budget.totalLimit);
                                        const utilizationClass = utilization >= 90 ? 'critical' : utilization >= 75 ? 'warning' : 'normal';

                                        return (
                                            <tr key={budget.id}>
                                                <td>{getBusinessName(budget.businessUnitId)}</td>
                                                <td>{getCoaName(budget.coaId)}</td>
                                                <td>{budget.fiscalYear}</td>
                                                <td>{MONTH_NAMES[(budget.month || 1) - 1]}</td>
                                                <td className="amount">{formatCurrency(budget.totalLimit, budget.currency)}</td>
                                                <td className="amount">{formatCurrency(budget.currentSpent, budget.currency)}</td>
                                                <td className={`amount ${remaining < 0 ? 'negative' : ''}`}>
                                                    {formatCurrency(remaining, budget.currency)}
                                                </td>
                                                <td>
                                                    <div className={`utilization-bar ${utilizationClass}`}>
                                                        <div className="utilization-fill" style={{ width: `${Math.min(utilization, 100)}%` }}></div>
                                                        <span className="utilization-text">{utilization}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default BudgetConfigPanel;
