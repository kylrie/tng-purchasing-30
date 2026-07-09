import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, History, ChevronDown, Trash2, BarChart3, Eye, DollarSign, Package, TrendingUp, Calendar, Info, Search, Edit } from 'lucide-react';
import { PosImportService } from '../services/pos-import.service';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { ActivityLogService } from '../../../shared/services/activityLog.service';
import type { PosImportRow, PosImportMappedRow, PosImportBatch, PosSaleRecord, SimulatedDeduction } from '../types/pos-import.types';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { PosImportPreviewModal } from '../components/PosImportPreviewModal';
import { usePermissions } from '../../../hooks/usePermissions';

interface Props {
    businesses: { id: string; name: string }[];
}

type ViewState = 'UPLOAD' | 'PREVIEW' | 'COMMITTING' | 'SUCCESS';
type Tab = 'import' | 'history' | 'report';
type DatePeriod = 'today' | 'week' | 'month' | 'custom';

// ─── Searchable Item Dropdown ────────────────────────────────────────
const SearchableItemSelect: React.FC<{
    items: (InventoryItem & { id: string })[];
    onSelect: (itemId: string) => void;
    placeholder?: string;
}> = ({ items, onSelect, placeholder = 'Type to search...' }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase().trim();
        return items.filter(i => i.name.toLowerCase().includes(q));
    }, [items, search]);

    // Reset highlight when filter changes
    // eslint-disable-next-line
    useEffect(() => setHighlightIdx(0), [filtered]);

    // Click outside to close
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Scroll highlighted item into view
    useEffect(() => {
        if (isOpen && listRef.current) {
            const el = listRef.current.children[highlightIdx] as HTMLElement;
            el?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightIdx, isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setHighlightIdx(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && filtered[highlightIdx]) {
            e.preventDefault();
            onSelect(filtered[highlightIdx].id);
            setIsOpen(false);
            setSearch('');
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-white dark:bg-slate-700/80 text-slate-900 dark:text-white border border-red-500/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {isOpen && (
                <ul
                    ref={listRef}
                    className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl text-sm"
                >
                    {filtered.length === 0 ? (
                        <li className="px-3 py-2 text-slate-400 italic">No items found</li>
                    ) : (
                        filtered.map((item, idx) => (
                            <li
                                key={item.id}
                                className={`px-3 py-1.5 cursor-pointer transition-colors ${
                                    idx === highlightIdx
                                        ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                                }`}
                                onMouseEnter={() => setHighlightIdx(idx)}
                                onClick={() => {
                                    onSelect(item.id);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                            >
                                {item.name} <span className="text-xs text-slate-400">(Stock: {item.currentStock ?? 0})</span>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

const PosImportDashboard: React.FC<Props> = () => {
    const { currentUser } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();
    const { hasPermission } = usePermissions();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Resolve the active BU id: if 'all' is selected in global context,
    // fall back to the first BU the user has access to
    const selectedBU = selectedBusinessUnit === 'all'
        ? (currentUser?.businessUnitIds?.[0] || currentUser?.businessId || '')
        : selectedBusinessUnit;
    const [activeTab, setActiveTab] = useState<Tab>('import');
    const [viewState, setViewState] = useState<ViewState>('UPLOAD');
    const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [fileHash, setFileHash] = useState<string>('');
    const [, setParsedRows] = useState<PosImportRow[]>([]);
    const [hasAmountColumn, setHasAmountColumn] = useState<boolean>(true);
    const [mappedRows, setMappedRows] = useState<PosImportMappedRow[]>([]);
    const [rawRowCount, setRawRowCount] = useState<number>(0);
    const [consolidatedCount, setConsolidatedCount] = useState<number>(0);
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
    const [searchQuery, setSearchQuery] = useState('');

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
            let ts = 0;
            if (batch.importedAt) {
                if (typeof batch.importedAt.toMillis === 'function') {
                    ts = batch.importedAt.toMillis();
                } else if ('seconds' in batch.importedAt) {
                    ts = batch.importedAt.seconds * 1000;
                }
            }
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

            const { rows, hasAmountColumn: hasAmount, rawRowCount: rawCount, consolidatedCount: consCount } = await PosImportService.parseFile(selectedFile);
            setParsedRows(rows);
            setHasAmountColumn(hasAmount);
            setRawRowCount(rawCount);
            setConsolidatedCount(consCount);

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
            const hasRecipe = item.recipe && item.recipe.length > 0;
            const newStock = hasRecipe ? null : theoStock - row.qtySold;

            // SRP from menu engineering (injected by service from menu_items.sellingPrice)
            // baseCost from menu engineering (injected by service from menu_items.calculatedCost)
            const srp = item.sellingPrice ?? 0;
            const baseCost = item.baseCost ?? 0;

            // AMOUNT = ((QTY SOLD - FOC QTY) × SRP) - DISCOUNT
            const billedQty = Math.max(0, row.qtySold - (row.qtyFoc ?? 0));
            let resolvedAmount = row.amount;
            let amountSource: 'file' | 'selling_price' = row.amountSource || 'file';
            if (!hasAmountColumn || row.amount === 0) {
                if (srp > 0) {
                    resolvedAmount = (srp * billedQty) - (row.discount || 0);
                    amountSource = 'selling_price';
                }
            } else {
                 // Ensure discount is applied to amount if not already applied
                 // Actually, PosImportService already subtracts discount. So we might need to be careful not to double count.
                 // But wait, if they change the item, we just recalculate based on existing row.amount (which was already adjusted by service)
            }

            // COST = QTY SOLD × baseCost
            const totalCost = baseCost * row.qtySold;

            // PROFIT = AMOUNT − COST
            const totalProfit = resolvedAmount - totalCost;

            return {
                ...row,
                amount: resolvedAmount,
                costs: totalCost,
                profit: totalProfit,
                matchedItemId: item.id,
                matchedItemName: item.name,
                matchStatus: 'MATCHED',
                currentStock: theoStock,
                negativeStockFlag: newStock !== null && !row.isDirectSale ? newStock < 0 : false,
                amountSource,
            };
        }));
    };

    const handleDiscountChange = (rowIndex: number, rawValue: string) => {
        const discountAmount = Math.max(0, parseFloat(rawValue) || 0);
        setMappedRows(prev => prev.map(row => {
            if (row.rowIndex !== rowIndex) return row;

            const matchedItem = row.matchedItemId
                ? inventoryItems.find(i => i.id === row.matchedItemId)
                : null;

            const srp = matchedItem?.sellingPrice ?? 0;
            const baseCost = matchedItem?.baseCost ?? 0;

            const billedQty = Math.max(0, row.qtySold - (row.qtyFoc ?? 0));
            // Recompute amount: start from base revenue (srp * billedQty) if using srp, otherwise we don't have a reliable base revenue to subtract from
            // We should probably rely on (amount + oldDiscount) - newDiscount
            const oldDiscount = row.discount || 0;
            const baseRevenue = row.amountSource === 'selling_price' && srp > 0 ? (srp * billedQty) : (row.amount + oldDiscount);
            const newAmount = Math.max(0, baseRevenue - discountAmount);

            const newCosts = baseCost > 0 ? baseCost * row.qtySold : row.costs;
            const newProfit = newAmount - newCosts;

            return {
                ...row,
                discount: discountAmount,
                amount: newAmount,
                costs: newCosts,
                profit: newProfit,
                amountSource: srp > 0 ? 'selling_price' : row.amountSource,
            };
        }));
    };

    const handleDirectSaleToggle = (rowIndex: number) => {
        setMappedRows(prev => prev.map(row => {
            if (row.rowIndex !== rowIndex) return row;
            const isDirectSale = !row.isDirectSale;
            return {
                ...row,
                isDirectSale,
                // Remove negative stock warning if it's a direct sale
                negativeStockFlag: isDirectSale ? false : row.negativeStockFlag
            };
        }));
    };

    // ================================================================
    // FOC QUANTITY CHANGE
    // ================================================================

    const handleFocChange = (rowIndex: number, rawValue: string) => {
        const focQty = Math.max(0, parseInt(rawValue, 10) || 0);
        setMappedRows(prev => prev.map(row => {
            if (row.rowIndex !== rowIndex) return row;

            const matchedItem = row.matchedItemId
                ? inventoryItems.find(i => i.id === row.matchedItemId)
                : null;

            // SRP and recipe cost injected by service from menu engineering
            const srp = matchedItem?.sellingPrice ?? 0;
            const baseCost = matchedItem?.baseCost ?? 0;

            // AMOUNT = (QTY SOLD - FOC QTY) × SRP — FOC reduces billable revenue
            const billedQty = Math.max(0, row.qtySold - focQty);
            
            let newAmount = row.amount;
            if (srp > 0) {
                newAmount = Math.max(0, (srp * billedQty) - (row.discount || 0));
            } else if (row.amountSource === 'file') {
                 // For file imports without known SRP, we can't reliably recalculate Amount when FOC changes,
                 // but we can at least maintain the existing amount. 
            }

            // COST = QTY SOLD × baseCost — all units (incl. FOC) consume raw materials
            const newCosts = baseCost > 0 ? baseCost * row.qtySold : row.costs;

            // PROFIT = AMOUNT − COST
            const newProfit = newAmount - newCosts;

            return {
                ...row,
                qtyFoc: focQty,
                amount: newAmount,
                costs: newCosts,
                profit: newProfit,
                amountSource: srp > 0 ? 'selling_price' : row.amountSource,
            };
        }));
    };

    const handleQtySoldChange = (rowIndex: number, rawValue: string) => {
        const qtySold = Math.max(0, parseInt(rawValue, 10) || 0);
        setMappedRows(prev => prev.map(row => {
            if (row.rowIndex !== rowIndex) return row;

            const matchedItem = row.matchedItemId
                ? inventoryItems.find(i => i.id === row.matchedItemId)
                : null;

            const srp = matchedItem?.sellingPrice ?? 0;
            const baseCost = matchedItem?.baseCost ?? 0;

            const billedQty = Math.max(0, qtySold - (row.qtyFoc ?? 0));
            
            let newAmount = row.amount;
            if (srp > 0) {
                newAmount = Math.max(0, (srp * billedQty) - (row.discount || 0));
            } else if (row.amountSource === 'file') {
                const prevQty = row.qtySold || 1;
                newAmount = (row.amount / prevQty) * qtySold;
            }

            const newCosts = baseCost > 0 ? baseCost * qtySold : (row.costs / (row.qtySold || 1)) * qtySold;
            const newProfit = newAmount - newCosts;

            let negativeStockFlag = false;
            if (matchedItem && !row.isDirectSale) {
                const theoStock = matchedItem.theoreticalStock ?? matchedItem.currentStock ?? 0;
                const hasRecipe = matchedItem.recipe && matchedItem.recipe.length > 0;
                const newStock = hasRecipe ? null : theoStock - qtySold;
                negativeStockFlag = newStock !== null ? newStock < 0 : false;
            }

            return {
                ...row,
                qtySold,
                amount: newAmount,
                costs: newCosts,
                profit: newProfit,
                negativeStockFlag
            };
        }));
    };

    const handleAmountChange = (rowIndex: number, rawValue: string) => {
        const amount = Math.max(0, parseFloat(rawValue) || 0);
        setMappedRows(prev => prev.map(row => {
            if (row.rowIndex !== rowIndex) return row;
            const newProfit = amount - row.costs;
            return {
                ...row,
                amount,
                profit: newProfit,
                amountSource: 'file'
            };
        }));
    };

    const handleEditBatch = async (batch: PosImportBatch) => {
        setLoading(true);
        setError(null);
        try {
            let items = inventoryItems;
            if (items.length === 0 && selectedBU) {
                const q = query(collection(db, 'inventory_items'), where('businessUnitId', '==', selectedBU), where('isActive', '==', true));
                const snap = await getDocs(q);
                items = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem & { id: string }));
                setInventoryItems(items);
            }

            const sales = await PosImportService.getSalesByBatchId(batch.id);

            const mapped: PosImportMappedRow[] = sales.map((sale, index) => {
                const matchedItem = items.find(i => i.id === sale.inventoryItemId);
                return {
                    rowIndex: index,
                    category: sale.category || 'Unknown',
                    itemName: sale.inventoryItemName,
                    qtySold: sale.qtySold,
                    qtyFoc: sale.qtyFoc ?? 0,
                    discount: sale.discount ?? 0,
                    isDirectSale: sale.isDirectSale || false,
                    amount: sale.amount,
                    costs: sale.costs,
                    profit: sale.profit,
                    matchedItemId: sale.inventoryItemId,
                    matchedItemName: sale.inventoryItemName,
                    matchStatus: 'MATCHED' as const,
                    currentStock: matchedItem ? (matchedItem.theoreticalStock ?? matchedItem.currentStock ?? 0) : 0,
                    negativeStockFlag: sale.negativeStockFlag ?? false,
                    amountSource: 'file' as const
                };
            });

            setEditingBatchId(batch.id);
            setFile({ name: batch.fileName, size: 0 } as File);
            setFileHash(batch.fileHash);
            setImportDate(batch.importDate || new Date().toISOString().split('T')[0]);
            setMappedRows(mapped);
            setRawRowCount(mapped.length);
            setConsolidatedCount(mapped.length);
            setViewState('PREVIEW');
            setActiveTab('import');
        } catch (err) {
            console.error('Failed to load batch for editing:', err);
            setError(err instanceof Error ? err.message : 'Failed to load batch details for editing.');
        } finally {
            setLoading(false);
        }
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
            if (editingBatchId) {
                await PosImportService.deleteImportBatch(editingBatchId, currentUser.id, currentUser.name);
            }

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
                editingBatchId
                    ? `POS Import Batch edited — ${mappedRows.length} row(s) for ${importDate}`
                    : `${file?.name || 'file'} imported — ${mappedRows.length} row(s) for ${importDate}`,
                { id: currentUser.id, name: currentUser.name },
                selectedBU,
                { entityId: batchId, entityType: 'POS Batch', severity: 'success' }
            );
            setEditingBatchId(null);
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
        setRawRowCount(0);
        setConsolidatedCount(0);
        setViewState('UPLOAD');
        setError(null);
        setSuccessId(null);
        setEditingBatchId(null);
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

    const filteredMappedRows = useMemo(() => {
        if (!searchQuery.trim()) return mappedRows;
        const q = searchQuery.toLowerCase();
        return mappedRows.filter(row => 
            row.itemName?.toLowerCase().includes(q) || 
            row.category?.toLowerCase().includes(q) ||
            row.matchedItemName?.toLowerCase().includes(q)
        );
    }, [mappedRows, searchQuery]);

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
                        hasPermission('pos:import:create') ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                <label className="text-sm text-slate-500 dark:text-slate-400">POS Sales Date:</label>
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
                                        <span className="inline-block px-6 py-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm font-medium cursor-pointer">
                                            Browse Files
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-xl p-12 text-center">
                                <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-500 dark:text-slate-400">You don't have permission to import POS sales.</p>
                            </div>
                        )
                    )}

                    {/* PREVIEW STATE */}
                    {viewState === 'PREVIEW' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <SummaryCard label={rawRowCount !== consolidatedCount ? `Items (${rawRowCount} → ${consolidatedCount})` : 'Total Items'} value={String(consolidatedCount)} color="slate" />
                                <SummaryCard label="Matched" value={String(matchedCount)} color="emerald" />
                                <SummaryCard label="Unmatched" value={String(unmatchedCount)} color={unmatchedCount > 0 ? 'red' : 'slate'} />
                                <SummaryCard label="Total Revenue" value={`₱${totalAmount.toLocaleString()}`} color="blue" />
                                <SummaryCard label="Total Profit" value={`₱${totalProfit.toLocaleString()}`} color="violet" />
                            </div>

                            {rawRowCount !== consolidatedCount && (
                                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 flex items-start gap-3">
                                    <Package className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-cyan-600 dark:text-cyan-300 font-medium">Smart Consolidation Applied</p>
                                        <p className="text-cyan-500 dark:text-cyan-400/80 text-sm mt-1">
                                            {rawRowCount} raw rows were consolidated into <strong>{consolidatedCount}</strong> unique items. Quantities, amounts, and costs have been summed for duplicate item names.
                                        </p>
                                    </div>
                                </div>
                            )}

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
                                        <p className="text-slate-900 dark:text-white font-medium">
                                            {editingBatchId ? `Editing Import Batch: ${file?.name}` : file?.name}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {editingBatchId ? 'Replacing existing batch' : (file ? `${(file.size / 1024).toFixed(1)} KB` : '')} • POS Sales Date: {importDate}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={resetAll} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-400 rounded-lg transition-colors text-sm">
                                    <Trash2 className="w-4 h-4" />
                                    {editingBatchId ? 'Cancel Edit' : 'Clear'}
                                </button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by item name or category..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800/60 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                                />
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
                                                <th className="text-right py-3 px-4 min-w-[90px]">
                                                    <span className="inline-flex items-center gap-1">
                                                        FOC Qty
                                                        <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 font-semibold tracking-wide">FREE</span>
                                                    </span>
                                                </th>
                                                <th className="text-right py-3 px-4 min-w-[100px]">Discount</th>
                                                <th className="text-right py-3 px-4">Amount</th>
                                                <th className="text-right py-3 px-4">Cost</th>
                                                <th className="text-right py-3 px-4">Profit</th>
                                                <th className="text-center py-3 px-4 min-w-[100px]">Direct Sale</th>
                                                <th className="text-center py-3 px-4">Status</th>
                                                <th className="text-left py-3 px-4 min-w-[200px]">Matched To</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMappedRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={12} className="py-8 text-center text-slate-500 dark:text-slate-400">
                                                        No matching items found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredMappedRows.map((row) => (
                                                    <tr key={row.rowIndex} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${row.negativeStockFlag ? 'bg-amber-500/5' : ''}`}>
                                                        <td className="py-2.5 px-4 text-slate-400 dark:text-slate-500">{row.rowIndex + 1}</td>
                                                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{row.category}</td>
                                                    <td className="py-2.5 px-4 text-slate-900 dark:text-white font-medium">{row.itemName}</td>
                                                    <td className="py-2.5 px-4 text-right">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={row.qtySold}
                                                            onChange={(e) => handleQtySoldChange(row.rowIndex, e.target.value)}
                                                            className="w-16 text-right bg-white dark:bg-slate-700/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-md px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 font-medium"
                                                        />
                                                    </td>
                                                    {/* FOC Qty input */}
                                                    <td className="py-2.5 px-2 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <input
                                                                id={`foc-qty-${row.rowIndex}`}
                                                                type="number"
                                                                min={0}
                                                                value={row.qtyFoc || ''}
                                                                placeholder="0"
                                                                onChange={(e) => handleFocChange(row.rowIndex, e.target.value)}
                                                                className="w-14 text-right bg-white dark:bg-slate-700/80 text-violet-700 dark:text-violet-300 border border-violet-400/40 rounded-md px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 placeholder-slate-400"
                                                            />
                                                            {(row.qtyFoc ?? 0) > 0 && (
                                                                <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 font-semibold whitespace-nowrap">FOC</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right">
                                                        <input
                                                            id={`discount-${row.rowIndex}`}
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            value={row.discount || ''}
                                                            placeholder="0.00"
                                                            onChange={(e) => handleDiscountChange(row.rowIndex, e.target.value)}
                                                            className="w-20 text-right bg-white dark:bg-slate-700/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-md px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder-slate-400"
                                                        />
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-slate-400">₱</span>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step="0.01"
                                                                value={row.amount}
                                                                onChange={(e) => handleAmountChange(row.rowIndex, e.target.value)}
                                                                className="w-24 text-right bg-white dark:bg-slate-700/80 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-600 rounded-md px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 font-semibold"
                                                            />
                                                            {row.amountSource === 'selling_price' && (
                                                                <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-500" title="Auto-filled from FG selling price">SP</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">₱{row.costs.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                    <td className={`py-2.5 px-4 text-right ${row.profit < 0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                                                        ₱{row.profit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                        {row.profit < 0 && <span className="ml-1 text-[10px] text-red-500 font-medium">⚠ negative</span>}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        <label className="relative inline-flex items-center cursor-pointer justify-center">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={row.isDirectSale}
                                                                onChange={() => handleDirectSaleToggle(row.rowIndex)}
                                                            />
                                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                                        </label>
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
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div>
                                                                    <span className="text-emerald-600 dark:text-emerald-300 text-sm font-medium">{row.matchedItemName}</span>
                                                                    {row.negativeStockFlag && (
                                                                        <span className="ml-2 text-xs text-amber-500 dark:text-amber-400" title="Stock will go negative">⚠️ negative</span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setMappedRows(prev => prev.map(r => {
                                                                            if (r.rowIndex !== row.rowIndex) return r;
                                                                            return {
                                                                                ...r,
                                                                                matchedItemId: null,
                                                                                matchedItemName: null,
                                                                                matchStatus: 'UNMATCHED',
                                                                                currentStock: null,
                                                                                negativeStockFlag: false,
                                                                                amountSource: 'file'
                                                                            };
                                                                        }));
                                                                    }}
                                                                    className="text-xs text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition-colors"
                                                                >
                                                                    Change
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <SearchableItemSelect
                                                                items={inventoryItems}
                                                                onSelect={(itemId) => handleManualMatch(row.rowIndex, itemId)}
                                                                placeholder="Type to search..."
                                                            />
                                                        )}
                                                    </td>
                                                </tr>
                                            )))}
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
                                    <div
                                        onClick={() => handleBatchClick(batch.id)}
                                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left cursor-pointer"
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
                                            {hasPermission('pos:import:edit') && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditBatch(batch);
                                                    }}
                                                    className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="Edit Import Batch"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                            )}
                                            {hasPermission('pos:import:delete') && (
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
                                    </div>

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
