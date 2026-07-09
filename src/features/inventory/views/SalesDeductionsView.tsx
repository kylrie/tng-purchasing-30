import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { History, Search, Calendar, ChevronDown, Package, FileSpreadsheet, Eye, Loader2 } from 'lucide-react';
import { PosImportService } from '../../pos/services/pos-import.service';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { PosImportBatch, PosImportMappedRow, PosSaleRecord, SimulatedDeduction } from '../../pos/types/pos-import.types';
import type { InventoryItem } from '../types/InventoryItem';
import { PosImportPreviewModal } from '../../pos/components/PosImportPreviewModal';

type DatePeriod = 'today' | 'week' | 'month' | 'custom';

export const SalesDeductionsView: React.FC = () => {
    const { currentUser } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();
    
    // Resolve the active BU id
    const selectedBU = selectedBusinessUnit === 'all'
        ? (currentUser?.businessUnitIds?.[0] || currentUser?.businessId || '')
        : selectedBusinessUnit;

    const [importHistory, setImportHistory] = useState<PosImportBatch[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Date filter state
    const [datePeriod, setDatePeriod] = useState<DatePeriod>('month');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');

    // Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [simulatedDeductions, setSimulatedDeductions] = useState<SimulatedDeduction[]>([]);
    const [isSimulating, setIsSimulating] = useState(false);

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
            setLoading(true);
            PosImportService.getImportHistory(selectedBU)
                .then(setImportHistory)
                .catch(console.error)
                .finally(() => setLoading(false));
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

    // -- Fetch sales and resimulate BOM explosion for a past batch --
    const handleViewDeductions = async (batchId: string) => {
        setIsSimulating(true);
        setIsPreviewOpen(true);
        setSimulatedDeductions([]);

        try {
            // 1. Fetch sales for this batch
            const sales = await PosImportService.getSalesByBatchId(batchId);
            
            // 2. Fetch inventory items to re-simulate the BOM explosion based on current recipes
            const itemsQuery = query(
                collection(db, 'inventory_items'),
                where('businessUnitId', '==', selectedBU),
                where('isActive', '==', true)
            );
            const itemsSnap = await getDocs(itemsQuery);
            const itemsMap = new Map<string, InventoryItem & { id: string }>();
            itemsSnap.forEach(d => {
                itemsMap.set(d.id, { id: d.id, ...d.data() } as InventoryItem & { id: string });
            });

            // 3. Convert sales to fake mapped rows
            const fakeMappedRows: PosImportMappedRow[] = sales.map((sale, i) => ({
                rowIndex: i,
                matchedItemId: sale.inventoryItemId,
                matchedItemName: sale.inventoryItemName,
                matchStatus: 'MATCHED',
                currentStock: 0,
                negativeStockFlag: false,
                category: sale.category,
                itemName: sale.inventoryItemName,
                qtySold: sale.qtySold,
                qtyFoc: sale.qtyFoc,
                discount: sale.discount,
                isDirectSale: sale.isDirectSale,
                amount: sale.amount,
                costs: sale.costs,
                profit: sale.profit
            }));

            // 4. Simulate POS import to get the theoretical deduction tree
            const deductions = await PosImportService.simulatePosImport(fakeMappedRows, itemsMap);
            setSimulatedDeductions(deductions);

        } catch (error) {
            console.error('Failed to view deductions:', error);
            alert('Failed to load deductions for this batch.');
            setIsPreviewOpen(false);
        } finally {
            setIsSimulating(false);
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        if (typeof date === 'string') return new Date(date).toLocaleDateString();
        if (typeof date.toDate === 'function') return date.toDate().toLocaleDateString();
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
        return '-';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <History className="w-8 h-8 text-blue-500" />
                        Sales Deductions History
                    </h1>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                        View how POS and Event sales uploads exploded into inventory deductions.
                    </p>
                </div>
            </div>

            {/* Date Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                        {(['today', 'week', 'month', 'custom'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setDatePeriod(p)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                    datePeriod === p
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                }`}
                            >
                                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom Range'}
                            </button>
                        ))}
                    </div>

                    {datePeriod === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                            />
                            <span className="text-slate-400">to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                        <p>Loading sales uploads...</p>
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No sales uploads found</h3>
                        <p className="mt-1">No POS or Event sales were uploaded in this period.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-6 py-4">Import Date</th>
                                    <th className="px-6 py-4">File Name</th>
                                    <th className="px-6 py-4 text-center">Items Sold</th>
                                    <th className="px-6 py-4">Imported By</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredHistory.map((batch) => (
                                    <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {formatDate(batch.importedAt)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{batch.fileName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                                                <Package className="w-3.5 h-3.5" />
                                                {batch.matchedRows} items
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-600 dark:text-slate-400">{batch.importedByName || 'System'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleViewDeductions(batch.id)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors"
                                            >
                                                <Eye className="w-4 h-4" />
                                                View BOM Tree
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isPreviewOpen && (
                <PosImportPreviewModal
                    simulatedDeductions={simulatedDeductions}
                    onConfirm={() => setIsPreviewOpen(false)}
                    onCancel={() => setIsPreviewOpen(false)}
                    isSubmitting={isSimulating}
                    readOnly={true}
                />
            )}
        </div>
    );
};
