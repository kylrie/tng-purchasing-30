import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, History, ChevronDown, Trash2, BarChart3, Eye, DollarSign, Package, TrendingUp, Calendar, Info } from 'lucide-react';
import { PosImportService } from '../services/pos-import.service';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { ActivityLogService } from '../../../shared/services/activityLog.service';
import type { PosImportRow, PosImportMappedRow, PosImportBatch, PosSaleRecord, SimulatedDeduction } from '../types/pos-import.types';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { PosImportPreviewModal } from '../components/PosImportPreviewModal';

interface Props {
    businesses: { id: string; name: string }[];
}

type ViewState = 'UPLOAD' | 'PREVIEW' | 'COMMITTING' | 'SUCCESS';
type Tab = 'import' | 'history' | 'report';
type DatePeriod = 'today' | 'week' | 'month' | 'custom';

const PosImportDashboard: React.FC<Props> = () => {
    const { currentUser } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Resolve the active BU id: if 'all' is selected in global context,
    // fall back to the first BU the user has access to
    const selectedBU = selectedBusinessUnit === 'all'
        ? (currentUser?.businessUnitIds?.[0] || '')
        : selectedBusinessUnit;
    const [activeTab, setActiveTab] = useState<Tab>('import');
    const [viewState, setViewState] = useState<ViewState>('UPLOAD');
    const [file, setFile] = useState<File | null>(null);
    const [fileHash, setFileHash] = useState<string>('');
    const [parsedRows, setParsedRows] = useState<PosImportRow[]>([]);
    const [hasAmountColumn, setHasAmountColumn] = useState<boolean>(true);
    const [mappedRows, setMappedRows] = useState<PosImportMappedRow[]>([]);
    const [inventoryItems, setInventoryItems] = useState<(InventoryItem & { id: string })[]>([]);
    const [importHistory, setImportHistory] = useState<PosImportBatch[]>([]);
    const [importDate, setImportDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Sales report state
    const [allSales, setAllSales] = useState<PosSaleRecord[]>([]);
    const [salesLoading, setSalesLoading] = useState(false);

    // Date period filter state (shared for history + report)
    const [datePeriod, setDatePeriod] = useState<DatePeriod>('month');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');

    // Batch detail drill-down
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
    const [batchSales, setBatchSales] = useState<PosSaleRecord[]>([]);
    const [batchSalesLoading, setBatchSalesLoading] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [simulatedDeductions, setSimulatedDeductions] = useState<SimulatedDeduction[]>([]);
    const [isSimulating, setIsSimulating] = useState(false);

    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDeleteBatch = async (batchId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this import batch and reverse its inventory deductions? This cannot be undone.')) return;
        
        setIsDeleting(batchId);
        try {
            await PosImportService.deleteImportBatch(batchId, currentUser?.id || '', currentUser?.name || 'Unknown User');
            setImportHistory(prev => prev.filter(b => b.id !== batchId));
            if (expandedBatchId === batchId) {
                setExpandedBatchId(null);
                setBatchSales([]);
            }
        } catch (err) {
            console.error('Failed to delete batch:', err);
            alert('Failed to delete import batch. Please try again.');
        } finally {
            setIsDeleting(null);
        }
    };

    // -- Date range helper --
    const getDateBounds = useCallback((): { start: Date; end: Date } | null => {
        const now = new Date();
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        const start = new Date(now); start.setHours(0, 0, 0, 0);

        if (datePeriod === 'week') {
            const day = start.getDay();
            start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        } else if (datePeriod === 'month') {
            start.setDate(1);
        } else if (datePeriod === 'custom') {
            if (!customStart || !customEnd) return null;
            const s = new Date(customStart); s.setHours(0, 0, 0, 0);
            const e = new Date(customEnd); e.setHours(23, 59, 59, 999);
            return { start: s, end: e };
        }
        return { start, end };
    }, [datePeriod, customStart, customEnd]);

    // -- Load import history on mount / BU change --
    useEffect(() => {
        if (selectedBU) {
            PosImportService.getImportHistory(selectedBU).then(setImportHistory).catch(console.error);
        }
    }, [selectedBU]);

    // -- Filter history by period (client-side) --
    const filteredHistory = useMemo(() => {
        const bounds = getDateBounds();
        if (!bounds) return [];
        return importHistory.filter(batch => {
            const ts = batch.importedAt?.toMillis?.() ?? 0;
            return ts >= bounds.start.getTime() && ts <= bounds.end.getTime();
        });
    }, [importHistory, getDateBounds]);

    // -- Load sales when switching to report tab or period changes --
    useEffect(() => {
        if (activeTab === 'report' && selectedBU) {
            const bounds = getDateBounds();
            if (!bounds) { setAllSales([]); return; }
            setSalesLoading(true);
            PosImportService.getSalesByDateRange(selectedBU, bounds.start, bounds.end)
                .then(setAllSales)
                .catch(console.error)
                .finally(() => setSalesLoading(false));
        }
    }, [activeTab, selectedBU, datePeriod, customStart, customEnd, getDateBounds]);

    // ================================================================
    // BATCH DETAIL DRILL-DOWN
    // ================================================================

    const handleBatchClick = async (batchId: string) => {
        if (expandedBatchId === batchId) {
            setExpandedBatchId(null);
            setBatchSales([]);
            return;
        }
        setExpandedBatchId(batchId);
        setBatchSalesLoading(true);
        try {
            const sales = await PosImportService.getSalesByBatchId(batchId);
            setBatchSales(sales);
        } catch (err) {
            console.error('Failed to load batch details:', err);
        } finally {
            setBatchSalesLoading(false);
        }
    };

    // ================================================================
    // FILE HANDLING
    // ================================================================

    const handleFileSelect = useCallback(async (selectedFile: File) => {
        setError(null);
        setFile(selectedFile);
        setLoading(true);

        try {
            const hash = await PosImportService.generateFileHash(selectedFile);
            setFileHash(hash);

            if (selectedBU) {
                const existing = await PosImportService.checkDuplicateImport(hash, selectedBU);
                if (existing) {
                    setError(`This file was already imported on ${existing.importedAt?.toDate?.()?.toLocaleDateString() || 'a previous date'} by ${existing.importedByName}.`);
                    setLoading(false);
                    return;
                }
            }

            const { rows, hasAmountColumn: hasAmount } = await PosImportService.parseFile(selectedFile);
            setParsedRows(rows);
            setHasAmountColumn(hasAmount);

            if (selectedBU) {
                const { mappedRows: mapped, inventoryItems: items } = await PosImportService.matchItemsToInventory(rows, selectedBU, hasAmount);
                setMappedRows(mapped);
                setInventoryItems(items);
            }

            setViewState('PREVIEW');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse file');
        } finally {
            setLoading(false);
        }
    }, [selectedBU]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelect(droppedFile);
    }, [handleFileSelect]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) handleFileSelect(f);
    };

    // ================================================================
    // MANUAL MATCHING
    // ================================================================

    const handleManualMatch = (rowIndex: number, itemId: string) => {
        const item = inventoryItems.find(i => i.id === itemId);
        setMappedRows(prev => prev.map(row => {
            if (row.rowIndex !== rowIndex) return row;
            if (!item) {
                return { ...row, matchedItemId: null, matchedItemName: null, matchStatus: 'UNMATCHED', currentStock: null, negativeStockFlag: false, amountSource: 'file' };
            }
            const theoStock = item.theoreticalStock ?? item.currentStock ?? 0;
            // FGs with recipes don't get their own stock deducted — BOM ingredients do
            const hasRecipe = item.recipe && item.recipe.length > 0;
            const newStock = hasRecipe ? null : theoStock - row.qtySold;

            // Smart amount: auto-fill from selling price if file had no amount column or row amount is 0
            let resolvedAmount = row.amount;
            let amountSource: 'file' | 'selling_price' = row.amountSource || 'file';
            if (!hasAmountColumn || row.amount === 0) {
                const fgSellingPrice = item.costPerUnit ?? 0;
                if (fgSellingPrice > 0) {
                    resolvedAmount = fgSellingPrice * row.qtySold;
                    amountSource = 'selling_price';
                }
            }

            // Override costs with recipe-derived baseCost
            const unitCost = item.baseCost ?? 0;
            const recipeCost = unitCost * row.qtySold;
            const recipeProfit = resolvedAmount - recipeCost;
            return {
                ...row,
                amount: resolvedAmount,
                costs: recipeCost,
                profit: recipeProfit,
                matchedItemId: item.id,
                matchedItemName: item.name,
                matchStatus: 'MATCHED',
                currentStock: theoStock,
                negativeStockFlag: newStock !== null ? newStock < 0 : false,
                amountSource,
            };
        }));
    };

    // ================================================================
    // COMMIT IMPORT
    // ================================================================

    const handlePreviewAndSimulate = async () => {
        if (!currentUser || !selectedBU) return;
        setIsSimulating(true);
        setError(null);
        try {
            const q = query(collection(db, 'inventory_items'), where('businessUnitId', '==', selectedBU), where('isActive', '==', true));
            const snap = await getDocs(q);
            const allItemsMap = new Map<string, InventoryItem & { id: string }>();
            snap.docs.forEach(d => allItemsMap.set(d.id, { id: d.id, ...d.data() } as InventoryItem & { id: string }));
            
            const deductions = await PosImportService.simulatePosImport(mappedRows, allItemsMap);
            setSimulatedDeductions(deductions);
            setIsPreviewOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Simulation failed');
        } finally {
            setIsSimulating(false);
        }
    };

    const handleExecuteCommit = async () => {
        if (!currentUser || !selectedBU) return;
        setViewState('COMMITTING');
        setIsPreviewOpen(false);
        setError(null);

        try {
            const batchId = await PosImportService.commitImport({
                mappedRows,
                businessUnitId: selectedBU,
                userId: currentUser.id,
                userName: currentUser.name,
                fileHash,
                fileName: file?.name || 'unknown',
                importDate,
            });
            setSuccessId(batchId);
            setViewState('SUCCESS');
            // Activity log — fire and forget
            ActivityLogService.log(
                'POS',
                'POS Sales Imported',
                `${file?.name || 'file'} imported — ${mappedRows.length} row(s) for ${importDate}`,
                { id: currentUser.id, name: currentUser.name },
                selectedBU,
                { entityId: batchId, entityType: 'POS Batch', severity: 'success' }
            );
            PosImportService.getImportHistory(selectedBU).then(setImportHistory).catch(console.error);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
            setViewState('PREVIEW');
        }
    };

    const resetAll = useCallback(() => {
        setFile(null);
        setFileHash('');
        setParsedRows([]);
        setMappedRows([]);
        setViewState('UPLOAD');
        setError(null);
        setSuccessId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    // Reset local state when the global Business Unit changes
    useEffect(() => {
        resetAll();
        setExpandedBatchId(null);
    }, [selectedBU, resetAll]);


    // ================================================================
    // COMPUTED VALUES
    // ================================================================

    const matchedCount = mappedRows.filter(r => r.matchStatus === 'MATCHED').length;
    const unmatchedCount = mappedRows.filter(r => r.matchStatus === 'UNMATCHED').length;
    const totalAmount = mappedRows.reduce((s, r) => s + r.amount, 0);
    const totalProfit = mappedRows.reduce((s, r) => s + r.profit, 0);
    const negativeStockRows = mappedRows.filter(r => r.negativeStockFlag);
    const canCommit = matchedCount > 0;

    // Sales report aggregate stats
    const reportTotalRevenue = allSales.reduce((s, r) => s + r.amount, 0);
    const reportTotalProfit = allSales.reduce((s, r) => s + r.profit, 0);
    const reportTotalQty = allSales.reduce((s, r) => s + r.qtySold, 0);

    // ================================================================
    // TAB CONFIG
    // ================================================================

    const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
        { key: 'import', label: 'Import', icon: Upload },
        { key: 'history', label: `History (${importHistory.length})`, icon: History },
        { key: 'report', label: 'Sales Report', icon: BarChart3 },
    ];

    // ================================================================
    // RENDER
    // ================================================================

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <FileSpreadsheet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                        POS Sales Import
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Upload POS sales data, view import history, and browse sales reports</p>
                </div>
                {/* BU is controlled by the global header selector */}
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.key
                                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-red-600 dark:text-red-300 font-medium">Import Error</p>
                        <p className="text-red-500 dark:text-red-400/80 text-sm mt-1">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                        <XCircle className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ============================================================ */}
            {/* IMPORT TAB */}
            {/* ============================================================ */}
            {activeTab === 'import' && (
                <>
                    {/* UPLOAD STATE */}
                    {viewState === 'UPLOAD' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <label className="text-sm text-slate-500 dark:text-slate-400">Import Date:</label>
                                <input
                                    type="date"
                                    value={importDate}
                                    onChange={(e) => setImportDate(e.target.value)}
                                    className="bg-white dark:bg-slate-700/60 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300
                                    ${dragActive
                                        ? 'border-emerald-400 bg-emerald-400/5 scale-[1.01]'
                                        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                    }
                                `}
                            >
                                <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.xls" onChange={handleInputChange} className="hidden" />
                                {loading ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                                        <p className="text-slate-600 dark:text-slate-300">Parsing file and matching inventory...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className={`p-4 rounded-2xl transition-colors ${dragActive ? 'bg-emerald-400/10' : 'bg-slate-200 dark:bg-slate-700/50'}`}>
                                            <Upload className={`w-10 h-10 ${dragActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                                        </div>
                                        <div>
                                            <p className="text-lg font-medium text-slate-900 dark:text-white">
                                                {dragActive ? 'Drop your file here' : 'Drag & Drop your POS Sales file'}
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                Supports .xlsx, .csv — Columns: CATEGORY, ITEM NAME, QTY SOLD, AMOUNT, Costs, Profit
                                            </p>
                                        </div>
                                        <button className="px-6 py-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm font-medium">
                                            Browse Files
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PREVIEW STATE */}
                    {viewState === 'PREVIEW' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <SummaryCard label="Total Rows" value={String(parsedRows.length)} color="slate" />
                                <SummaryCard label="Matched" value={String(matchedCount)} color="emerald" />
                                <SummaryCard label="Unmatched" value={String(unmatchedCount)} color={unmatchedCount > 0 ? 'red' : 'slate'} />
                                <SummaryCard label="Total Revenue" value={`₱${totalAmount.toLocaleString()}`} color="blue" />
                                <SummaryCard label="Total Profit" value={`₱${totalProfit.toLocaleString()}`} color="violet" />
                            </div>

                            {!hasAmountColumn && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
                                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-blue-600 dark:text-blue-300 font-medium">No Amount Column Detected</p>
                                        <p className="text-blue-500 dark:text-blue-400/80 text-sm mt-1">
                                            Sales amounts are being auto-filled from FG selling prices. Items marked with <span className="inline-flex text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-500">SP</span> are auto-calculated.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {negativeStockRows.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-amber-600 dark:text-amber-300 font-medium">Negative Stock Warning</p>
                                        <p className="text-amber-500 dark:text-amber-400/80 text-sm mt-1">
                                            {negativeStockRows.length} item(s) will go negative after this import.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    <div>
                                        <p className="text-slate-900 dark:text-white font-medium">{file?.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{file ? `${(file.size / 1024).toFixed(1)} KB` : ''} • Date: {importDate}</p>
                                    </div>
                                </div>
                                <button onClick={resetAll} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-400 rounded-lg transition-colors text-sm">
                                    <Trash2 className="w-4 h-4" />
                                    Clear
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                                <th className="text-left py-3 px-4 w-8">#</th>
                                                <th className="text-left py-3 px-4">Category</th>
                                                <th className="text-left py-3 px-4">Item Name (File)</th>
                                                <th className="text-right py-3 px-4">Qty Sold</th>
                                                <th className="text-right py-3 px-4">Amount</th>
                                                <th className="text-right py-3 px-4">Cost</th>
                                                <th className="text-right py-3 px-4">Profit</th>
                                                <th className="text-center py-3 px-4">Status</th>
                                                <th className="text-left py-3 px-4 min-w-[200px]">Matched To</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mappedRows.map((row) => (
                                                <tr key={row.rowIndex} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${row.negativeStockFlag ? 'bg-amber-500/5' : ''}`}>
                                                    <td className="py-2.5 px-4 text-slate-400 dark:text-slate-500">{row.rowIndex + 1}</td>
                                                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{row.category}</td>
                                                    <td className="py-2.5 px-4 text-slate-900 dark:text-white font-medium">{row.itemName}</td>
                                                    <td className="py-2.5 px-4 text-right text-slate-900 dark:text-white">{row.qtySold}</td>
                                                    <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                                                        <span>₱{row.amount.toLocaleString()}</span>
                                                        {row.amountSource === 'selling_price' && (
                                                            <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-500" title="Auto-filled from FG selling price">SP</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">₱{row.costs.toLocaleString()}</td>
                                                    <td className={`py-2.5 px-4 text-right ${row.profit < 0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                                                        ₱{row.profit.toLocaleString()}
                                                        {row.profit < 0 && <span className="ml-1 text-[10px]">⚠ negative</span>}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        {row.matchStatus === 'MATCHED' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                                                <CheckCircle2 className="w-3 h-3" /> Matched
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-600 dark:text-red-400">
                                                                <XCircle className="w-3 h-3" /> Unmatched
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        {row.matchStatus === 'MATCHED' ? (
                                                            <div>
                                                                <span className="text-emerald-600 dark:text-emerald-300 text-sm">{row.matchedItemName}</span>
                                                                {row.negativeStockFlag && (
                                                                    <span className="ml-2 text-xs text-amber-500 dark:text-amber-400" title="Stock will go negative">⚠️ negative</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <select
                                                                    onChange={(e) => handleManualMatch(row.rowIndex, e.target.value)}
                                                                    className="w-full bg-white dark:bg-slate-700/80 text-slate-900 dark:text-white border border-red-500/30 rounded-lg px-2 py-1.5 text-sm appearance-none cursor-pointer"
                                                                    defaultValue=""
                                                                >
                                                                    <option value="">Select item...</option>
                                                                    {inventoryItems.map(item => (
                                                                        <option key={item.id} value={item.id}>
                                                                            {item.name} (Stock: {item.currentStock})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <button onClick={resetAll} className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600/60 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePreviewAndSimulate}
                                    disabled={!canCommit || isSimulating}
                                    className={`px-8 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${canCommit && !isSimulating ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                                >
                                    {isSimulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                                    Preview Import ({matchedCount} items)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* COMMITTING STATE */}
                    {viewState === 'COMMITTING' && (
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-2xl p-16 text-center">
                            <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mx-auto mb-6" />
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Committing Import...</h2>
                            <p className="text-slate-500 dark:text-slate-400">Writing {matchedCount} sales records, updating inventory, and creating audit trail.</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Do not close this page.</p>
                        </div>
                    )}

                    {/* SUCCESS STATE */}
                    {viewState === 'SUCCESS' && (
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-emerald-500/30 rounded-2xl p-16 text-center">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Import Successful!</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-1">{matchedCount} items imported • ₱{totalAmount.toLocaleString()} total revenue</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-8">Batch ID: {successId}</p>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={resetAll}
                                    className="px-8 py-3 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors font-medium"
                                >
                                    Import Another File
                                </button>
                                <button
                                    onClick={() => { setActiveTab('history'); }}
                                    className="px-8 py-3 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-medium flex items-center gap-2"
                                >
                                    <Eye className="w-4 h-4" />
                                    View in History
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ============================================================ */}
            {/* HISTORY TAB — Interactive */}
            {/* ============================================================ */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Date Period Filter */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                            {(['today', 'week', 'month', 'custom'] as DatePeriod[]).map((p) => {
                                const labels: Record<DatePeriod, string> = { today: 'Today', week: 'Weekly', month: 'Monthly', custom: 'Custom' };
                                return (
                                    <button key={p} onClick={() => setDatePeriod(p)}
                                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${datePeriod === p
                                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                    >
                                        {p === 'custom' && <Calendar size={14} />}
                                        {labels[p]}
                                    </button>
                                );
                            })}
                        </div>
                        {datePeriod === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                                <span className="text-slate-400 text-sm">to</span>
                                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                            </div>
                        )}
                    </div>

                    {filteredHistory.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl p-12 text-center">
                            <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400">No imports found for this period.</p>
                        </div>
                    ) : (
                        filteredHistory.map(batch => {
                            const isExpanded = expandedBatchId === batch.id;
                            return (
                                <div key={batch.id} className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden transition-all">
                                    {/* Batch Row (Clickable) */}
                                    <button
                                        onClick={() => handleBatchClick(batch.id)}
                                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center">
                                                <FileSpreadsheet className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-slate-900 dark:text-white font-semibold">{batch.fileName}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {batch.importedAt?.toDate?.()?.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'}
                                                    {' • '}by {batch.importedByName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-sm text-slate-500 dark:text-slate-400">{batch.totalRows} items</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">₱{batch.totalAmount.toLocaleString()}</p>
                                                <p className="text-xs text-blue-500 dark:text-blue-400">Profit: ₱{batch.totalProfit.toLocaleString()}</p>
                                            </div>
                                            {currentUser?.role === 'SUPER_ADMIN' && (
                                                <button
                                                    onClick={(e) => handleDeleteBatch(batch.id, e)}
                                                    disabled={isDeleting === batch.id}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Delete Import & Reverse Deductions"
                                                >
                                                    {isDeleting === batch.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                                                </button>
                                            )}
                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-200 dark:border-slate-700/50">
                                            {batchSalesLoading ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                                                    <span className="ml-3 text-slate-500 dark:text-slate-400 text-sm">Loading batch details...</span>
                                                </div>
                                            ) : batchSales.length === 0 ? (
                                                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No sale records found for this batch.</div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                                                <th className="text-left py-2.5 px-5">Category</th>
                                                                <th className="text-left py-2.5 px-5">Item</th>
                                                                <th className="text-right py-2.5 px-5">Qty</th>
                                                                <th className="text-right py-2.5 px-5">Amount</th>
                                                                <th className="text-right py-2.5 px-5">Cost</th>
                                                                <th className="text-right py-2.5 px-5">Profit</th>
                                                                <th className="text-center py-2.5 px-5">Stock Flag</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {batchSales.map(sale => (
                                                                <tr key={sale.id} className={`border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20 ${sale.negativeStockFlag ? 'bg-amber-500/5' : ''}`}>
                                                                    <td className="py-2 px-5 text-slate-600 dark:text-slate-300">{sale.category}</td>
                                                                    <td className="py-2 px-5 text-slate-900 dark:text-white font-medium">{sale.inventoryItemName}</td>
                                                                    <td className="py-2 px-5 text-right text-slate-900 dark:text-white">{sale.qtySold}</td>
                                                                    <td className="py-2 px-5 text-right text-emerald-600 dark:text-emerald-400">₱{sale.amount.toLocaleString()}</td>
                                                                    <td className="py-2 px-5 text-right text-slate-600 dark:text-slate-300">₱{sale.costs.toLocaleString()}</td>
                                                                    <td className="py-2 px-5 text-right text-blue-600 dark:text-blue-400">₱{sale.profit.toLocaleString()}</td>
                                                                    <td className="py-2 px-5 text-center">
                                                                        {sale.negativeStockFlag ? (
                                                                            <span className="text-xs text-amber-500 dark:text-amber-400">⚠️</span>
                                                                        ) : (
                                                                            <span className="text-xs text-emerald-500 dark:text-emerald-400">✓</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-slate-50 dark:bg-slate-900/50 font-semibold border-t border-slate-300 dark:border-slate-600">
                                                                <td className="py-2.5 px-5 text-slate-900 dark:text-white" colSpan={2}>Total ({batchSales.length} items)</td>
                                                                <td className="py-2.5 px-5 text-right text-slate-900 dark:text-white">{batchSales.reduce((s, r) => s + r.qtySold, 0)}</td>
                                                                <td className="py-2.5 px-5 text-right text-emerald-600 dark:text-emerald-400">₱{batchSales.reduce((s, r) => s + r.amount, 0).toLocaleString()}</td>
                                                                <td className="py-2.5 px-5 text-right text-slate-600 dark:text-slate-300">₱{batchSales.reduce((s, r) => s + r.costs, 0).toLocaleString()}</td>
                                                                <td className="py-2.5 px-5 text-right text-blue-600 dark:text-blue-400">₱{batchSales.reduce((s, r) => s + r.profit, 0).toLocaleString()}</td>
                                                                <td></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ============================================================ */}
            {/* SALES REPORT TAB */}
            {/* ============================================================ */}
            {activeTab === 'report' && (
                <div className="space-y-5">
                    {/* Date Period Filter */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                            {(['today', 'week', 'month', 'custom'] as DatePeriod[]).map((p) => {
                                const labels: Record<DatePeriod, string> = { today: 'Today', week: 'Weekly', month: 'Monthly', custom: 'Custom' };
                                return (
                                    <button key={p} onClick={() => setDatePeriod(p)}
                                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${datePeriod === p
                                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                    >
                                        {p === 'custom' && <Calendar size={14} />}
                                        {labels[p]}
                                    </button>
                                );
                            })}
                        </div>
                        {datePeriod === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                                <span className="text-slate-400 text-sm">to</span>
                                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                            </div>
                        )}
                    </div>
                    {/* Report Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</p>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">₱{reportTotalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total Profit</p>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">₱{reportTotalProfit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-purple-500/10 dark:bg-purple-500/20 rounded-xl flex items-center justify-center">
                                    <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total Qty Sold</p>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{reportTotalQty.toLocaleString()}</p>
                        </div>
                    </div>

                    {salesLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                            <span className="ml-3 text-slate-500 dark:text-slate-400">Loading sales data...</span>
                        </div>
                    ) : allSales.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl p-12 text-center">
                            <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400">No sales data yet. Import a POS file to see your sales report.</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left py-3 px-4">Date</th>
                                            <th className="text-left py-3 px-4">Category</th>
                                            <th className="text-left py-3 px-4">Item</th>
                                            <th className="text-right py-3 px-4">Qty</th>
                                            <th className="text-right py-3 px-4">Amount</th>
                                            <th className="text-right py-3 px-4">Cost</th>
                                            <th className="text-right py-3 px-4">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allSales.map(sale => (
                                            <tr key={sale.id} className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                                                <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">{sale.importDate || '—'}</td>
                                                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{sale.category}</td>
                                                <td className="py-2.5 px-4 text-slate-900 dark:text-white font-medium">{sale.inventoryItemName}</td>
                                                <td className="py-2.5 px-4 text-right text-slate-900 dark:text-white">{sale.qtySold}</td>
                                                <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">₱{sale.amount.toLocaleString()}</td>
                                                <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">₱{sale.costs.toLocaleString()}</td>
                                                <td className="py-2.5 px-4 text-right text-blue-600 dark:text-blue-400">₱{sale.profit.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 dark:bg-slate-900/50 font-semibold border-t-2 border-slate-300 dark:border-slate-600">
                                            <td className="py-3 px-4 text-slate-900 dark:text-white" colSpan={3}>Grand Total ({allSales.length} records)</td>
                                            <td className="py-3 px-4 text-right text-slate-900 dark:text-white">{reportTotalQty.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">₱{reportTotalRevenue.toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">₱{allSales.reduce((s, r) => s + r.costs, 0).toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400">₱{reportTotalProfit.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PREVIEW MODAL */}
            <PosImportPreviewModal
                isOpen={isPreviewOpen}
                simulatedDeductions={simulatedDeductions}
                onConfirm={handleExecuteCommit}
                onCancel={() => setIsPreviewOpen(false)}
                isSubmitting={viewState === 'COMMITTING'}
            />
        </div>
    );
};

// ================================================================
// HELPER COMPONENTS
// ================================================================

const SummaryCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
    const colorMap: Record<string, string> = {
        slate: 'text-slate-600 dark:text-slate-300',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        red: 'text-red-600 dark:text-red-400',
        blue: 'text-blue-600 dark:text-blue-400',
        violet: 'text-violet-600 dark:text-violet-400',
    };
    return (
        <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
            <p className={`text-xl font-bold mt-1 ${colorMap[color] || 'text-slate-900 dark:text-white'}`}>{value}</p>
        </div>
    );
};

export default PosImportDashboard;
