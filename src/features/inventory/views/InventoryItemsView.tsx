import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Package,
    Search,
    Boxes,
    Factory,
    ShoppingBag,
    Wrench,
    AlertTriangle,
    Edit,
    Trash2,
    Upload,
    Download,
    FileSpreadsheet,
    CheckCircle,
    X,
    Square,
    CheckSquare,
    Layers,
    Sparkles,
    Loader2,
    Plus,
    Wine,
    ChefHat,
    Store,
    LayoutGrid,
    Briefcase
} from 'lucide-react';
import type { InventoryItem, InventoryItemType, CreateInventoryItemInput, ServiceType, InventoryDepartment } from '../types/InventoryItem';
import { SERVICE_TYPES, DEPARTMENTS } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';
import { calculateSellableQuantity } from '../utils/sellable-quantity';
import InventoryItemModal from '../components/InventoryItemModal';
import ProduceBatchModal from '../components/ProduceBatchModal';
import type { Business } from '../../procurement/types';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { GeminiVisionService } from '../../../shared/services/gemini-vision.service';
import { usePermissions } from '../../../hooks/usePermissions';

// ============================================================
// PROPS
// ============================================================

interface InventoryItemsViewProps {
    businesses: Business[];
    uomOptions: string[];
}

// Type tab configuration
const TYPE_TABS: { key: InventoryItemType | 'ALL'; label: string; icon: React.ElementType }[] = [
    { key: 'ALL', label: 'All Items', icon: Package },
    { key: 'RAW_MATERIAL', label: 'Raw Materials', icon: Boxes },
    { key: 'PRODUCTION', label: 'Production', icon: Factory },
    { key: 'FINISHED_GOOD', label: 'Finished Goods', icon: ShoppingBag },
    { key: 'ASSET', label: 'Assets', icon: Wrench }
];

// Department tab configuration
const DEPARTMENT_TABS: { key: InventoryDepartment | 'ALL'; label: string; icon: React.ElementType }[] = [
    { key: 'ALL', label: 'All Departments', icon: LayoutGrid },
    { key: 'Bar', label: 'Bar', icon: Wine },
    { key: 'Kitchen', label: 'Kitchen', icon: ChefHat },
    { key: 'Retail', label: 'Retail', icon: Store },
    { key: 'Office', label: 'Office', icon: Briefcase }
];

// ============================================================
// FUZZY MATCHING UTILITY
// ============================================================

function fuzzyMatch(search: string, target: string): boolean {
    const s = search.toLowerCase().replace(/\s+/g, '').trim();
    const t = target.toLowerCase().replace(/\s+/g, '').trim();

    // Exact match (ignoring spaces and case)
    if (s === t) return true;

    // Contains match
    if (t.includes(s) || s.includes(t)) return true;

    // Levenshtein distance for short strings (max 2 edits for strings < 10 chars)
    if (s.length < 10 && t.length < 10) {
        const distance = levenshteinDistance(s, t);
        const maxDistance = Math.min(2, Math.floor(Math.max(s.length, t.length) * 0.3));
        if (distance <= maxDistance) return true;
    }

    return false;
}

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// ============================================================
// BALANCE IMPORT TYPES
// ============================================================

interface BalanceImportRow {
    name: string;
    sku?: string;
    quantity: number;
    matched: boolean;
    itemId?: string;
    matchedBy?: 'sku' | 'name' | 'fuzzy';
}

interface BalanceImportResult {
    rows: BalanceImportRow[];
    successCount: number;
    failCount: number;
}

// ============================================================
// COMPONENT
// ============================================================

const InventoryItemsView: React.FC<InventoryItemsViewProps> = ({ businesses, uomOptions }) => {
    // Permission guards
    const { hasPermission } = usePermissions();
    const canCreate = hasPermission('inventory:item:create');
    const canEdit   = hasPermission('inventory:item:edit');
    const canDelete = hasPermission('inventory:item:delete');

    // State
    const { selectedBusinessUnit } = useBusinessUnit();
    const [activeTypeTab, setActiveTypeTab] = useState<InventoryItemType | 'ALL'>('ALL');
    const [activeDepartmentTab, setActiveDepartmentTab] = useState<InventoryDepartment | 'ALL'>('ALL');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [storageAreas, setStorageAreas] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | 'ALL'>('ALL');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    // Import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<BalanceImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inline editing state
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editingStockValue, setEditingStockValue] = useState<string>('');
    const stockInputRef = useRef<HTMLInputElement>(null);

    // Bulk selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkValue, setBulkValue] = useState<string>('0');

    // All items (unfiltered) for sellable quantity calculation
    const [allItems, setAllItems] = useState<InventoryItem[]>([]);

    // Produce Batch modal state
    const [producingItem, setProducingItem] = useState<InventoryItem | null>(null);

    // Auto-organize state
    const [isAutoOrganizing, setIsAutoOrganizing] = useState(false);


    // Load inventory when BU or type changes
    useEffect(() => {
        const loadData = async () => {
            if (!selectedBusinessUnit) return;

            setIsLoading(true);
            setError(null);
            try {
                const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
                const [fetchedItems, fetchedAllItems, fetchedAreas] = await Promise.all([
                    InventoryService.getInventory(selectedBusinessUnit, typeFilter),
                    InventoryService.getInventory(selectedBusinessUnit),  // ALL items for sellable calc
                    InventoryService.getStorageAreas()
                ]);
                setItems(fetchedItems);
                setAllItems(fetchedAllItems);
                setStorageAreas(fetchedAreas);
                setSelectedItems(new Set()); // Clear selection on reload
            } catch (err) {
                console.error('Error loading inventory:', err);
                setError('Failed to load inventory');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [selectedBusinessUnit, activeTypeTab]);

    // Build allItemsMap for sellable quantity calculations
    const allItemsMap = useMemo(() => {
        const map = new Map<string, InventoryItem>();
        allItems.forEach(item => map.set(item.id, item));
        return map;
    }, [allItems]);

    // Focus input when editing starts
    useEffect(() => {
        if (editingStockId && stockInputRef.current) {
            stockInputRef.current.focus();
            stockInputRef.current.select();
        }
    }, [editingStockId]);

    // Filter items by search
    const filteredItems = items.filter(item => {
        const matchesSearch = searchQuery === '' ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesServiceType = serviceTypeFilter === 'ALL' ||
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item as any).serviceType === serviceTypeFilter;
        const matchesDepartment = activeDepartmentTab === 'ALL' ||
            (item.department || 'Unassigned') === activeDepartmentTab;
        return matchesSearch && matchesServiceType && matchesDepartment;
    });

    // Toggle item selection
    const toggleSelect = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    // Select/deselect all filtered items
    const toggleSelectAll = () => {
        if (selectedItems.size === filteredItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredItems.map(i => i.id)));
        }
    };

    // Handle edit
    const handleEdit = (item: InventoryItem) => {
        setEditingItem(item);
        setShowItemModal(true);
    };

    // Handle delete (soft delete)
    const handleDelete = async (item: InventoryItem) => {
        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
            try {
                await InventoryService.updateInventoryItem(item.id, { isActive: false });
                setItems(prev => prev.filter(i => i.id !== item.id));
            } catch (err) {
                console.error('Error deleting item:', err);
                setError('Failed to delete item');
            }
        }
    };

    // Handle save
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
        setEditingItem(null);
    };

    // ============================================================
    // AUTO-ORGANIZE ALL ITEMS (Category & Department)
    // ============================================================
    const handleAutoOrganizeAll = async () => {
        const itemsToUpdate = allItems;
        
        if (itemsToUpdate.length === 0) {
            alert("No items found to organize.");
            return;
        }

        if (!confirm(`This will ask the AI to verify and assign Categories and Departments to ALL ${itemsToUpdate.length} item(s) in this Business Unit. This may take a moment. Proceed?`)) {
            return;
        }

        setIsAutoOrganizing(true);
        try {
            // Batch into chunks of 30 to avoid prompt limits
            const CHUNK_SIZE = 30;
            let successCount = 0;

            for (let i = 0; i < itemsToUpdate.length; i += CHUNK_SIZE) {
                const chunk = itemsToUpdate.slice(i, i + CHUNK_SIZE);
                const itemsToOrganize = chunk.map(item => ({ name: item.name, type: item.type }));
                
                const results = await GeminiVisionService.organizeItems(itemsToOrganize);
                
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const batchUpdates: { id: string; data: any }[] = [];
                
                for (const item of chunk) {
                    const result = results[item.name];
                    if (result) {
                        const { category: newCategory, department: newDepartment } = result;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const updates: any = {};
                        let changed = false;

                        if (newCategory && newCategory !== item.category) {
                            updates.category = newCategory;
                            changed = true;
                        }
                        if (newDepartment && DEPARTMENTS.includes(newDepartment as InventoryDepartment) && newDepartment !== item.department) {
                            updates.department = newDepartment;
                            changed = true;
                        }

                        if (changed) {
                            batchUpdates.push({ id: item.id, data: updates });
                        }
                    }
                }

                if (batchUpdates.length > 0) {
                    await InventoryService.batchUpdateInventoryItems(batchUpdates);
                    successCount += batchUpdates.length;
                }
            }

            // Reload inventory
            const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
            const refreshedItems = await InventoryService.getInventory(selectedBusinessUnit, typeFilter);
            const refreshedAllItems = await InventoryService.getInventory(selectedBusinessUnit);
            setItems(refreshedItems);
            setAllItems(refreshedAllItems);
            
            alert(`Auto-organization complete! Successfully updated ${successCount} item(s).`);
        } catch (err) {
            console.error('Auto-organize failed:', err);
            alert('Failed to auto-organize some items.');
        } finally {
            setIsAutoOrganizing(false);
        }
    };

    // ============================================================
    // INLINE EDITING
    // ============================================================

    const startInlineEdit = (item: InventoryItem) => {
        if (!canEdit) return; // read-only: block inline stock edit
        setEditingStockId(item.id);
        setEditingStockValue(item.currentStock.toString());
    };

    const cancelInlineEdit = () => {
        setEditingStockId(null);
        setEditingStockValue('');
    };

    const saveInlineEdit = async () => {
        if (!editingStockId) return;

        const newValue = parseFloat(editingStockValue) || 0;
        try {
            await InventoryService.updateInventoryItem(editingStockId, { currentStock: newValue });
            setItems(prev => prev.map(item =>
                item.id === editingStockId ? { ...item, currentStock: newValue } : item
            ));
        } catch (err) {
            console.error('Error updating stock:', err);
        }
        cancelInlineEdit();
    };

    const handleInlineKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveInlineEdit();
        if (e.key === 'Escape') cancelInlineEdit();
    };

    // ============================================================
    // BULK SET
    // ============================================================

    const handleBulkSet = async () => {
        const value = parseFloat(bulkValue) || 0;
        setIsImporting(true);
        try {
            for (const itemId of selectedItems) {
                await InventoryService.updateInventoryItem(itemId, { currentStock: value });
            }
            // Update local state
            setItems(prev => prev.map(item =>
                selectedItems.has(item.id) ? { ...item, currentStock: value } : item
            ));
            alert(`Updated ${selectedItems.size} item(s) to ${value}`);
            setSelectedItems(new Set());
            setShowBulkModal(false);
        } catch (err) {
            console.error('Error bulk updating:', err);
            alert('Failed to update some items');
        } finally {
            setIsImporting(false);
        }
    };

    // ============================================================
    // TEMPLATE DOWNLOAD (ALL ITEMS WITH CURRENT VALUES)
    // ============================================================

    const handleDownloadTemplate = () => {
        // Include ALL items with SKU and current stock values
        const header = 'SKU,Name,Current Stock,Unit';
        const rows = items.map(i =>
            `${i.sku || ''},${i.name.replace(/,/g, ' ')},${i.currentStock},${i.units.recipeUnit}`
        );
        const template = [header, ...rows].join('\n');

        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `beginning-balance-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ============================================================
    // IMPORT WITH SKU + FUZZY MATCHING
    // ============================================================

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const text = await file.text();
            const cleanText = text.replace(/^\uFEFF/, '');
            const lines = cleanText.split(/\r?\n/).filter(line => line.trim());

            if (lines.length < 2) {
                throw new Error('CSV must have at least a header row and one data row');
            }

            // Parse header
            const headers = lines[0].split(',').map(h => h.toLowerCase().trim());
            const skuIdx = headers.findIndex(h => ['sku', 'code', 'item_code'].includes(h));
            const nameIdx = headers.findIndex(h => ['name', 'item', 'item name', 'item_name'].includes(h));
            const qtyIdx = headers.findIndex(h =>
                ['quantity', 'qty', 'beginning balance', 'beginning_balance', 'balance', 'stock', 'current stock', 'current_stock'].includes(h)
            );

            if (nameIdx === -1 && skuIdx === -1) throw new Error('CSV must have a "Name" or "SKU" column');
            if (qtyIdx === -1) throw new Error('CSV must have a "Beginning Balance" or "Current Stock" column');

            // Parse rows with SKU + fuzzy matching
            const rows: BalanceImportRow[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim());
                const sku = skuIdx >= 0 ? cols[skuIdx] : undefined;
                const name = nameIdx >= 0 ? cols[nameIdx] : '';
                const qtyStr = cols[qtyIdx] || '0';
                const quantity = parseFloat(qtyStr.replace(/,/g, '')) || 0;

                if (!name && !sku) continue;

                // Match by SKU first (exact), then by name (exact), then fuzzy
                let matchedItem: InventoryItem | undefined;
                let matchedBy: 'sku' | 'name' | 'fuzzy' | undefined;

                // 1. Try SKU match
                if (sku) {
                    matchedItem = items.find(item =>
                        item.sku?.toLowerCase() === sku.toLowerCase()
                    );
                    if (matchedItem) matchedBy = 'sku';
                }

                // 2. Try exact name match
                if (!matchedItem && name) {
                    matchedItem = items.find(item =>
                        item.name.toLowerCase() === name.toLowerCase()
                    );
                    if (matchedItem) matchedBy = 'name';
                }

                // 3. Try fuzzy name match
                if (!matchedItem && name) {
                    matchedItem = items.find(item => fuzzyMatch(name, item.name));
                    if (matchedItem) matchedBy = 'fuzzy';
                }

                rows.push({
                    name: name || sku || '',
                    sku,
                    quantity,
                    matched: !!matchedItem,
                    itemId: matchedItem?.id,
                    matchedBy
                });
            }

            setImportResult({
                rows,
                successCount: rows.filter(r => r.matched).length,
                failCount: rows.filter(r => !r.matched).length
            });
            setShowImportModal(true);
        } catch (err) {
            console.error('Import error:', err);
            alert(err instanceof Error ? err.message : 'Failed to import file');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Apply imported balances
    const handleApplyBalances = async () => {
        if (!importResult) return;

        setIsImporting(true);
        try {
            const matchedRows = importResult.rows.filter(r => r.matched && r.itemId);

            for (const row of matchedRows) {
                await InventoryService.updateInventoryItem(row.itemId!, {
                    currentStock: row.quantity
                });
            }

            // Reload items
            const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
            const refreshedItems = await InventoryService.getInventory(selectedBusinessUnit, typeFilter);
            setItems(refreshedItems);

            alert(`Successfully updated ${matchedRows.length} item(s) with beginning balances!`);
            setShowImportModal(false);
            setImportResult(null);
        } catch (err) {
            console.error('Error applying balances:', err);
            alert('Failed to apply some balances. Please try again.');
        } finally {
            setIsImporting(false);
        }
    };

    // Get type badge
    const getTypeBadge = (type: InventoryItemType) => {
        const badges: Record<InventoryItemType, { bg: string; text: string; label: string }> = {
            RAW_MATERIAL: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Raw Material' },
            PRODUCTION: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Production' },
            FINISHED_GOOD: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Finished Good' },
            ASSET: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Asset' }
        };
        const badge = badges[type];
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                {badge.label}
            </span>
        );
    };

    // Get stock status
    const getStockStatus = (item: InventoryItem) => {
        // For Finished Goods with recipes, use sellable quantity
        if (item.type === 'FINISHED_GOOD' && item.recipe && item.recipe.length > 0) {
            const sellable = calculateSellableQuantity(item, allItemsMap);
            if (sellable <= 0) {
                return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">OUT OF STOCK</span>;
            }
            return <span className="text-green-400 font-medium">Available: {sellable}</span>;
        }
        // Default for RAW_MATERIAL, PRODUCTION, etc.
        if (item.currentStock <= 0) {
            return <span className="text-red-400 font-medium">Out of Stock</span>;
        }
        if (item.currentStock < item.parLevel) {
            return <span className="text-amber-400 font-medium">Low Stock</span>;
        }
        return <span className="text-green-400 font-medium">In Stock</span>;
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
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Package className="text-purple-600 dark:text-purple-400" />
                        Inventory Items
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        View and manage inventory items per Business Unit
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* AI Tools */}
                    {hasPermission('inventory:item:edit') && (
                        <button
                            onClick={handleAutoOrganizeAll}
                            disabled={isAutoOrganizing}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-700 hover:via-indigo-700 hover:to-cyan-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                            title="Automatically verify and assign Categories and Departments to all items"
                        >
                            {isAutoOrganizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            Auto-Organize All
                        </button>
                    )}

                    {/* Export — always visible (read) */}
                    <button
                        onClick={handleDownloadTemplate}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                        title="Download all items with current stock values"
                    >
                        <Download size={16} />
                        Export Balances
                    </button>

                    {/* Fix Legacy Costs — requires edit */}
                    {canEdit && (
                        <button
                            onClick={async () => {
                                if (confirm('Run base cost migration to fix missing costs?')) {
                                    try {
                                        await InventoryService.migrateInventoryBaseCosts(selectedBusinessUnit);
                                        alert('Cost migration completed. Please refresh the page to see changes.');
                                    } catch (e) {
                                        console.error(e);
                                        alert('Migration failed.');
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                            title="Run this to recalculate legacy cost values"
                        >
                            <AlertTriangle size={16} />
                            Fix Legacy Costs
                        </button>
                    )}

                    {/* Import Balances — requires create */}
                    {canCreate && (
                        <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer">
                            <Upload size={16} />
                            {isImporting ? 'Processing...' : 'Import Balances'}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                disabled={isImporting}
                                className="hidden"
                            />
                        </label>
                    )}

                    {/* Add Item — requires create */}
                    {canCreate && (
                        <button
                            onClick={() => { setEditingItem(null); setShowItemModal(true); }}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions Bar - Shows when items are selected AND user has edit permission */}
            {selectedItems.size > 0 && canEdit && (
                <div className="bg-purple-50 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/40 rounded-xl p-4 flex items-center justify-between">
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                        {selectedItems.size} item(s) selected
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowBulkModal(true)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Set Balance for All
                        </button>
                        <button
                            onClick={() => setSelectedItems(new Set())}
                            className="px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* Department Tabs — Primary Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {DEPARTMENT_TABS.map(tab => {
                    const TabIcon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveDepartmentTab(tab.key)}
                            className={`px-5 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeDepartmentTab === tab.key
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-purple-500/20'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                }`}
                        >
                            <TabIcon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
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
                                ? 'bg-purple-600 dark:bg-purple-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                }`}
                        >
                            <TabIcon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Service Type Sub-filter (only for FINISHED_GOOD, PRODUCTION, or ALL) */}
            {(activeTypeTab === 'FINISHED_GOOD' || activeTypeTab === 'PRODUCTION' || activeTypeTab === 'ALL') && (
                <div className="flex gap-2">
                    <button
                        onClick={() => setServiceTypeFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${serviceTypeFilter === 'ALL'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        All Service Types
                    </button>
                    {SERVICE_TYPES.map(st => (
                        <button
                            key={st}
                            onClick={() => setServiceTypeFilter(st)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${serviceTypeFilter === st
                                ? st === 'Alacarte'
                                    ? 'bg-indigo-600 text-white'
                                    : st === 'Event'
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-orange-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                    type="text"
                    placeholder="Search items by name, SKU, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Total Items</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Low Stock</p>
                    <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">
                        {items.filter(i => i.currentStock < i.parLevel && i.currentStock > 0).length}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-500 dark:text-red-400">
                        {items.filter(i => i.currentStock <= 0).length}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Total Value</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ₱{items.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                                <th className="p-4 w-12">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                                    >
                                        {selectedItems.size === filteredItems.length && filteredItems.length > 0 ? (
                                            <CheckSquare size={18} />
                                        ) : (
                                            <Square size={18} />
                                        )}
                                    </button>
                                </th>
                                <th className="text-left p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Item Name</th>
                                <th className="text-left p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Type</th>
                                <th className="text-left p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Category</th>
                                <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">
                                    {activeTypeTab === 'FINISHED_GOOD' ? 'Sellable Stock' : 'Current Stock'}
                                    {activeTypeTab !== 'FINISHED_GOOD' && canEdit && (
                                        <span className="text-xs text-slate-400 dark:text-slate-500 block">(Click to edit)</span>
                                    )}
                                </th>
                                <th className="text-right p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Par Level</th>
                                <th className="text-left p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">
                                    {activeTypeTab === 'FINISHED_GOOD' ? 'Stock Available' : 'Status'}
                                </th>
                                <th className="text-center p-4 text-slate-500 dark:text-slate-400 font-medium text-sm">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-500">
                                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>No inventory items found for {currentBusiness?.name || 'this business'}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} className={`border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${selectedItems.has(item.id) ? 'bg-purple-50 dark:bg-purple-500/10' : ''}`}>
                                        <td className="p-4">
                                            <button
                                                onClick={() => toggleSelect(item.id)}
                                                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                                            >
                                                {selectedItems.has(item.id) ? (
                                                    <CheckSquare size={18} className="text-purple-600 dark:text-purple-400" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div>
                                                <p className="text-slate-900 dark:text-white font-medium">{item.name}</p>
                                                {item.sku && <p className="text-xs text-slate-500">{item.sku}</p>}
                                            </div>
                                        </td>
                                        <td className="p-4">{getTypeBadge(item.type)}</td>
                                        <td className="p-4 text-slate-600 dark:text-slate-300">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                        (item.department || 'Unassigned') === 'Bar'
                                                            ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400'
                                                            : (item.department || 'Unassigned') === 'Kitchen'
                                                                ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400'
                                                                : (item.department || 'Unassigned') === 'Retail'
                                                                    ? 'bg-blue-500/20 text-blue-500 dark:text-blue-400'
                                                                    : 'bg-slate-500/20 text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        {item.department || 'Unassigned'}
                                                    </span>
                                                    {item.category}
                                                </div>
                                                {('serviceType' in item && typeof (item as {serviceType?: string}).serviceType === 'string') && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider w-fit ${
                                                        (item as {serviceType?: string}).serviceType === 'Alacarte'
                                                            ? 'bg-indigo-500/20 text-indigo-400'
                                                            : (item as {serviceType?: string}).serviceType === 'Event'
                                                                ? 'bg-teal-500/20 text-teal-400'
                                                                : 'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                        {(item as {serviceType?: string}).serviceType}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            {item.type === 'FINISHED_GOOD' ? (
                                                (() => {
                                                    const sellable = item.recipe && item.recipe.length > 0
                                                        ? calculateSellableQuantity(item, allItemsMap)
                                                        : Math.floor(item.theoreticalStock ?? item.currentStock ?? 0);
                                                    return (
                                                        <span className={`font-medium ${sellable <= 0 ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}>
                                                            {Number((sellable).toFixed(2))} {item.units.recipeUnit}
                                                        </span>
                                                    );
                                                })()
                                            ) : editingStockId === item.id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <input
                                                        ref={stockInputRef}
                                                        type="number"
                                                        value={editingStockValue}
                                                        onChange={(e) => setEditingStockValue(e.target.value)}
                                                        onKeyDown={handleInlineKeyDown}
                                                        onBlur={saveInlineEdit}
                                                        className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border border-cyan-500 rounded text-slate-900 dark:text-white text-right focus:outline-none"
                                                    />
                                                    <span className="text-slate-500 dark:text-slate-400 text-sm">{item.units.recipeUnit}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                    {canEdit ? (
                                                        <button
                                                            onClick={() => startInlineEdit(item)}
                                                            className="text-slate-900 dark:text-white font-medium hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline cursor-pointer transition-colors"
                                                            title="Click to edit"
                                                        >
                                                            {Number((item.currentStock || 0).toFixed(2))} {item.units.recipeUnit}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-900 dark:text-white font-medium">
                                                            {Number((item.currentStock || 0).toFixed(2))} {item.units.recipeUnit}
                                                        </span>
                                                    )}
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        = <span className="text-cyan-600 dark:text-cyan-500">{Number(((item.currentStock || 0) / (item.units.conversion > 0 ? item.units.conversion : 1)).toFixed(2))} {item.units.buyUnit}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right text-slate-500 dark:text-slate-400">
                                            {Number((item.units.conversion > 0 ? (item.parLevel / item.units.conversion) : item.parLevel).toFixed(2))} {item.units.buyUnit}
                                        </td>
                                        <td className="p-4">{getStockStatus(item)}</td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">

                                                {/* Produce Batch — only for PRODUCTION items */}
                                                {item.type === 'PRODUCTION' && (
                                                    <button
                                                        onClick={() => setProducingItem(item)}
                                                        className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                                        title="Produce batch"
                                                    >
                                                        <Layers size={16} />
                                                    </button>
                                                )}

                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                                                        title="Edit item"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                                {canDelete && <button
                                                    onClick={() => handleDelete(item)}
                                                    className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                    title="Delete item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Item Modal */}
            <InventoryItemModal
                isOpen={showItemModal}
                onClose={() => {
                    setShowItemModal(false);
                    setEditingItem(null);
                }}
                onSave={handleSaveItem}
                item={editingItem}
                businessUnitId={selectedBusinessUnit}
                storageAreas={storageAreas}
                uomOptions={uomOptions}
            />

            {/* Bulk Set Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Set Balance for {selectedItems.size} Items</h2>
                        <div className="mb-6">
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">New Balance Value</label>
                            <input
                                type="number"
                                value={bulkValue}
                                onChange={(e) => setBulkValue(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white text-lg focus:outline-none focus:border-purple-500"
                                placeholder="Enter value..."
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBulkModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkSet}
                                disabled={isImporting}
                                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                {isImporting ? 'Updating...' : 'Apply to All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Preview Modal */}
            {showImportModal && importResult && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl">
                                    <FileSpreadsheet size={24} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Import Preview</h2>
                                    <p className="text-sm text-slate-400">Review items before applying balances</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowImportModal(false); setImportResult(null); }}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Summary */}
                        <div className="p-4 border-b border-slate-700 flex gap-4">
                            <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-emerald-400">{importResult.successCount}</p>
                                <p className="text-sm text-emerald-300">Matched</p>
                            </div>
                            <div className={`flex-1 rounded-xl p-4 text-center ${importResult.failCount > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-700/50'}`}>
                                <p className={`text-2xl font-bold ${importResult.failCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>{importResult.failCount}</p>
                                <p className={`text-sm ${importResult.failCount > 0 ? 'text-red-300' : 'text-slate-400'}`}>Not Found</p>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 sticky top-0">
                                    <tr>
                                        <th className="text-left p-2 text-slate-400">Item Name</th>
                                        <th className="text-right p-2 text-slate-400">Balance</th>
                                        <th className="text-center p-2 text-slate-400">Match Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importResult.rows.map((row, idx) => (
                                        <tr key={idx} className="border-t border-slate-700/50">
                                            <td className="p-2 text-white">
                                                {row.name}
                                                {row.sku && <span className="text-slate-500 text-xs ml-2">({row.sku})</span>}
                                            </td>
                                            <td className="p-2 text-right text-cyan-400 font-medium">{row.quantity}</td>
                                            <td className="p-2 text-center">
                                                {row.matched ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${row.matchedBy === 'sku' ? 'bg-purple-500/20 text-purple-300' :
                                                        row.matchedBy === 'fuzzy' ? 'bg-amber-500/20 text-amber-300' :
                                                            'bg-emerald-500/20 text-emerald-300'
                                                        }`}>
                                                        <CheckCircle size={12} />
                                                        {row.matchedBy === 'sku' ? 'SKU' :
                                                            row.matchedBy === 'fuzzy' ? 'Fuzzy' : 'Name'}
                                                    </span>
                                                ) : (
                                                    <span className="text-red-400 text-xs">Not Found</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
                            <button
                                onClick={() => { setShowImportModal(false); setImportResult(null); }}
                                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            {importResult.successCount > 0 && (
                                <button
                                    onClick={handleApplyBalances}
                                    disabled={isImporting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                                >
                                    <CheckCircle size={18} />
                                    {isImporting ? 'Applying...' : `Apply ${importResult.successCount} Balances`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Produce Batch Modal */}
            {producingItem && (
                <ProduceBatchModal
                    isOpen={true}
                    onClose={() => setProducingItem(null)}
                    item={producingItem}
                    allItems={allItems as (InventoryItem & { id: string })[]}
                    businessUnitId={selectedBusinessUnit}
                    performedBy={{ id: 'system', name: 'Inventory Manager' }}
                    onProduced={() => {
                        // Reload inventory after successful production
                        setProducingItem(null);
                        void InventoryService.getInventory(selectedBusinessUnit).then(data => {
                            setAllItems(data);
                            const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
                            void InventoryService.getInventory(selectedBusinessUnit, typeFilter).then(setItems);
                        });
                    }}
                />
            )}


        </div>
    );
};

export default InventoryItemsView;
