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
    const canManageBudgets = hasPermission('master_data:budget:edit');

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
                ...doc.data(),
                id: doc.id,
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

            console.log('[BudgetConfigPanel] setBudgetLimit response:', result.data);
            setSuccess(result.data.message || `Budget ${result.data.action} successfully!`);

            // Reset form
            setSelectedBU('');
            setSelectedCOA('');
            setCoaSearchQuery('');
            setLimitAmount(0);

            // Refresh budgets list
            fetchData();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
                <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                <p>Loading budget data...</p>
            </div>
        );
    }

    return (
        <div className={`p-6 bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ${!canManageBudgets ? 'opacity-90' : ''}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white m-0">Budget Configuration</h2>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Filter by BU:</label>
                        <select
                            value={filterBU}
                            onChange={(e) => setFilterBU(e.target.value)}
                            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none min-w-[180px]"
                        >
                            <option value="">All Business Units</option>
                            {businesses.map(bu => (
                                <option key={bu.id} value={bu.id}>{bu.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-lg">
                        <button
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            onClick={() => setViewMode('monthly')}
                        >
                            Monthly
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'yearly' ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            onClick={() => setViewMode('yearly')}
                        >
                            Yearly Summary
                        </button>
                    </div>
                </div>
                {!canManageBudgets && (
                    <span className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-700/50 rounded-full">Read-Only</span>
                )}
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="flex items-center gap-3 p-4 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm">
                    <span className="text-lg">⚠️</span>
                    {error}
                    <button className="ml-auto text-xl opacity-70 hover:opacity-100" onClick={() => setError(null)}>×</button>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-3 p-4 mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-300 text-sm">
                    <span className="text-lg">✓</span>
                    {success}
                    <button className="ml-auto text-xl opacity-70 hover:opacity-100" onClick={() => setSuccess(null)}>×</button>
                </div>
            )}

            {/* Admin Form */}
            {canManageBudgets && (
                <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Set Monthly Budget Limit</h3>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="businessUnit" className="text-sm font-medium text-slate-600 dark:text-slate-400">Business Unit *</label>
                                <select
                                    id="businessUnit"
                                    value={selectedBU}
                                    onChange={(e) => setSelectedBU(e.target.value)}
                                    required
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                >
                                    <option value="">Select Business Unit...</option>
                                    {businesses.map(bu => (
                                        <option key={bu.id} value={bu.id}>{bu.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5 relative">
                                <label htmlFor="coa" className="text-sm font-medium text-slate-600 dark:text-slate-400">Chart of Account *</label>
                                <div className="relative">
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
                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    />
                                    {showCoaDropdown && filteredCoaList.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-50">
                                            {filteredCoaList.map(coa => (
                                                <div
                                                    key={coa.code}
                                                    className={`flex gap-3 px-3 py-2.5 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors ${selectedCOA === coa.code ? 'bg-purple-100 dark:bg-purple-900/40' : ''}`}
                                                    onClick={() => {
                                                        setSelectedCOA(coa.code);
                                                        setCoaSearchQuery(`${coa.code} - ${coa.name}`);
                                                        setShowCoaDropdown(false);
                                                    }}
                                                >
                                                    <span className="font-mono text-purple-600 dark:text-purple-400 text-sm min-w-[80px]">{coa.code}</span>
                                                    <span className="text-slate-700 dark:text-slate-200 text-sm flex-1 truncate">{coa.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="fiscalYear" className="text-sm font-medium text-slate-600 dark:text-slate-400">Fiscal Year *</label>
                                <select
                                    id="fiscalYear"
                                    value={fiscalYear}
                                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                                    required
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="month" className="text-sm font-medium text-slate-600 dark:text-slate-400">Month *</label>
                                <select
                                    id="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    required
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                >
                                    {MONTH_NAMES.map((name, idx) => (
                                        <option key={idx + 1} value={idx + 1}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="limitAmount" className="text-sm font-medium text-slate-600 dark:text-slate-400">Monthly Limit *</label>
                                <input
                                    type="number"
                                    id="limitAmount"
                                    value={limitAmount}
                                    onChange={(e) => setLimitAmount(Number(e.target.value))}
                                    min={0}
                                    step={100}
                                    required
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="currency" className="text-sm font-medium text-slate-600 dark:text-slate-400">Currency</label>
                                <select
                                    id="currency"
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                >
                                    <option value="PHP">PHP</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Budget'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Budgets Display */}
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">{viewMode === 'yearly' ? 'Yearly Fiscal Summary' : 'Monthly Budgets'}</h3>

                {viewMode === 'yearly' ? (
                    // Yearly Summary View
                    yearlySummaries.length === 0 ? (
                        <p className="text-center py-8 text-slate-500 dark:text-slate-400 italic">No budgets configured yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {yearlySummaries.map(summary => {
                                const utilization = getUtilization(summary.totalYearlySpent, summary.totalYearlyLimit);
                                const utilizationClass = utilization >= 90 ? 'from-red-500 to-red-600' : utilization >= 75 ? 'from-yellow-400 to-yellow-600' : 'from-green-500 to-green-600';
                                const isExpanded = expandedYears.has(summary.key);

                                return (
                                    <div key={summary.key} className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                                        <div
                                            className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                                            onClick={() => toggleYearExpansion(summary.key)}
                                        >
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="text-slate-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                                                <strong className="text-slate-800 dark:text-white">{getBusinessName(summary.businessUnitId)}</strong>
                                                <span className="text-slate-400">|</span>
                                                <span className="text-slate-600 dark:text-slate-300">{getCoaName(summary.coaId)}</span>
                                                <span className="px-2 py-0.5 text-xs font-semibold text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 rounded">{summary.fiscalYear}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                                <div className="flex flex-col md:flex-row gap-1 md:gap-4 md:items-center">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">Total: <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{formatCurrency(summary.totalYearlyLimit, 'PHP')}</span></span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">Spent: <span className="font-mono text-sm text-yellow-600 dark:text-yellow-400">{formatCurrency(summary.totalYearlySpent, 'PHP')}</span></span>
                                                </div>
                                                <div className="relative w-full md:w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded-md overflow-hidden">
                                                    <div className={`h-full rounded-md bg-gradient-to-r ${utilizationClass} transition-all duration-500`} style={{ width: `${Math.min(utilization, 100)}%` }}></div>
                                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">{utilization}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-slate-200 dark:border-slate-700/50 p-4 bg-white dark:bg-slate-900/20 overflow-x-auto">
                                                <table className="w-full text-sm text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase bg-slate-50 dark:bg-slate-800/50">
                                                            <th className="px-3 py-2">Month</th>
                                                            <th className="px-3 py-2">Limit</th>
                                                            <th className="px-3 py-2">Spent</th>
                                                            <th className="px-3 py-2">Wk 1</th>
                                                            <th className="px-3 py-2">Wk 2</th>
                                                            <th className="px-3 py-2">Wk 3</th>
                                                            <th className="px-3 py-2">Wk 4</th>
                                                            <th className="px-3 py-2">Wk 5</th>
                                                            <th className="px-3 py-2">Utilization</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {summary.monthlyBudgets.map(budget => {
                                                            const monthUtil = getUtilization(budget.currentSpent, budget.totalLimit);
                                                            const monthUtilClass = monthUtil >= 90 ? 'from-red-500 to-red-600' : monthUtil >= 75 ? 'from-yellow-400 to-yellow-600' : 'from-green-500 to-green-600';
                                                            const weekly = budget.weeklySpent || { week1: 0, week2: 0, week3: 0, week4: 0, week5: 0 };

                                                            return (
                                                                <tr key={budget.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                                                                    <td className="px-3 py-2">{MONTH_NAMES[budget.month - 1]}</td>
                                                                    <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">{formatCurrency(budget.totalLimit, budget.currency)}</td>
                                                                    <td className="px-3 py-2 font-mono text-yellow-600 dark:text-yellow-400">{formatCurrency(budget.currentSpent, budget.currency)}</td>
                                                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatCurrency(weekly.week1, budget.currency)}</td>
                                                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatCurrency(weekly.week2, budget.currency)}</td>
                                                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatCurrency(weekly.week3, budget.currency)}</td>
                                                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatCurrency(weekly.week4, budget.currency)}</td>
                                                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatCurrency(weekly.week5, budget.currency)}</td>
                                                                    <td className="px-3 py-2">
                                                                        <div className="relative w-20 h-5 bg-slate-200 dark:bg-slate-700 rounded-md overflow-hidden">
                                                                            <div className={`h-full rounded-md bg-gradient-to-r ${monthUtilClass}`} style={{ width: `${Math.min(monthUtil, 100)}%` }}></div>
                                                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm">{monthUtil}%</span>
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
                        <p className="text-center py-8 text-slate-500 dark:text-slate-400 italic">{filterBU ? 'No budgets for selected Business Unit.' : 'No budgets configured yet.'}</p>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-4 py-3 font-semibold">Business Unit</th>
                                        <th className="px-4 py-3 font-semibold">COA</th>
                                        <th className="px-4 py-3 font-semibold">Year</th>
                                        <th className="px-4 py-3 font-semibold">Month</th>
                                        <th className="px-4 py-3 font-semibold text-right">Limit</th>
                                        <th className="px-4 py-3 font-semibold text-right">Spent</th>
                                        <th className="px-4 py-3 font-semibold text-right">Remaining</th>
                                        <th className="px-4 py-3 font-semibold w-32">Utilization</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800/30">
                                    {filteredBudgets.map(budget => {
                                        const remaining = budget.totalLimit - budget.currentSpent;
                                        const utilization = getUtilization(budget.currentSpent, budget.totalLimit);
                                        const utilizationClass = utilization >= 90 ? 'from-red-500 to-red-600' : utilization >= 75 ? 'from-yellow-400 to-yellow-600' : 'from-green-500 to-green-600';

                                        return (
                                            <tr key={budget.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{getBusinessName(budget.businessUnitId)}</td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{getCoaName(budget.coaId)}</td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{budget.fiscalYear}</td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{MONTH_NAMES[(budget.month || 1) - 1]}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200">{formatCurrency(budget.totalLimit, budget.currency)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-yellow-600 dark:text-yellow-400">{formatCurrency(budget.currentSpent, budget.currency)}</td>
                                                <td className={`px-4 py-3 text-right font-mono font-medium ${remaining < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                                    {formatCurrency(remaining, budget.currency)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="relative w-full h-6 bg-slate-200 dark:bg-slate-700 rounded-md overflow-hidden">
                                                        <div className={`h-full rounded-md bg-gradient-to-r ${utilizationClass} transition-all duration-500`} style={{ width: `${Math.min(utilization, 100)}%` }}></div>
                                                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">{utilization}%</span>
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
