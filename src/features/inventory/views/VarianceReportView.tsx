import React, { useState, useEffect } from 'react';
import {
    BarChart3,
    AlertTriangle,
    TrendingDown,
    TrendingUp,
    Package,
    Building2,
    Calendar,
    RefreshCw,
    Download,
    Info
} from 'lucide-react';
import type { StockCountSession } from '../types/InventoryItem';
import { InventoryReportsService, type VarianceReport, type VarianceReportItem } from '../services/inventory.reports.service';
import type { Business } from '../../procurement/types';

// ============================================================
// PROPS
// ============================================================

interface VarianceReportViewProps {
    businesses: Business[];
}

// ============================================================
// COMPONENT
// ============================================================

const VarianceReportView: React.FC<VarianceReportViewProps> = ({ businesses }) => {
    // State
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(
        businesses.length > 0 ? businesses[0].id : ''
    );
    const [sessions, setSessions] = useState<StockCountSession[]>([]);
    const [startSessionId, setStartSessionId] = useState<string>('');
    const [endSessionId, setEndSessionId] = useState<string>('');
    const [report, setReport] = useState<VarianceReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load sessions when BU changes
    useEffect(() => {
        const loadSessions = async () => {
            if (!selectedBusinessUnit) return;

            setIsLoadingSessions(true);
            try {
                const fetchedSessions = await InventoryReportsService.getCompletedSessions(selectedBusinessUnit);
                setSessions(fetchedSessions);
                setStartSessionId('');
                setEndSessionId('');
                setReport(null);
            } catch (err) {
                console.error('Error loading sessions:', err);
                setError('Failed to load sessions');
            } finally {
                setIsLoadingSessions(false);
            }
        };

        loadSessions();
    }, [selectedBusinessUnit]);

    // Generate report
    const handleGenerateReport = async () => {
        if (!startSessionId || !endSessionId) {
            setError('Please select both start and end sessions');
            return;
        }

        if (startSessionId === endSessionId) {
            setError('Start and end sessions must be different');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const varianceReport = await InventoryReportsService.generateVarianceReport(
                startSessionId,
                endSessionId
            );
            setReport(varianceReport);
        } catch (err) {
            console.error('Error generating report:', err);
            setError('Failed to generate variance report');
        } finally {
            setIsLoading(false);
        }
    };

    // Format currency
    const formatCurrency = (val: number) =>
        `₱${Math.abs(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Format date
    const formatDate = (date: Date) =>
        date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Get row class based on variance
    const getVarianceRowClass = (item: VarianceReportItem) => {
        if (item.variance < -0.01) return 'bg-red-500/10 border-l-4 border-l-red-500';
        if (item.variance > 0.01) return 'bg-green-500/10 border-l-4 border-l-green-500';
        return '';
    };

    // Get variance text class
    const getVarianceTextClass = (variance: number) => {
        if (variance < -0.01) return 'text-red-500 dark:text-red-400 font-semibold';
        if (variance > 0.01) return 'text-green-600 dark:text-green-400 font-semibold';
        return 'text-slate-400 dark:text-slate-500';
    };

    // Export to CSV
    const handleExportCSV = () => {
        if (!report) return;

        const headers = ['Item Name', 'Unit', 'Starting', 'Purchased', 'Expected', 'Actual', 'Variance', 'Variance Cost'];
        const rows = report.items.map(item => [
            item.itemName,
            item.unit,
            item.starting.toFixed(2),
            item.purchased.toFixed(2),
            item.expected.toFixed(2),
            item.actual.toFixed(2),
            item.variance.toFixed(2),
            item.varianceCost.toFixed(2)
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `variance-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const currentBusiness = businesses.find(b => b.id === selectedBusinessUnit);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BarChart3 className="text-purple-600 dark:text-purple-400" />
                        Variance Report
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Compare stock counts to identify shrinkage and discrepancies
                    </p>
                </div>

                {/* Business Unit Selector */}
                <div className="flex items-center gap-3">
                    <Building2 size={20} className="text-slate-500 dark:text-slate-400" />
                    <select
                        value={selectedBusinessUnit}
                        onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                    >
                        {businesses.map(bu => (
                            <option key={bu.id} value={bu.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                {bu.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Session Selector Card */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-cyan-600 dark:text-cyan-400" />
                    Select Sessions to Compare
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Start Session */}
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Start Session (Earlier)</label>
                        <select
                            value={startSessionId}
                            onChange={(e) => setStartSessionId(e.target.value)}
                            disabled={isLoadingSessions || sessions.length === 0}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        >
                            <option value="">Select start session...</option>
                            {sessions.map(session => (
                                <option key={session.id} value={session.id} disabled={session.id === endSessionId}>
                                    {formatDate(session.startedAt?.toDate?.() || new Date())} - {session.location}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* End Session */}
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">End Session (Later)</label>
                        <select
                            value={endSessionId}
                            onChange={(e) => setEndSessionId(e.target.value)}
                            disabled={isLoadingSessions || sessions.length === 0}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        >
                            <option value="">Select end session...</option>
                            {sessions.map(session => (
                                <option key={session.id} value={session.id} disabled={session.id === startSessionId}>
                                    {formatDate(session.startedAt?.toDate?.() || new Date())} - {session.location}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Generate Button */}
                    <div className="flex items-end">
                        <button
                            onClick={handleGenerateReport}
                            disabled={isLoading || !startSessionId || !endSessionId}
                            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <BarChart3 size={18} />
                            )}
                            {isLoading ? 'Generating...' : 'Generate Report'}
                        </button>
                    </div>
                </div>

                {sessions.length === 0 && !isLoadingSessions && (
                    <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-amber-300">No completed stock counts found for {currentBusiness?.name}</p>
                            <p className="text-sm text-slate-400 mt-1">Complete at least 2 stock count sessions to compare.</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                        <AlertTriangle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-red-300">{error}</p>
                    </div>
                )}
            </div>

            {/* Formula Info */}
            <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-start gap-3">
                    <Info size={18} className="text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                            <strong>Formula:</strong> Expected Stock = Starting Stock + Purchases − Usage
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Variance = Actual Count − Expected Stock | <span className="text-red-500 dark:text-red-400">Negative = Missing</span> | <span className="text-green-600 dark:text-green-400">Positive = Surplus</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Report Results */}
            {report && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Total Items</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{report.summary.totalItems}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Items with Variance</p>
                            <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">{report.summary.itemsWithVariance}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2">
                                <TrendingDown size={16} className="text-red-500 dark:text-red-400" />
                                <p className="text-red-700 dark:text-red-300 text-sm">Missing Stock Value</p>
                            </div>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(report.summary.totalMissingCost)}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-green-500 dark:text-green-400" />
                                <p className="text-green-700 dark:text-green-300 text-sm">Surplus Value</p>
                            </div>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(report.summary.totalSurplusCost)}</p>
                        </div>
                    </div>

                    {/* Session Info */}
                    <div className="flex flex-wrap gap-4 text-sm">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 shadow-sm dark:shadow-none">
                            <span className="text-slate-500 dark:text-slate-400">Start: </span>
                            <span className="text-slate-900 dark:text-white">{formatDate(report.startSession.startedAt)}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 shadow-sm dark:shadow-none">
                            <span className="text-slate-500 dark:text-slate-400">End: </span>
                            <span className="text-slate-900 dark:text-white">{formatDate(report.endSession.startedAt)}</span>
                        </div>
                        <div className="flex-1" />
                        <button
                            onClick={handleExportCSV}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg flex items-center gap-2 text-sm transition-colors"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    </div>

                    {/* Variance Table */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                        <th className="text-left p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Item Name</th>
                                        <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Starting</th>
                                        <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Purchased</th>
                                        <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Expected</th>
                                        <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Actual</th>
                                        <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Variance</th>
                                        <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Variance Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.items.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-500">
                                                <Package size={48} className="mx-auto mb-4 opacity-50" />
                                                <p>No items in this report</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        report.items.map(item => (
                                            <tr
                                                key={item.itemId}
                                                className={`border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${getVarianceRowClass(item)}`}
                                            >
                                                <td className="p-4">
                                                    <p className="text-slate-900 dark:text-white font-medium">{item.itemName}</p>
                                                    <p className="text-xs text-slate-500">{item.unit}</p>
                                                </td>
                                                <td className="p-4 text-right text-slate-700 dark:text-slate-300">
                                                    {item.starting.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right text-cyan-600 dark:text-cyan-400">
                                                    +{item.purchased.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right text-slate-700 dark:text-slate-300">
                                                    {item.expected.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right text-slate-900 dark:text-white font-medium">
                                                    {item.actual.toFixed(2)}
                                                </td>
                                                <td className={`p-4 text-right ${getVarianceTextClass(item.variance)}`}>
                                                    {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                                                </td>
                                                <td className={`p-4 text-right ${getVarianceTextClass(item.varianceCost)}`}>
                                                    {item.varianceCost < 0 ? '-' : item.varianceCost > 0 ? '+' : ''}
                                                    {formatCurrency(item.varianceCost)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Net Variance */}
                    <div className={`p-6 rounded-xl border ${report.summary.totalVarianceCost < 0 ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {report.summary.totalVarianceCost < 0 ? (
                                    <TrendingDown size={24} className="text-red-500 dark:text-red-400" />
                                ) : (
                                    <TrendingUp size={24} className="text-green-500 dark:text-green-400" />
                                )}
                                <span className="text-lg font-semibold text-slate-900 dark:text-white">Net Variance</span>
                            </div>
                            <span className={`text-3xl font-bold ${report.summary.totalVarianceCost < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {report.summary.totalVarianceCost < 0 ? '-' : '+'}
                                {formatCurrency(report.summary.totalVarianceCost)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default VarianceReportView;
