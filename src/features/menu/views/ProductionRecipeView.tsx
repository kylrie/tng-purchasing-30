import React, { useState, useEffect } from 'react';
import {
    Factory,
    Plus,
    Search,
    Loader2,
    Building2,
    Edit,
    Trash2,
    Package,
    Play,
    X,
    Layers,
    ClipboardList
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { ProductionRecipe } from '../types/menu.types';
import { ProductionRecipeService } from '../services/production-recipe.service';
import ProductionRecipeModal from '../components/ProductionRecipeModal';
import type { Business, User } from '../../procurement/types';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import { InventoryService } from '../../inventory/services/inventory.service';
import ProductionLogsView from './ProductionLogsView';

// ============================================================
// PROPS
// ============================================================

interface ProductionRecipeViewProps {
    businesses: Business[];
    currentUser?: User;
}

// ============================================================
// RECIPE CARD COMPONENT
// ============================================================

const RecipeCard: React.FC<{
    recipe: ProductionRecipe;
    productionStock: number | null;   // live currentStock from inventory
    onEdit: (recipe: ProductionRecipe) => void;
    onDelete: (recipe: ProductionRecipe) => void;
    onRecordYield: (recipe: ProductionRecipe) => void;
}> = ({ recipe, productionStock, onEdit, onDelete, onRecordYield }) => {
    return (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-amber-500/50 transition-all shadow-sm dark:shadow-none">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-500/20 rounded-lg">
                        <Factory size={20} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{recipe.name}</h3>
                        <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            {recipe.category}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onRecordYield(recipe)}
                        title="Record Production Yield"
                        className="p-2 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-lg text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                    >
                        <Play size={16} />
                    </button>
                    <button
                        onClick={() => onEdit(recipe)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(recipe)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Yield Info */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mb-3">
                <p className="text-xs text-slate-500 mb-1">Batch Yield</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {recipe.yieldQuantity} {recipe.yieldUnit}
                </p>
            </div>

            {/* Stock Remaining */}
            <div className={`rounded-lg p-3 mb-3 flex items-center gap-2 ${
                productionStock === null
                    ? 'bg-slate-50 dark:bg-slate-900/50'
                    : productionStock <= 0
                        ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
                        : 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
            }`}>
                <Layers size={14} className={
                    productionStock === null
                        ? 'text-slate-400'
                        : productionStock <= 0
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                } />
                <div>
                    <p className="text-xs text-slate-500">Servings Remaining</p>
                    <p className={`text-sm font-bold ${
                        productionStock === null
                            ? 'text-slate-400'
                            : productionStock <= 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-green-700 dark:text-green-400'
                    }`}>
                        {productionStock === null
                            ? '—'
                            : `${productionStock.toLocaleString()} ${recipe.yieldUnit}`
                        }
                    </p>
                </div>
            </div>

            {/* Cost Info */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Cost</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center justify-center gap-1">
                        <PesoSign size={14} />
                        {recipe.calculatedCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Cost/Unit</p>
                    <p className="text-sm font-medium text-amber-500 dark:text-amber-400 flex items-center justify-center gap-1">
                        <PesoSign size={14} />
                        {recipe.costPerUnit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Ingredients count */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500">
                    {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const ProductionRecipeView: React.FC<ProductionRecipeViewProps> = ({ businesses, currentUser }) => {
    // State
    const [activeTab, setActiveTab] = useState<'recipes' | 'logs'>('recipes');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(
        businesses.length > 0 ? businesses[0].id : ''
    );
    const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [productionItems, setProductionItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<ProductionRecipe | null>(null);

    // Production Yield modal state
    const [yieldModalRecipe, setYieldModalRecipe] = useState<ProductionRecipe | null>(null);
    const [yieldQuantity, setYieldQuantity] = useState<string>('');
    const [yieldLoading, setYieldLoading] = useState(false);
    const [yieldMessage, setYieldMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Build a map: linkedInventoryItemId -> currentStock for O(1) lookup on cards
    const productionStockMap = React.useMemo(() => {
        const map = new Map<string, number>();
        for (const item of productionItems) {
            map.set(item.id, item.currentStock ?? 0);
        }
        return map;
    }, [productionItems]);

    // Helper to reload production stock
    const refreshProductionStock = async (buId: string) => {
        try {
            const fetched = await InventoryService.getInventory(buId, 'PRODUCTION');
            setProductionItems(fetched);
        } catch (err) {
            console.error('Error refreshing production stock:', err);
        }
    };

    // Load data
    useEffect(() => {
        const loadData = async () => {
            if (!selectedBusinessUnit) return;

            setIsLoading(true);
            try {
                // Fetch Recipes
                try {
                    const fetchedRecipes = await ProductionRecipeService.getRecipes(selectedBusinessUnit);
                    console.log(`[ProductionRecipeView] Loaded ${fetchedRecipes.length} recipes.`);
                    setRecipes(fetchedRecipes);
                } catch (recipeErr) {
                    console.error('Error loading recipes (Perms/Network):', recipeErr);
                }

                // Fetch Raw Material Inventory (for ingredient picker)
                try {
                    const fetchedItems = await InventoryService.getInventory(selectedBusinessUnit, 'RAW_MATERIAL');
                    console.log(`[ProductionRecipeView] Loaded ${fetchedItems.length} raw material items.`);
                    setInventoryItems(fetchedItems);
                } catch (invErr) {
                    console.error('Error loading raw material inventory:', invErr);
                }

                // Fetch Production Inventory (for "servings remaining")
                try {
                    const fetchedProd = await InventoryService.getInventory(selectedBusinessUnit, 'PRODUCTION');
                    console.log(`[ProductionRecipeView] Loaded ${fetchedProd.length} production items.`);
                    setProductionItems(fetchedProd);
                } catch (prodErr) {
                    console.error('Error loading production inventory:', prodErr);
                }

            } catch (err) {
                console.error('Error in loadData:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [selectedBusinessUnit]);

    // Filter recipes
    const filteredRecipes = recipes.filter(recipe =>
        searchQuery === '' ||
        recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handlers
    const handleAddNew = () => {
        setEditingRecipe(null);
        setShowModal(true);
    };

    const handleEdit = (recipe: ProductionRecipe) => {
        setEditingRecipe(recipe);
        setShowModal(true);
    };

    const handleDelete = async (recipe: ProductionRecipe) => {
        if (confirm(`Delete "${recipe.name}"? This cannot be undone.`)) {
            try {
                await ProductionRecipeService.deleteRecipe(recipe.id);
                setRecipes(prev => prev.filter(r => r.id !== recipe.id));
            } catch (err) {
                console.error('Error deleting recipe:', err);
                alert('Failed to delete recipe');
            }
        }
    };

    const handleSave = async () => {
        // Reload recipes after save
        const fetchedRecipes = await ProductionRecipeService.getRecipes(selectedBusinessUnit);
        setRecipes(fetchedRecipes);
        // Also refresh production stock so new linked items appear
        await refreshProductionStock(selectedBusinessUnit);
        setShowModal(false);
        setEditingRecipe(null);
    };

    // Production Yield handlers
    const handleOpenYieldModal = (recipe: ProductionRecipe) => {
        setYieldModalRecipe(recipe);
        setYieldQuantity('');
        setYieldMessage(null);
    };

    const handleRecordYield = async () => {
        if (!yieldModalRecipe || !yieldQuantity || Number(yieldQuantity) <= 0) return;
        if (!currentUser) {
            setYieldMessage({ type: 'error', text: 'User not authenticated.' });
            return;
        }

        setYieldLoading(true);
        setYieldMessage(null);
        try {
            const result = await ProductionRecipeService.recordProductionYield({
                recipeId: yieldModalRecipe.id,
                yieldQuantity: Number(yieldQuantity),
                businessUnitId: selectedBusinessUnit,
                userId: currentUser.id,
                userName: currentUser.name
            });
            setYieldMessage({ type: 'success', text: result.message });

            // Refresh BOTH raw material stock AND production item stock
            const [fetchedItems, fetchedProd] = await Promise.all([
                InventoryService.getInventory(selectedBusinessUnit, 'RAW_MATERIAL'),
                InventoryService.getInventory(selectedBusinessUnit, 'PRODUCTION')
            ]);
            setInventoryItems(fetchedItems);
            setProductionItems(fetchedProd);
        } catch (err) {
            setYieldMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to record production yield.' });
        } finally {
            setYieldLoading(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 size={48} className="text-amber-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading production recipes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Factory className="text-amber-500 dark:text-amber-400" />
                        Production
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Manage recipes and view production run history
                    </p>
                </div>

                {/* Right: BU selector + New Recipe (only on recipes tab) */}
                <div className="flex flex-wrap items-center gap-3">
                    {activeTab === 'recipes' && (
                        <button
                            onClick={handleAddNew}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            <Plus size={18} />
                            New Recipe
                        </button>
                    )}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                        <Building2 size={16} className="text-slate-500 dark:text-slate-400" />
                        <select
                            value={selectedBusinessUnit}
                            onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                            className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-sm"
                        >
                            {businesses.map(bu => (
                                <option key={bu.id} value={bu.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                    {bu.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setActiveTab('recipes')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        activeTab === 'recipes'
                            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                >
                    <Factory size={16} />
                    Recipes
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        activeTab === 'logs'
                            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                >
                    <ClipboardList size={16} />
                    Production Logs
                </button>
            </div>

            {/* ── LOGS TAB ─────────────────────────────────────────── */}
            {activeTab === 'logs' && (
                <ProductionLogsView businesses={businesses} defaultBusinessUnitId={selectedBusinessUnit} embedded />
            )}

            {/* ── RECIPES TAB ──────────────────────────────────────── */}
            {activeTab === 'recipes' && (<>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                    type="text"
                    placeholder="Search recipes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Total Recipes</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{recipes.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Categories Used</p>
                    <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">
                        {new Set(recipes.map(r => r.category)).size}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Avg Cost/Recipe</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <PesoSign size={20} />
                        {recipes.length > 0
                            ? (recipes.reduce((sum, r) => sum + r.calculatedCost, 0) / recipes.length).toFixed(2)
                            : '0.00'
                        }
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Raw Materials</p>
                    <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">{inventoryItems.length}</p>
                </div>
            </div>

            {/* Recipes Grid */}
            {filteredRecipes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <Package size={48} className="mx-auto mb-4 text-slate-400 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                        {searchQuery ? 'No recipes match your search' : 'No production recipes yet'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={handleAddNew}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Create Your First Recipe
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredRecipes.map(recipe => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            productionStock={
                                recipe.linkedInventoryItemId
                                    ? (productionStockMap.get(recipe.linkedInventoryItemId) ?? null)
                                    : null
                            }
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onRecordYield={handleOpenYieldModal}
                        />
                    ))}
                </div>
            )}

            </>)}{/* end recipes tab */}

            {/* Modal */}
            <ProductionRecipeModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingRecipe(null); }}
                onSave={handleSave}
                recipe={editingRecipe}
                businessUnitId={selectedBusinessUnit}
                inventoryItems={inventoryItems}
            />

            {/* Production Yield Modal */}
            {yieldModalRecipe && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 dark:bg-green-500/20 rounded-lg">
                                    <Play size={20} className="text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Record Production</h3>
                                    <p className="text-sm text-slate-500">{yieldModalRecipe.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setYieldModalRecipe(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            {/* Recipe Info */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase">Recipe Yield Per Batch</p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {yieldModalRecipe.yieldQuantity} {yieldModalRecipe.yieldUnit}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {yieldModalRecipe.ingredients.length} ingredient{yieldModalRecipe.ingredients.length !== 1 ? 's' : ''} will be deducted from raw materials
                                </p>
                            </div>

                            {/* Current Stock */}
                            {yieldModalRecipe.linkedInventoryItemId && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
                                    <Layers size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />
                                    <div>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Current stock before this run</p>
                                        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                            {(productionStockMap.get(yieldModalRecipe.linkedInventoryItemId) ?? 0).toLocaleString()} {yieldModalRecipe.yieldUnit} remaining
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Yield Input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    How many {yieldModalRecipe.yieldUnit} did you produce?
                                </label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    value={yieldQuantity}
                                    onChange={(e) => setYieldQuantity(e.target.value)}
                                    placeholder={`e.g. ${yieldModalRecipe.yieldQuantity}`}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-green-500 text-lg font-semibold"
                                    autoFocus
                                />
                            </div>

                            {/* Deduction Preview */}
                            {yieldQuantity && Number(yieldQuantity) > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">Raw Materials to Deduct:</p>
                                    <ul className="space-y-1">
                                        {yieldModalRecipe.ingredients.map((ing, idx) => (
                                            <li key={idx} className="text-xs text-amber-800 dark:text-amber-300 flex justify-between">
                                                <span>{ing.inventoryItemName}</span>
                                                <span className="font-mono font-semibold">
                                                    -{(ing.baseQuantity * (Number(yieldQuantity) / yieldModalRecipe.yieldQuantity)).toFixed(2)} {ing.unit}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    {/* Stock After Preview */}
                                    {yieldModalRecipe.linkedInventoryItemId && (
                                        <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-500/30 flex justify-between text-xs font-semibold">
                                            <span className="text-slate-600 dark:text-slate-400">Stock after this run:</span>
                                            <span className="text-green-700 dark:text-green-400">
                                                +{Number(yieldQuantity).toLocaleString()} → {(
                                                    (productionStockMap.get(yieldModalRecipe.linkedInventoryItemId) ?? 0) + Number(yieldQuantity)
                                                ).toLocaleString()} {yieldModalRecipe.yieldUnit}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Messages */}
                            {yieldMessage && (
                                <div className={`rounded-xl p-3 text-sm font-medium ${yieldMessage.type === 'success'
                                    ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                                    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                                    }`}>
                                    {yieldMessage.text}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setYieldModalRecipe(null)}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
                            >
                                {yieldMessage?.type === 'success' ? 'Close' : 'Cancel'}
                            </button>
                            {yieldMessage?.type !== 'success' && (
                                <button
                                    onClick={handleRecordYield}
                                    disabled={yieldLoading || !yieldQuantity || Number(yieldQuantity) <= 0}
                                    className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {yieldLoading ? (
                                        <><Loader2 size={16} className="animate-spin" /> Recording...</>
                                    ) : (
                                        <><Play size={16} /> Record Production</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionRecipeView;
