import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Package,
    Search,
    Play,
    X,
    Check,
    AlertTriangle,
    Boxes,
    Factory,
    ShoppingBag,
    Wrench,
    Building2,
    MapPin,
    Plus,
    Upload,
    Download
} from 'lucide-react';
import type { InventoryItem, InventoryItemType, StockCountSession, CreateInventoryItemInput } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';
import { exportInventoryToCSV, importInventoryBatch, parseCSVFile, downloadSampleCSV } from '../services/inventory.data.service';
import type { ImportResult } from '../services/inventory.data.service';
import VisualCountRow from '../components/VisualCountRow';
import InventoryItemModal from '../components/InventoryItemModal';
import type { User, Business } from '../../procurement/types';
import { UI_CONSTANTS } from '../../../config/constants';

// ============================================================
// PROPS
// ============================================================

interface InventoryDashboardProps {
    currentUser: User;
    businesses: Business[];
    uomOptions: string[];
}

interface CountItemState {
    itemId: string;
    count: number;
    partialCount: number;
    unit: string;
}

// Type tab configuration
const TYPE_TABS: { key: InventoryItemType | 'ALL'; label: string; icon: React.ElementType }[] = [
    { key: 'ALL', label: 'All Items', icon: Package },
    { key: 'RAW_MATERIAL', label: 'Raw Materials', icon: Boxes },
    { key: 'PRODUCTION', label: 'Production', icon: Factory },
    { key: 'FINISHED_GOOD', label: 'Finished Goods', icon: ShoppingBag },
    { key: 'ASSET', label: 'Assets', icon: Wrench }
];

// ============================================================
// CALCULATOR POPUP
// ============================================================

const CalculatorPopup: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: number) => void;
    currentValue: number;
    itemName: string;
    unit: string;
}> = ({ isOpen, onClose, onSubmit, currentValue, itemName, unit }) => {
    const [value, setValue] = useState(currentValue.toString());

    // useEffect removed - state initialization handles it, and 'key' prop ensures reset on item change

    const handleKeyPress = (key: string) => {
        if (key === 'C') setValue('0');
        else if (key === '⌫') setValue(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        else if (key === '.' && !value.includes('.')) setValue(prev => prev + '.');
        else if (/[0-9]/.test(key)) setValue(prev => prev === '0' ? key : prev + key);
    };

    const handleSubmit = () => {
        onSubmit(parseFloat(value) || 0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div>
                        <h3 className="font-semibold text-white">{itemName}</h3>
                        <p className="text-sm text-slate-400">Enter count in {unit}s</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="bg-slate-900 rounded-xl p-4 text-right">
                        <span className="text-3xl font-bold text-white">{value}</span>
                        <span className="text-xl text-slate-400 ml-2">{unit}s</span>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 p-4 pt-0">
                    {['7', '8', '9', 'C', '4', '5', '6', '⌫', '1', '2', '3', '.', '0', '00', ''].map((key, idx) => (
                        <button
                            key={idx}
                            onClick={() => key && handleKeyPress(key)}
                            className={`h-14 rounded-xl font-semibold text-lg transition-all ${key === 'C' ? 'bg-red-500/20 text-red-400'
                                : key === '⌫' ? 'bg-amber-500/20 text-amber-400'
                                    : key === '' ? 'invisible'
                                        : 'bg-slate-700 text-white hover:bg-slate-600'
                                }`}
                        >
                            {key}
                        </button>
                    ))}
                </div>

                <div className="p-4 pt-0">
                    <button
                        onClick={handleSubmit}
                        className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center justify-center gap-2"
                    >
                        <Check size={20} />
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// REVIEW PANEL
// ============================================================

const ReviewPanel: React.FC<{
    session: StockCountSession | null;
    countStates: Map<string, CountItemState>;
    items: InventoryItem[];
    onSubmit: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
}> = ({ session, countStates, items, onSubmit, onCancel, isSubmitting }) => {
    const countedItemsCount = countStates.size;
    const totalItems = items.length;

    let totalValue = 0;
    countStates.forEach((state, itemId) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            totalValue += (state.count + state.partialCount) * item.costPerUnit;
        }
    });

    return (
        <div className="bg-slate-800/80 backdrop-blur-md rounded-xl border border-slate-700 p-6 sticky top-4">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Check size={20} className="text-cyan-400" />
                Review & Submit
            </h3>

            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Items Counted</span>
                    <span className="text-white font-medium">{countedItemsCount} / {totalItems}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
                        style={{ width: `${totalItems > 0 ? (countedItemsCount / totalItems) * 100 : 0}%` }}
                    />
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Value</span>
                    <span className="text-2xl font-bold text-white">
                        ₱{totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                </div>

                {session && (
                    <div className="text-xs text-slate-500">
                        Session started: {session.startedAt?.toDate?.()?.toLocaleString() || 'Just now'}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <button
                    onClick={onSubmit}
                    disabled={countedItemsCount === 0 || isSubmitting}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Check size={18} />
                    )}
                    Submit Stock Count
                </button>

                <button
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="w-full py-3 bg-slate-700 text-slate-300 font-medium rounded-xl hover:bg-slate-600 flex items-center justify-center gap-2"
                >
                    <X size={18} />
                    Cancel Session
                </button>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ currentUser, businesses, uomOptions }) => {
    // Business unit selection
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(
        businesses.length > 0 ? businesses[0].id : ''
    );

    // Type filter tab
    const [activeTypeTab, setActiveTypeTab] = useState<InventoryItemType | 'ALL'>('ALL');

    // Storage area filter (merged from StockTakeSession)
    const [storageAreas, setStorageAreas] = useState<string[]>([]);
    const [activeStorageArea, setActiveStorageArea] = useState<string>('ALL');

    // Data state
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [session, setSession] = useState<StockCountSession | null>(null);
    const [countStates, setCountStates] = useState<Map<string, CountItemState>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [calculatorItem, setCalculatorItem] = useState<InventoryItem | null>(null);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal & Import/Export state
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load inventory when BU or type changes
    useEffect(() => {
        const loadData = async () => {
            if (!selectedBusinessUnit) return;

            setIsLoading(true);
            try {
                // Fetch items and storage areas in parallel
                const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
                const [fetchedItems, fetchedAreas] = await Promise.all([
                    InventoryService.getInventory(selectedBusinessUnit, typeFilter),
                    InventoryService.getStorageAreas()
                ]);

                setItems(fetchedItems);
                setStorageAreas(fetchedAreas);

                // Check for open session
                const openSession = await InventoryService.getOpenSession(selectedBusinessUnit, currentUser.id);
                if (openSession) {
                    setSession(openSession);
                    const states = new Map<string, CountItemState>();
                    openSession.items.forEach(item => {
                        states.set(item.itemId, {
                            itemId: item.itemId,
                            count: item.count,
                            partialCount: item.partialCount,
                            unit: item.unit
                        });
                    });
                    setCountStates(states);
                }
            } catch (err) {
                console.error('Error loading data:', err);
                setError('Failed to load inventory');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [selectedBusinessUnit, activeTypeTab, currentUser.id]);

    // Filter items by search AND storage area
    const filteredItems = items.filter(item => {
        const matchesSearch = searchQuery === '' ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStorageArea = activeStorageArea === 'ALL' ||
            item.storageAreas.includes(activeStorageArea);
        return matchesSearch && matchesStorageArea;
    });

    // Start counting session
    const startSession = async () => {
        if (!selectedBusinessUnit) return;

        try {
            const selectedBU = businesses.find(b => b.id === selectedBusinessUnit);
            await InventoryService.startSession({
                businessUnitId: selectedBusinessUnit,
                location: selectedBU?.name || 'All Areas',
                performedBy: currentUser.id,
                performedByName: currentUser.name
            });

            const openSession = await InventoryService.getOpenSession(selectedBusinessUnit, currentUser.id);
            setSession(openSession);
        } catch (err) {
            console.error('Error starting session:', err);
            setError('Failed to start session');
        }
    };

    // Handle count change
    const handleCountChange = useCallback((itemId: string, count: number, partialCount: number, unit: string) => {
        setCountStates(prev => {
            const newStates = new Map(prev);
            newStates.set(itemId, { itemId, count, partialCount, unit });
            return newStates;
        });
    }, []);

    // Submit session
    const submitSession = async () => {
        if (!session) return;

        setIsSubmitting(true);
        try {
            for (const [itemId, state] of countStates) {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    await InventoryService.saveCountItem({
                        sessionId: session.id,
                        itemId,
                        itemName: item.name,
                        count: state.count,
                        unit: state.unit,
                        partialCount: state.partialCount
                    });
                }
            }

            await InventoryService.submitSession(session.id);
            setSession(null);
            setCountStates(new Map());
            alert('Stock count submitted successfully!');
        } catch (err) {
            console.error('Error submitting:', err);
            setError('Failed to submit stock count');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cancel session
    const cancelSession = async () => {
        if (!session) return;
        if (confirm('Cancel this session? All counts will be lost.')) {
            await InventoryService.cancelSession(session.id);
            setSession(null);
            setCountStates(new Map());
        }
    };

    // Calculator handlers
    const openCalculator = (item: InventoryItem) => setCalculatorItem(item);

    const handleCalculatorSubmit = (value: number) => {
        if (calculatorItem) {
            const state = countStates.get(calculatorItem.id);
            handleCountChange(
                calculatorItem.id,
                value,
                state?.partialCount ?? 0,
                state?.unit ?? calculatorItem.units.countUnit
            );
        }
        setCalculatorItem(null);
    };

    // ============================================================
    // ADD/EDIT/IMPORT/EXPORT HANDLERS
    // ============================================================

    // Open modal for adding new item
    const handleAddItem = () => {
        setEditingItem(null);
        setShowItemModal(true);
    };

    // Save item (create or update)
    const handleSaveItem = async (itemData: CreateInventoryItemInput) => {
        if (editingItem) {
            await InventoryService.updateInventoryItem(editingItem.id, itemData);
        } else {
            await InventoryService.createInventoryItem(itemData);
        }
        // Reload items
        const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
        const refreshedItems = await InventoryService.getInventory(selectedBusinessUnit, typeFilter);
        setItems(refreshedItems);
        setShowItemModal(false);
    };

    // Export inventory to CSV
    const handleExport = async () => {
        try {
            await exportInventoryToCSV(selectedBusinessUnit, currentBusiness?.name);
        } catch (err) {
            setError('Failed to export inventory');
            setTimeout(() => setError(null), UI_CONSTANTS.TOAST_DURATION_SHORT);
        }
    };

    // Handle file selection for import
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedBusinessUnit) return;

        setIsImporting(true);
        setImportResult(null);

        try {
            const csvData = await parseCSVFile(file);
            const result = await importInventoryBatch(csvData, selectedBusinessUnit);
            setImportResult(result);

            // Reload items after import
            const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
            const refreshedItems = await InventoryService.getInventory(selectedBusinessUnit, typeFilter);
            setItems(refreshedItems);
        } catch (err) {
            setImportResult({
                success: false,
                imported: 0,
                skipped: 0,
                failed: 0,
                errors: [`Import failed: ${err}`]
            });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Get current business name
    const currentBusiness = businesses.find(b => b.id === selectedBusinessUnit);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading inventory...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <Package className="text-purple-400" />
                        Inventory Dashboard
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Multi-business inventory management
                    </p>
                </div>

                {/* Business Unit Selector */}
                <div className="flex items-center gap-3">
                    <Building2 size={20} className="text-slate-400" />
                    <select
                        value={selectedBusinessUnit}
                        onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                        className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    >
                        {businesses.map(bu => (
                            <option key={bu.id} value={bu.id}>
                                {bu.name}
                            </option>
                        ))}
                    </select>

                    {!session ? (
                        <button
                            onClick={startSession}
                            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center gap-2"
                        >
                            <Play size={18} />
                            Start Session
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-green-400 font-medium">Active</span>
                        </div>
                    )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAddItem}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <Plus size={16} />
                        Add Item
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={items.length === 0}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <Download size={16} />
                        Export
                    </button>
                    <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer">
                        <Upload size={16} />
                        {isImporting ? 'Importing...' : 'Import Items'}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            disabled={isImporting}
                            className="hidden"
                        />
                    </label>
                    <button
                        onClick={downloadSampleCSV}
                        className="px-3 py-2 bg-purple-800 hover:bg-purple-700 text-purple-200 rounded-lg text-sm transition-colors flex items-center gap-1"
                        title="Download Inventory Items Template"
                    >
                        <Download size={14} />
                        <span className="text-xs">Items</span>
                    </button>
                </div>
            </div>

            {/* Type Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {TYPE_TABS.map(tab => {
                    const TabIcon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTypeTab(tab.key)}
                            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-2 ${activeTypeTab === tab.key
                                ? 'bg-purple-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            <TabIcon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Import Result Alert */}
            {importResult && (
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${importResult.success ? 'bg-green-900/30 border-green-700/50' : 'bg-amber-900/30 border-amber-700/50'}`}>
                    {importResult.success ? (
                        <Check size={20} className="text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                        <AlertTriangle size={20} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                        <p className={importResult.success ? 'text-green-300' : 'text-amber-300'}>
                            Imported: {importResult.imported} | Skipped: {importResult.skipped} | Failed: {importResult.failed}
                        </p>
                        {importResult.errors.length > 0 && (
                            <ul className="text-xs text-slate-400 mt-2 max-h-24 overflow-auto">
                                {importResult.errors.slice(0, 5).map((err, i) => (
                                    <li key={i}>• {err}</li>
                                ))}
                                {importResult.errors.length > 5 && (
                                    <li className="text-slate-500">...and {importResult.errors.length - 5} more</li>
                                )}
                            </ul>
                        )}
                    </div>
                    <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-white">×</button>
                </div>
            )}

            {/* Storage Area Tabs (merged from StockTakeSession) */}
            {storageAreas.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <MapPin size={16} className="text-slate-400 flex-shrink-0" />
                    <button
                        onClick={() => setActiveStorageArea('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeStorageArea === 'ALL'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        All Areas
                    </button>
                    {storageAreas.map(area => (
                        <button
                            key={area}
                            onClick={() => setActiveStorageArea(area)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeStorageArea === area
                                ? 'bg-cyan-500 text-white'
                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {area}
                        </button>
                    ))}
                </div>
            )}

            {session ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Item List */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Search */}
                        <div className="relative">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Items */}
                        <div className="space-y-4">
                            {filteredItems.length === 0 ? (
                                <div className="text-center py-12">
                                    <Package size={48} className="text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-400">No items found for {currentBusiness?.name || 'this business'}</p>
                                </div>
                            ) : (
                                filteredItems.map(item => {
                                    const state = countStates.get(item.id);
                                    return (
                                        <VisualCountRow
                                            key={item.id}
                                            item={item}
                                            count={state?.count ?? 0}
                                            partialCount={state?.partialCount ?? 0}
                                            onCountChange={(count, partial) =>
                                                handleCountChange(item.id, count, partial, item.units.countUnit)
                                            }
                                            onCalculatorOpen={() => openCalculator(item)}
                                        />
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Review Panel */}
                    <div className="lg:col-span-1">
                        <ReviewPanel
                            session={session}
                            countStates={countStates}
                            items={items}
                            onSubmit={submitSession}
                            onCancel={cancelSession}
                            isSubmitting={isSubmitting}
                        />
                    </div>
                </div>
            ) : (
                /* No Active Session */
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6">
                        <Package size={36} className="text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Ready to Count?</h2>
                    <p className="text-slate-400 max-w-md mx-auto mb-6">
                        Start a counting session for <strong>{currentBusiness?.name || 'selected business'}</strong>.
                        Items are filtered by type tabs above.
                    </p>
                    <button
                        onClick={startSession}
                        className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center gap-3 mx-auto"
                    >
                        <Play size={20} />
                        Start Counting Session
                    </button>
                </div>
            )}

            {/* Calculator Modal */}
            {calculatorItem && (
                <CalculatorPopup
                    key={calculatorItem.id}
                    isOpen={true}
                    onClose={() => setCalculatorItem(null)}
                    onSubmit={handleCalculatorSubmit}
                    currentValue={countStates.get(calculatorItem.id)?.count ?? 0}
                    itemName={calculatorItem.name}
                    unit={calculatorItem.units.countUnit}
                />
            )}

            {/* Add/Edit Item Modal */}
            <InventoryItemModal
                isOpen={showItemModal}
                onClose={() => setShowItemModal(false)}
                onSave={handleSaveItem}
                item={editingItem}
                businessUnitId={selectedBusinessUnit}
                storageAreas={storageAreas}
                uomOptions={uomOptions}
            />
        </div>
    );
};

export default InventoryDashboard;
