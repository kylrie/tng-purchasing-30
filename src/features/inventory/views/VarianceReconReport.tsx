import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    X,
    Search,
    Zap,
    Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ReconService, type ReconRow, type ReconHistoryRecord } from '../services/recon.service';
import type { Business, User } from '../../procurement/types';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';

// ============================================================
// PROPS
// ============================================================

interface VarianceReconReportProps {
    businesses: Business[];
    currentUser: User;
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
        'Prod/Waste': r.prodWaste ?? 0,
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
// SAFE MATH EXPRESSION PARSER
// ============================================================

function safeEval(str: string): number {
    const tokens = str.match(/\d+\.?\d*|[-+*/()]/g);
    if (!tokens) throw new Error("Invalid expression");

    let pos = 0;
    function parsePrimary(): number {
        const token = tokens![pos];
        if (!token) throw new Error("Unexpected end");
        if (token === '(') {
            pos++; // consume '('
            const val = parseExpression();
            if (tokens![pos] !== ')') {
                throw new Error("Unbalanced parenthesis");
            }
            pos++; // consume ')'
            return val;
        }
        if (token === '-') {
            pos++;
            return -parsePrimary();
        }
        if (token === '+') {
            pos++;
            return parsePrimary();
        }
        const val = parseFloat(token);
        if (isNaN(val)) throw new Error("Invalid number");
        pos++;
        return val;
    }

    function parseMultiplicative(): number {
        let val = parsePrimary();
        while (pos < tokens!.length) {
            const op = tokens![pos];
            if (op === '*' || op === '/') {
                pos++;
                const nextVal = parsePrimary();
                if (op === '*') val *= nextVal;
                else {
                    if (nextVal === 0) throw new Error("Division by zero");
                    val /= nextVal;
                }
            } else {
                break;
            }
        }
        return val;
    }

    function parseExpression(): number {
        let val = parseMultiplicative();
        while (pos < tokens!.length) {
            const op = tokens![pos];
            if (op === '+' || op === '-') {
                pos++;
                const nextVal = parseMultiplicative();
                if (op === '+') val += nextVal;
                else val -= nextVal;
            } else {
                break;
            }
        }
        return val;
    }

    const res = parseExpression();
    if (pos < tokens.length) throw new Error("Extra input");
    return res;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNCOUNTED' | 'VARIANCES'>('ALL');

    // Inline calculator: keep raw expression strings per item
    const [expressionMap, setExpressionMap] = useState<Record<string, string>>({});

    // Draft tracking
    const [hasDraft, setHasDraft] = useState(false);
    const draftKeyRef = useRef('');

    // Tabs & History
    const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
    const [history, setHistory] = useState<ReconHistoryRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [viewingRecord, setViewingRecord] = useState<ReconHistoryRecord | null>(null);

    const periodLabel = `${dateRange.start}→${dateRange.end}`;

    // ================================================================
    // DRAFT PERSISTENCE HELPERS
    // ================================================================
    const getDraftKey = useCallback(() => {
        return `recon_draft_${selectedBU}_${periodLabel}`;
    }, [selectedBU, periodLabel]);

    const saveDraftToStorage = useCallback((updatedRows: ReconRow[]) => {
        try {
            const key = getDraftKey();
            const draft: Record<string, number | null> = {};
            let hasAny = false;
            for (const row of updatedRows) {
                if (row.endingActual !== null) {
                    draft[row.itemId] = row.endingActual;
                    hasAny = true;
                }
            }
            if (hasAny) {
                localStorage.setItem(key, JSON.stringify(draft));
                setHasDraft(true);
            } else {
                localStorage.removeItem(key);
                setHasDraft(false);
            }
        } catch { /* localStorage may be full / unavailable */ }
    }, [getDraftKey]);

    const loadDraftFromStorage = useCallback((freshRows: ReconRow[]): ReconRow[] => {
        try {
            const key = getDraftKey();
            const stored = localStorage.getItem(key);
            if (!stored) { setHasDraft(false); return freshRows; }
            const draft: Record<string, unknown> = JSON.parse(stored);
            setHasDraft(true);
            return freshRows.map(row => {
                const saved = draft[row.itemId];
                if (saved !== undefined && saved !== null) {
                    const parsedVal = Number(saved);
                    if (!isNaN(parsedVal) && isFinite(parsedVal) && parsedVal >= 0) {
                        const variance = parsedVal - row.endingSystem;
                        return { ...row, endingActual: parsedVal, variance };
                    }
                }
                return row;
            });
        } catch { setHasDraft(false); return freshRows; }
    }, [getDraftKey]);

    const clearDraft = useCallback(() => {
        try { localStorage.removeItem(getDraftKey()); } catch { /* noop */ }
        setHasDraft(false);
        setExpressionMap({});
        setRows(prev => prev.map(row => ({ ...row, endingActual: null, variance: null })));
    }, [getDraftKey]);

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

            const data = await ReconService.getReconData(currentUser, selectedBU, start, end);
            // Restore any saved draft from localStorage
            const restored = loadDraftFromStorage(data);
            setRows(restored);
        } catch (err) {
            console.error('Error loading recon data:', err);
            setError('Failed to load reconciliation data');
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, selectedBU, dateRange, loadDraftFromStorage]);

    useEffect(() => { loadData(); }, [loadData]);

    // Update draftKeyRef whenever the key changes
    useEffect(() => { draftKeyRef.current = getDraftKey(); }, [getDraftKey]);

    // ================================================================
    // LOAD HISTORY
    // ================================================================
    const loadHistory = useCallback(async () => {
        if (!selectedBU) return;
        setHistoryLoading(true);
        setError(null);
        try {
            const records = await ReconService.getHistory(currentUser, selectedBU);
            setHistory(records);
        } catch (err) {
            console.error('Error loading history:', err);
            setError('Failed to load reconciliation history');
        } finally {
            setHistoryLoading(false);
        }
    }, [currentUser, selectedBU]);

    useEffect(() => {
        if (activeTab === 'history') loadHistory();
    }, [activeTab, loadHistory]);

    const evaluateExpression = (expr: string): number | null => {
        try {
            const sanitized = expr.replace(/[^0-9+\-*/.() ]/g, '');
            if (!sanitized || /[+\-*/.]$/.test(sanitized.trim())) return null; // incomplete
            const result = safeEval(sanitized);
            return Number.isFinite(result) ? Number(result.toFixed(4)) : null;
        } catch { return null; }
    };

    // ================================================================
    // HANDLE ACTUAL COUNT INPUT (with expression + draft persistence)
    // ================================================================
    const handleActualCountChange = (itemId: string, rawValue: string) => {
        // Store raw expression
        setExpressionMap(prev => ({ ...prev, [itemId]: rawValue }));

        const evaluated = rawValue === '' ? null : evaluateExpression(rawValue);
        // If it's a plain number, also accept it directly
        const numericParsed = rawValue === '' ? null : (evaluated ?? (isNaN(Number(rawValue)) ? null : Number(rawValue)));

        setRows(prev => {
            const updated = prev.map((row) => {
                if (row.itemId !== itemId) return row;
                const actualCount = numericParsed;
                const variance = actualCount !== null ? actualCount - row.endingSystem : null;
                return { ...row, endingActual: actualCount, variance };
            });
            // Auto-save draft
            saveDraftToStorage(updated);
            return updated;
        });
        setSaveResult(null);
    };

    // ================================================================
    // AUTOFILL SYSTEM COUNTS
    // ================================================================
    const handleAutofill = () => {
        setRows(prev => {
            const updated = prev.map(row => {
                if (row.endingActual !== null) return row; // don't overwrite existing entries
                return { ...row, endingActual: row.endingSystem, variance: 0 };
            });
            saveDraftToStorage(updated);
            return updated;
        });
        // Clear expression map for autofilled items
        setExpressionMap({});
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
            const endDate = new Date(dateRange.end + 'T23:59:59');
            const result = await ReconService.savePhysicalCounts(
                currentUser,
                rows,
                selectedBU,
                periodLabel,
                endDate
            );
            setSaveResult(result);
            // Clear draft after successful save
            try { localStorage.removeItem(getDraftKey()); } catch { /* noop */ }
            setHasDraft(false);
            setExpressionMap({});
            // Refresh history if tab is open
            if (activeTab === 'history') loadHistory();
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
        setActiveTab('live');
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
    
    const filteredRows = useMemo(() => {
        let result = categoryFilter === 'ALL' ? displayRows : displayRows.filter(r => r.category === categoryFilter);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => r.itemName?.toLowerCase().includes(q));
        }
        // Status filter
        if (statusFilter === 'UNCOUNTED') {
            result = result.filter(r => r.endingActual === null);
        } else if (statusFilter === 'VARIANCES') {
            result = result.filter(r => r.variance !== null && Math.abs(r.variance) > 0.001);
        }
        return result;
    }, [displayRows, categoryFilter, searchQuery, statusFilter]);

    const countedRows = filteredRows.filter(r => r.endingActual !== null);
    const varianceRows = filteredRows.filter(r => r.variance !== null && Math.abs(r.variance) > 0.001);

    // High-variance warning helper
    const getHighVariance = (row: ReconRow): boolean => {
        if (row.endingActual === null || row.variance === null) return false;
        if (row.endingSystem <= 0) return false;
        return (Math.abs(row.variance) / Math.abs(row.endingSystem)) * 100 > 20;
    };

    // ================================================================
    // RENDER
    // ================================================================
    return (
        <div className="space-y-6">
            {/* Header Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700/60 gap-6">
                <button
                    onClick={() => {
                        setActiveTab('live');
                        setViewingRecord(null); // Clear viewing snapshot when going back to live
                    }}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all px-1 flex items-center gap-2 ${
                        activeTab === 'live' && !viewingRecord
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                >
                    <ClipboardCheck size={16} />
                    Live Reconciliation
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all px-1 flex items-center gap-2 ${
                        activeTab === 'history' || viewingRecord
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                >
                    <History size={16} />
                    Reconciliation History
                </button>
            </div>

            {/* Live Filter Controls */}
            {activeTab === 'live' && (
                <>
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

                    {/* Search Filter */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search item name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-full sm:w-[200px]"
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
                            {/* Status Filter Toggles */}
                            {!viewingRecord && (
                                <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 mr-2">
                                    {(['ALL', 'UNCOUNTED', 'VARIANCES'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setStatusFilter(mode)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                                statusFilter === mode
                                                    ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            {mode === 'ALL' ? 'All' : mode === 'UNCOUNTED' ? 'Uncounted' : 'Variances'}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Autofill Button */}
                            {!viewingRecord && (
                                <button
                                    onClick={handleAutofill}
                                    className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-1.5"
                                    title="Copy system values into all empty Actual fields"
                                >
                                    <Zap size={13} /> Autofill
                                </button>
                            )}

                            {/* Clear Draft Button */}
                            {!viewingRecord && hasDraft && (
                                <button
                                    onClick={clearDraft}
                                    className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-1.5"
                                    title="Clear all entered counts and remove saved draft"
                                >
                                    <Trash2 size={13} /> Clear Draft
                                </button>
                            )}

                            <span className="text-slate-200 dark:text-slate-700">|</span>

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

                    {/* Draft Restoration Banner */}
                    {hasDraft && !viewingRecord && (
                        <div className="flex items-center justify-between px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
                            <div className="flex items-center gap-3 text-blue-700 dark:text-blue-400 text-sm">
                                <Save size={16} />
                                <span><strong>Draft Restored</strong> — Your previously entered counts have been loaded from a saved draft.</span>
                            </div>
                            <button
                                onClick={clearDraft}
                                className="px-3 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-lg text-xs font-bold hover:bg-blue-300 dark:hover:bg-blue-700"
                            >
                                <Trash2 size={14} className="inline mr-1" />Clear Draft
                            </button>
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
                                            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 whitespace-nowrap">Event Sales</th>
                                            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 whitespace-nowrap">Prod/Waste</th>
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
                                                    <td className="px-4 py-3 text-right font-medium text-pink-600 dark:text-pink-400">
                                                        {row.eventSales > 0 ? formatQty(row.eventSales) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-purple-600 dark:text-purple-400">
                                                        {row.prodWaste > 0 ? formatQty(row.prodWaste) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50/30 dark:bg-cyan-900/5">{formatQty(row.endingSystem)}</td>

                                                    {/* Ending Actual */}
                                                    <td className="px-4 py-3 bg-amber-50/30 dark:bg-amber-900/5">
                                                        {viewingRecord ? (
                                                            <span className="block text-center font-bold text-slate-900 dark:text-white">
                                                                {row.endingActual !== null ? formatQty(row.endingActual) : '—'}
                                                            </span>
                                                        ) : (
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    placeholder="—"
                                                                    value={expressionMap[row.itemId] !== undefined ? expressionMap[row.itemId] : (row.endingActual ?? '')}
                                                                    onChange={(e) => handleActualCountChange(row.itemId, e.target.value)}
                                                                    className={`w-28 mx-auto block px-3 py-1.5 bg-white dark:bg-slate-900 border-2 rounded-lg text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 placeholder:text-slate-300 dark:placeholder:text-slate-600 ${
                                                                        getHighVariance(row)
                                                                            ? 'border-red-400 dark:border-red-600 focus:ring-red-500/50 focus:border-red-500'
                                                                            : 'border-amber-300 dark:border-amber-700 focus:ring-amber-500/50 focus:border-amber-500'
                                                                    }`}
                                                                    title={expressionMap[row.itemId] && row.endingActual !== null ? `= ${row.endingActual}` : ''}
                                                                />
                                                                {getHighVariance(row) && (
                                                                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-red-500 rounded-full" title={`High variance: ${row.variance !== null ? Math.round((Math.abs(row.variance) / Math.abs(row.endingSystem)) * 100) : 0}% off`}>
                                                                        <AlertTriangle size={10} className="text-white" />
                                                                    </span>
                                                                )}
                                                                {/* Evaluated expression hint */}
                                                                {expressionMap[row.itemId] && /[+\-*/]/.test(expressionMap[row.itemId]) && row.endingActual !== null && (
                                                                    <span className="block text-center text-[10px] text-slate-400 mt-0.5">= {row.endingActual}</span>
                                                                )}
                                                            </div>
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
                                {displayRows.length === 0 
                                    ? 'No inventory items found for this business unit. Add items first, then return here to reconcile.'
                                    : 'No matching items found for the applied filters.'}
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* History Tab Content */}
            {activeTab === 'history' && (
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/10 dark:border-slate-700/60 shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History size={16} className="text-indigo-500" /> Reconciliation History
                        </h3>
                    </div>
                    {historyLoading ? (
                        <div className="p-16 text-center">
                            <Loader2 size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Loading history records...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                                <History size={28} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No History Found</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                No saved reconciliation records yet. Reconcile live counts and save them to build history.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                                        <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Date Saved</th>
                                        <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Period</th>
                                        <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Saved By</th>
                                        <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Total Items</th>
                                        <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Items With Variance</th>
                                        <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Variance Cost</th>
                                        <th className="px-6 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                                    {history.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors">
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                                                {rec.savedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                <span className="block text-[11px] text-slate-400 font-normal mt-0.5">{rec.savedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                                                {rec.periodStart} &rarr; {rec.periodEnd}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{rec.savedByName}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">{rec.totalItems}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${rec.itemsWithVariance > 0 ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'}`}>
                                                    {rec.itemsWithVariance}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${rec.totalVarianceCost < 0 ? 'text-red-600 dark:text-red-400' : rec.totalVarianceCost > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                                {rec.totalVarianceCost !== 0 ? (rec.totalVarianceCost < 0 ? '-' : '+') : ''}{formatCurrency(rec.totalVarianceCost)}
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => handleViewRecord(rec)}
                                                    className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 mx-auto"
                                                >
                                                    <Eye size={13} /> View Snapshot
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VarianceReconReport;
