import React, { useState, useEffect, useCallback } from 'react';
import {
    Trash2,
    AlertCircle,
    Loader2,
    Building2,
    CheckCircle,
    Search,
    Package,
    Filter,
    RefreshCw,
    ChevronDown,
    AlertTriangle,
    ClipboardList,
    History
} from 'lucide-react';
import type { InventoryItem, WastageRecord, WastageReason, RecordWastageInput } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';
import { WastageService, WASTAGE_REASONS } from '../services/wastage.service';
import type { Business, User } from '../../procurement/types';

// ============================================================
// TYPES
// ============================================================

interface WastageViewProps {
    businesses: Business[];
    currentUser?: User | null;
}

type TabKey = 'record' | 'log';

// ============================================================
// COMPONENT
// ============================================================

const WastageView: React.FC<WastageViewProps> = ({ businesses, currentUser }) => {
    // ---- State ----
    const [activeTab, setActiveTab] = useState<TabKey>('record');
    const [selectedBU, setSelectedBU] = useState<string>('');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Record Form
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('');
    const [reason, setReason] = useState<WastageReason>('Spillage');
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [itemSearch, setItemSearch] = useState('');

    // Log
    const [records, setRecords] = useState<WastageRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [logSearch, setLogSearch] = useState('');
    const [logReasonFilter, setLogReasonFilter] = useState<WastageReason | 'ALL'>('ALL');

    // ---- Derived ----
    const selectedItem = items.find(i => i.id === selectedItemId) ?? null;

    // Only RAW_MATERIAL and PRODUCTION
    const eligibleItems = items.filter(
        i => (i.type === 'RAW_MATERIAL' || i.type === 'PRODUCTION') && i.isActive !== false
    );

    const filteredEligibleItems = eligibleItems.filter(
        i => i.name.toLowerCase().includes(itemSearch.toLowerCase())
    );

    const filteredRecords = records.filter(r => {
        const matchesSearch = !logSearch || r.itemName.toLowerCase().includes(logSearch.toLowerCase());
        const matchesReason = logReasonFilter === 'ALL' || r.reason === logReasonFilter;
        return matchesSearch && matchesReason;
    });

    // ---- BU Resolution ----
    useEffect(() => {
        if (!selectedBU && currentUser) {
            const userBU = currentUser.businessId || (currentUser.businessUnitIds && currentUser.businessUnitIds[0]);
            if (userBU) setSelectedBU(userBU);
        }
    }, [currentUser, selectedBU]);

    // ---- Load items when BU changes ----
    const loadItems = useCallback(async () => {
        if (!selectedBU) return;
        setLoadingItems(true);
        try {
            const data = await InventoryService.getInventory(selectedBU);
            setItems(data);
        } catch (err) {
            console.error('[WastageView] Error loading items:', err);
        } finally {
            setLoadingItems(false);
        }
    }, [selectedBU]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    // ---- Load wastage records when tab=log or BU changes ----
    const loadRecords = useCallback(async () => {
        if (!selectedBU) return;
        setLoadingRecords(true);
        try {
            const data = await WastageService.getWastageRecords(selectedBU);
            setRecords(data);
        } catch (err) {
            console.error('[WastageView] Error loading records:', err);
        } finally {
            setLoadingRecords(false);
        }
    }, [selectedBU]);

    useEffect(() => {
        if (activeTab === 'log') {
            loadRecords();
        }
    }, [activeTab, loadRecords]);

    // ---- Submit wastage ----
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || !selectedBU || !currentUser) return;

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            setSubmitResult({ type: 'error', message: 'Please enter a valid quantity greater than 0.' });
            return;
        }

        if (qty > selectedItem.currentStock) {
            setSubmitResult({
                type: 'error',
                message: `Cannot waste ${qty} ${selectedItem.units.recipeUnit}(s). Current stock is only ${selectedItem.currentStock}.`
            });
            return;
        }

        setSubmitting(true);
        setSubmitResult(null);

        try {
            const input: RecordWastageInput = {
                businessUnitId: selectedBU,
                itemId: selectedItem.id,
                quantity: qty,
                reason,
                notes: notes.trim() || undefined,
                performedBy: { id: currentUser.id, name: currentUser.name }
            };

            await WastageService.recordWastage(input);

            setSubmitResult({
                type: 'success',
                message: `Recorded ${qty} ${selectedItem.units.recipeUnit}(s) of "${selectedItem.name}" as ${reason} wastage.`
            });

            // Reset form
            setSelectedItemId('');
            setQuantity('');
            setReason('Spillage');
            setNotes('');
            setItemSearch('');

            // Refresh items to get updated stock
            await loadItems();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to record wastage.';
            setSubmitResult({ type: 'error', message });
        } finally {
            setSubmitting(false);
        }
    };

    // ---- Format timestamp ----
    const formatTimestamp = (ts: { toDate?: () => Date } | string | number | null | undefined): string => {
        if (!ts) return '—';
        let d: Date;
        if (typeof ts === 'object' && typeof ts.toDate === 'function') {
            d = ts.toDate();
        } else {
            d = new Date(ts as string | number);
        }
        return d.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatCurrency = (val: number) =>
        `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ---- Totals for log ----
    const totalWasteCost = filteredRecords.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalWasteQty = filteredRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);

    // ---- BU Name ----
    const buName = businesses.find(b => b.id === selectedBU)?.name || selectedBU;

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Trash2 className="w-7 h-7 text-rose-400" />
                        Wastage Management
                    </h1>
                    <p className="text-slate-400 mt-1">Record and track material wastage across inventory</p>
                </div>

                {/* BU Selector */}
                <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <select
                        value={selectedBU}
                        onChange={e => setSelectedBU(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    >
                        <option value="">Select Business Unit</option>
                        {businesses.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                <button
                    onClick={() => setActiveTab('record')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'record'
                            ? 'bg-rose-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Record Wastage
                </button>
                <button
                    onClick={() => setActiveTab('log')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'log'
                            ? 'bg-rose-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                    <History className="w-4 h-4" />
                    Wastage Log
                </button>
            </div>

            {!selectedBU ? (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
                    <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">Please select a Business Unit to continue.</p>
                </div>
            ) : activeTab === 'record' ? (
                /* ============ RECORD TAB ============ */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-5">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-rose-400" />
                                Record New Wastage
                            </h2>

                            {/* Result Banner */}
                            {submitResult && (
                                <div className={`flex items-start gap-3 p-4 rounded-lg border ${
                                    submitResult.type === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                                }`}>
                                    {submitResult.type === 'success' ? (
                                        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    )}
                                    <p className="text-sm">{submitResult.message}</p>
                                </div>
                            )}

                            {/* Item Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Inventory Item <span className="text-rose-400">*</span>
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search items…"
                                        value={selectedItem ? selectedItem.name : itemSearch}
                                        onChange={e => {
                                            setItemSearch(e.target.value);
                                            setSelectedItemId('');
                                        }}
                                        onFocus={() => {
                                            if (selectedItem) {
                                                setItemSearch(selectedItem.name);
                                                setSelectedItemId('');
                                            }
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                    />
                                </div>

                                {/* Dropdown */}
                                {!selectedItemId && itemSearch && (
                                    <div className="mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg">
                                        {loadingItems ? (
                                            <div className="p-3 text-center text-slate-500 text-sm">
                                                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…
                                            </div>
                                        ) : filteredEligibleItems.length === 0 ? (
                                            <div className="p-3 text-center text-slate-500 text-sm">No eligible items found.</div>
                                        ) : (
                                            filteredEligibleItems.map(item => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedItemId(item.id);
                                                        setItemSearch('');
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between text-sm"
                                                >
                                                    <div>
                                                        <span className="text-white">{item.name}</span>
                                                        <span className="text-slate-500 ml-2 text-xs">({item.type})</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-slate-400 text-xs">{item.currentStock} {item.units.recipeUnit}</span>
                                                        <span className="text-cyan-500 text-[10px]">
                                                            = {((item.currentStock / (item.units.conversion > 0 ? item.units.conversion : 1)).toFixed(2).replace(/\.00$/, ''))} {item.units.buyUnit}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Quantity + Reason Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                        Quantity <span className="text-rose-400">*</span>
                                        {selectedItem && (
                                            <span className="text-slate-500 font-normal ml-1">
                                                ({selectedItem.units.recipeUnit})
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        placeholder="e.g. 2.5"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                        required
                                    />
                                    {selectedItem && (
                                        <div className="flex flex-col mt-1">
                                            <p className="text-xs text-slate-500">
                                                Available: {selectedItem.currentStock} {selectedItem.units.recipeUnit}
                                            </p>
                                            <p className="text-[10px] text-cyan-500">
                                                = {((selectedItem.currentStock / (selectedItem.units.conversion > 0 ? selectedItem.units.conversion : 1)).toFixed(2).replace(/\.00$/, ''))} {selectedItem.units.buyUnit}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                        Reason <span className="text-rose-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={reason}
                                            onChange={e => setReason(e.target.value as WastageReason)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 appearance-none"
                                        >
                                            {WASTAGE_REASONS.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes (optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Additional details about the wastage…"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={submitting || !selectedItemId || !quantity}
                                className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
                                ) : (
                                    <><Trash2 className="w-4 h-4" /> Record Wastage</>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Preview Card */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4 sticky top-4">
                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Preview</h3>

                            {selectedItem ? (
                                <>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-500">Item</p>
                                            <p className="text-white font-medium">{selectedItem.name}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs text-slate-500">Type</p>
                                                <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                                                    selectedItem.type === 'RAW_MATERIAL'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                    {selectedItem.type.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Current Stock</p>
                                                <div className="flex flex-col">
                                                    <p className="text-white font-medium">
                                                        {selectedItem.currentStock} <span className="text-slate-400 text-xs">{selectedItem.units.recipeUnit}</span>
                                                    </p>
                                                    <div className="text-xs font-medium text-slate-400">
                                                        = <span className="text-cyan-400">{((selectedItem.currentStock / (selectedItem.units.conversion > 0 ? selectedItem.units.conversion : 1)).toFixed(2).replace(/\.00$/, ''))} {selectedItem.units.buyUnit}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-xs text-slate-500">Unit Cost</p>
                                                <p className="text-white font-medium">
                                                    {formatCurrency(selectedItem.baseCost ?? selectedItem.costPerUnit ?? 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Waste Cost</p>
                                                <p className="text-rose-400 font-bold">
                                                    {quantity && !isNaN(parseFloat(quantity))
                                                        ? formatCurrency(parseFloat(quantity) * (selectedItem.baseCost ?? selectedItem.costPerUnit ?? 0))
                                                        : '—'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Stock After */}
                                        {quantity && !isNaN(parseFloat(quantity)) && (
                                            <div className="pt-3 border-t border-slate-700">
                                                <p className="text-xs text-slate-500">Stock After Wastage</p>
                                                <p className={`font-bold ${
                                                    selectedItem.currentStock - parseFloat(quantity) < selectedItem.parLevel
                                                        ? 'text-amber-400' : 'text-emerald-400'
                                                }`}>
                                                    {(selectedItem.currentStock - parseFloat(quantity)).toFixed(2)} {selectedItem.units.recipeUnit}
                                                </p>
                                                {selectedItem.currentStock - parseFloat(quantity) < selectedItem.parLevel && (
                                                    <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                                                        <AlertTriangle className="w-3 h-3" /> Below par level ({selectedItem.units.conversion > 0 ? (selectedItem.parLevel / selectedItem.units.conversion) : selectedItem.parLevel} {selectedItem.units.buyUnit})
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">Select an item to see preview</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ============ LOG TAB ============ */
                <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Records</p>
                            <p className="text-2xl font-bold text-white mt-1">{filteredRecords.length}</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Wasted Qty</p>
                            <p className="text-2xl font-bold text-amber-400 mt-1">{totalWasteQty.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Waste Cost</p>
                            <p className="text-2xl font-bold text-rose-400 mt-1">{formatCurrency(totalWasteCost)}</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search by item name…"
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <select
                                value={logReasonFilter}
                                onChange={e => setLogReasonFilter(e.target.value as WastageReason | 'ALL')}
                                className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-8 py-2 text-white text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 appearance-none"
                            >
                                <option value="ALL">All Reasons</option>
                                {WASTAGE_REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                        <button
                            onClick={loadRecords}
                            disabled={loadingRecords}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingRecords ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                        {loadingRecords ? (
                            <div className="p-12 text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-rose-400 mx-auto mb-3" />
                                <p className="text-slate-400 text-sm">Loading wastage records…</p>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="p-12 text-center">
                                <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 text-sm">No wastage records found for {buName}.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700 bg-slate-800/80">
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Item</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">Qty Wasted</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Reason</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">Cost</th>
                                            <th className="text-right px-4 py-3 text-slate-400 font-medium">Balance After</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">By</th>
                                            <th className="text-left px-4 py-3 text-slate-400 font-medium">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {filteredRecords.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">
                                                    {formatTimestamp(r.createdAt)}
                                                </td>
                                                <td className="px-4 py-3 text-white font-medium">{r.itemName}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                                                        r.itemType === 'RAW_MATERIAL'
                                                            ? 'bg-blue-500/20 text-blue-400'
                                                            : 'bg-purple-500/20 text-purple-400'
                                                    }`}>
                                                        {r.itemType.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-rose-400 font-medium whitespace-nowrap">
                                                    -{r.quantity} {r.unit}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400 font-medium">
                                                        {r.reason}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-rose-400 font-medium whitespace-nowrap">
                                                    {formatCurrency(r.totalCost)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-300 whitespace-nowrap">
                                                    {r.balanceAfter?.toFixed(2) ?? '—'} {r.unit}
                                                </td>
                                                <td className="px-4 py-3 text-slate-300 text-xs">{r.performedByName}</td>
                                                <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                                                    {r.notes || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WastageView;
