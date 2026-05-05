import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ClipboardCheck,
    Save,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    TrendingDown,
    TrendingUp,
    Minus,
    FileSpreadsheet,
    RefreshCw,
    Filter,
    Download,
    FileText,
    History,
    Eye,
    X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ReconService, type ReconRow, type ReconHistoryRecord } from '../services/recon.service';
import type { Business } from '../../procurement/types';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';

// ============================================================
// PROPS
// ============================================================

interface VarianceReconReportProps {
    businesses: Business[];
    currentUser: { id: string; name: string };
}

// ============================================================
// EXPORT HELPERS
// ============================================================

function buildExportData(rows: ReconRow[], periodLabel: string) {
    return rows.map((r, i) => ({
        '#': i + 1,
        'Category': r.category,
        'Item Name': r.itemName,
        'UOM': r.uom,
        'Beginning Inv': r.beginningInventory,
        'Purchases (IN)': r.purchasesIn,
        'Stock On Hand': r.stockOnHand,
        'POS Sales': r.posSales,
        'Event Sales': r.eventSales,
        'Ending (System)': r.endingSystem,
        'Ending (Actual)': r.endingActual ?? '',
        'Variance': r.variance ?? '',
        'Variance Cost': r.variance !== null ? (r.variance * r.costPerUnit) : '',
        'Period': periodLabel,
    }));
}

function exportToCSV(rows: ReconRow[], periodLabel: string) {
    const data = buildExportData(rows, periodLabel);
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Recon_${periodLabel.replace(/→/g, '_to_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportToXLSX(rows: ReconRow[], periodLabel: string) {
    const data = buildExportData(rows, periodLabel);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recon');
    XLSX.writeFile(wb, `Recon_${periodLabel.replace(/→/g, '_to_')}.xlsx`);
}

function exportToPDF(periodLabel: string) {
    // Use browser print with styled print CSS
    const printArea = document.getElementById('recon-print-area');
    if (!printArea) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
        <html><head><title>Inventory Recon - ${periodLabel}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p { font-size: 12px; color: #64748b; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 11px; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
            th:nth-child(1), th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: right; }
            td:nth-child(1), td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: left; }
            .neg { color: #dc2626; font-weight: 700; }
            .pos { color: #16a34a; font-weight: 700; }
            .zero { color: #94a3b8; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style></head><body>
        <h1>Inventory Reconciliation Report</h1>
        <p>Period: ${periodLabel}</p>
        ${printArea.innerHTML}
        </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const VarianceReconReport: React.FC<VarianceReconReportProps> = ({ businesses, currentUser }) => {
    // Global BU context — fall back to first business when 'all' is selected
    const { selectedBusinessUnit } = useBusinessUnit();
    const selectedBU = selectedBusinessUnit === 'all'
        ? (businesses.length > 0 ? businesses[0].id : '')
        : selectedBusinessUnit;

    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    const [rows, setRows] = useState<ReconRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveResult, setSaveResult] = useState<{ updatedItems: number; adjustmentsCreated: number; historyId: string } | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

    // History
    const [history, setHistory] = useState<ReconHistoryRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [viewingRecord, setViewingRecord] = useState<ReconHistoryRecord | null>(null);

    const periodLabel = `${dateRange.start}→${dateRange.end}`;

    // ================================================================
    // LOAD DATA
    // ================================================================
    const loadData = useCallback(async () => {
        if (!selectedBU) return;
        setIsLoading(true);
        setError(null);
        setSaveResult(null);
        setViewingRecord(null);

        try {
            const start = new Date(dateRange.start);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);

            const data = await ReconService.getReconData(selectedBU, start, end);
            setRows(data);
        } catch (err) {
            console.error('Error loading recon data:', err);
            setError('Failed to load reconciliation data');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBU, dateRange]);

    useEffect(() => { loadData(); }, [loadData]);

    // ================================================================
    // LOAD HISTORY
    // ================================================================
    const loadHistory = useCallback(async () => {
        if (!selectedBU) return;
        setHistoryLoading(true);
        try {
            const records = await ReconService.getHistory(selectedBU);
            setHistory(records);
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setHistoryLoading(false);
        }
    }, [selectedBU]);

    useEffect(() => {
        if (showHistory) loadHistory();
    }, [showHistory, loadHistory]);

    // ================================================================
    // HANDLE ACTUAL COUNT INPUT
    // ================================================================
    const handleActualCountChange = (index: number, value: string) => {
        setRows(prev => prev.map((row, i) => {
            if (i !== index) return row;
            const actualCount = value === '' ? null : parseFloat(value);
            const variance = actualCount !== null ? actualCount - row.endingSystem : null;
            return { ...row, endingActual: actualCount, variance };
        }));
        setSaveResult(null);
    };

    // ================================================================
    // SAVE
    // ================================================================
    const handleSave = async () => {
        const rowsWithCounts = rows.filter(r => r.endingActual !== null);
        if (rowsWithCounts.length === 0) {
            setError('Enter at least one actual count before saving.');
            return;
        }

        setIsSaving(true);
        setError(null);
        setSaveResult(null);
        try {
            const result = await ReconService.savePhysicalCounts(
                rows,
                selectedBU,
                currentUser.id,
                currentUser.name,
                periodLabel
            );
            setSaveResult(result);
            // Refresh history if panel is open
            if (showHistory) loadHistory();
        } catch (err: unknown) {
            console.error('Error saving counts:', err);
            setError(err instanceof Error ? err.message : 'Failed to save physical counts');
        } finally {
            setIsSaving(false);
        }
    };

    // ================================================================
    // VIEW HISTORY RECORD
    // ================================================================
    const handleViewRecord = (record: ReconHistoryRecord) => {
        setViewingRecord(record);
        setShowHistory(false);
    };

    // ================================================================
    // HELPERS
    // ================================================================
    const formatQty = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(2);
    const formatCurrency = (n: number) => `₱${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const currentBusiness = businesses.find(b => b.id === selectedBU);

    // The active display rows — either live data or a history snapshot
    const displayRows = viewingRecord ? viewingRecord.rows : rows;
    const categories = useMemo(() => Array.from(new Set(displayRows.map(r => r.category))).sort(), [displayRows]);
    const filteredRows = categoryFilter === 'ALL' ? displayRows : displayRows.filter(r => r.category === categoryFilter);
    const countedRows = filteredRows.filter(r => r.endingActual !== null);
    const varianceRows = filteredRows.filter(r => r.variance !== null && Math.abs(r.variance) > 0.001);

    // ================================================================
    // RENDER
    // ================================================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <FileSpreadsheet className="text-indigo-600 dark:text-indigo-400" />
                        Inventory Reconciliation
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {currentBusiness?.name || 'Select a business unit'} — Compare system vs physical stock
                        {viewingRecord && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">(Viewing saved record)</span>
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Date Range */}
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                        <span className="text-slate-400 text-sm">to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                            <option value="ALL">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={loadData}
                        disabled={isLoading}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Viewing History Banner */}
            {viewingRecord && (
                <div className="flex items-center justify-between px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
                    <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400 text-sm">
                        <History size={16} />
                        <span>
                            <strong>Saved Record</strong> by {viewingRecord.savedByName} on {viewingRecord.savedAt.toLocaleDateString()} {viewingRecord.savedAt.toLocaleTimeString()} — {viewingRecord.totalItems} items, {viewingRecord.itemsWithVariance} with variance
                        </span>
                    </div>
                    <button
                        onClick={() => setViewingRecord(null)}
                        className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-lg text-xs font-bold hover:bg-amber-300 dark:hover:bg-amber-700"
                    >
                        <X size={14} className="inline mr-1" />Back to Live
                    </button>
                </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/10 dark:border-slate-700/60 shadow-sm">
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">{filteredRows.length}</strong> items{categoryFilter !== 'ALL' ? ` (${categoryFilter})` : ''}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-500 dark:text-slate-400">
                        <strong className="text-indigo-600 dark:text-indigo-400">{countedRows.length}</strong> counted
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-500 dark:text-slate-400">
                        <strong className={varianceRows.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {varianceRows.length}
                        </strong> with variance
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Export Buttons */}
                    <div className="flex items-center gap-1 mr-2">
                        <button
                            onClick={() => exportToCSV(filteredRows, viewingRecord ? `${viewingRecord.periodStart}_to_${viewingRecord.periodEnd}` : periodLabel)}
                            disabled={filteredRows.length === 0}
                            className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                            title="Export CSV"
                        >
                            <Download size={13} /> CSV
                        </button>
                        <button
                            onClick={() => exportToXLSX(filteredRows, viewingRecord ? `${viewingRecord.periodStart}_to_${viewingRecord.periodEnd}` : periodLabel)}
                            disabled={filteredRows.length === 0}
                            className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                            title="Export Excel"
                        >
                            <FileSpreadsheet size={13} /> XLS
                        </button>
                        <button
                            onClick={() => exportToPDF(viewingRecord ? `${viewingRecord.periodStart} to ${viewingRecord.periodEnd}` : periodLabel)}
                            disabled={filteredRows.length === 0}
                            className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                            title="Export PDF"
                        >
                            <FileText size={13} /> PDF
                        </button>
                    </div>

                    <span className="text-slate-200 dark:text-slate-700">|</span>

                    {/* History Button */}
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${showHistory ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    >
                        <History size={13} /> History
                    </button>

                    {/* Success Indicator */}
                    {saveResult && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                            <CheckCircle2 size={14} />
                            Saved {saveResult.updatedItems} items
                        </div>
                    )}

                    {/* Save Button (only in live mode) */}
                    {!viewingRecord && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving || countedRows.length === 0}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? (
                                <><Loader2 size={16} className="animate-spin" /> Saving...</>
                            ) : (
                                <><Save size={16} /> Save Physical Count</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* History Panel */}
            {showHistory && (
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/10 dark:border-slate-700/60 shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History size={16} className="text-indigo-500" /> Reconciliation History
                        </h3>
                        <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                    {historyLoading ? (
                        <div className="p-8 text-center">
                            <Loader2 size={20} className="animate-spin text-indigo-500 mx-auto" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-400">No saved reconciliation records yet.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50">
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Date Saved</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Period</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Saved By</th>
                                    <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Items</th>
                                    <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Variance Items</th>
                                    <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Variance Cost</th>
                                    <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                                {history.map(rec => (
                                    <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors">
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                            {rec.savedAt.toLocaleDateString()}<br />
                                            <span className="text-[10px] text-slate-400">{rec.savedAt.toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                                            {rec.periodStart} → {rec.periodEnd}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{rec.savedByName}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{rec.totalItems}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-bold ${rec.itemsWithVariance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {rec.itemsWithVariance}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${rec.totalVarianceCost < 0 ? 'text-red-600 dark:text-red-400' : rec.totalVarianceCost > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                            {rec.totalVarianceCost !== 0 ? (rec.totalVarianceCost < 0 ? '-' : '+') : ''}{formatCurrency(rec.totalVarianceCost)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleViewRecord(rec)}
                                                className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-1 mx-auto"
                                            >
                                                <Eye size={12} /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 px-5 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400 text-sm">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-400">Loading reconciliation data...</p>
                    </div>
                </div>
            )}

            {/* Data Table */}
            {!isLoading && filteredRows.length > 0 && (
                <div id="recon-print-area" className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/10 dark:border-slate-700/60 shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50">
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">#</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Category</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap min-w-[180px]">Item Name</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">UOM</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Beginning Inv</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 whitespace-nowrap">Purchases (IN)</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 whitespace-nowrap bg-blue-50/50 dark:bg-blue-900/10">Stock On Hand</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 whitespace-nowrap">POS Sales</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 whitespace-nowrap">Event Sales</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 whitespace-nowrap bg-cyan-50/50 dark:bg-cyan-900/10">Ending (System)</th>
                                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 whitespace-nowrap bg-amber-50/50 dark:bg-amber-900/10">Ending (Actual)</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Variance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                                {filteredRows.map((row, index) => {
                                    const isNegative = row.variance !== null && row.variance < -0.001;
                                    const isPositive = row.variance !== null && row.variance > 0.001;

                                    return (
                                        <tr
                                            key={row.itemId}
                                            className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/20 ${isNegative ? 'bg-red-50/30 dark:bg-red-900/5' :
                                                isPositive ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : ''
                                                }`}
                                        >
                                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${row.category === 'FG' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                    row.category === 'RAW MAT' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                        'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                    }`}>
                                                    {row.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.itemName}</td>
                                            <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 text-xs uppercase">{row.uom}</td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{formatQty(row.beginningInventory)}</td>
                                            <td className="px-4 py-3 text-right font-medium text-indigo-600 dark:text-indigo-400">
                                                {row.purchasesIn > 0 ? `+${formatQty(row.purchasesIn)}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/5">{formatQty(row.stockOnHand)}</td>
                                            <td className="px-4 py-3 text-right font-medium text-orange-600 dark:text-orange-400">
                                                {row.posSales > 0 ? formatQty(row.posSales) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-purple-600 dark:text-purple-400">
                                                {row.eventSales > 0 ? formatQty(row.eventSales) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50/30 dark:bg-cyan-900/5">{formatQty(row.endingSystem)}</td>

                                            {/* Ending Actual */}
                                            <td className="px-4 py-3 bg-amber-50/30 dark:bg-amber-900/5">
                                                {viewingRecord ? (
                                                    <span className="block text-center font-bold text-slate-900 dark:text-white">
                                                        {row.endingActual !== null ? formatQty(row.endingActual) : '—'}
                                                    </span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        placeholder="—"
                                                        value={row.endingActual ?? ''}
                                                        onChange={(e) => handleActualCountChange(index, e.target.value)}
                                                        className="w-24 mx-auto block px-3 py-1.5 bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-700 rounded-lg text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                                    />
                                                )}
                                            </td>

                                            {/* Variance */}
                                            <td className="px-4 py-3 text-right">
                                                {row.variance !== null ? (
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${isNegative
                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                        : isPositive
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                                        }`}>
                                                        {isNegative ? <TrendingDown size={12} /> : isPositive ? <TrendingUp size={12} /> : <Minus size={12} />}
                                                        {row.variance > 0 ? '+' : ''}{formatQty(row.variance)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                            <ClipboardCheck size={14} className="inline mr-1" />
                            {viewingRecord ? 'Viewing saved reconciliation record (read-only)' : 'Enter physical counts in the Ending (Actual) column, then click Save Physical Count'}
                        </p>
                        {!viewingRecord && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving || countedRows.length === 0}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Physical Count
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredRows.length === 0 && !error && (
                <div className="bg-white/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet size={28} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Items Found</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        No inventory items found for this business unit. Add items first, then return here to reconcile.
                    </p>
                </div>
            )}
        </div>
    );
};

export default VarianceReconReport;
