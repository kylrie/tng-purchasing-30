import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Save, Plus, Trash2, Loader2, ChefHat,
    TrendingUp, Search, AlertTriangle, Package
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import { InventoryService } from '../../inventory/services/inventory.service';
import type { MenuItem, MenuCategory } from '../types/menu.types';
import {
    MENU_CATEGORIES,
    getFoodCostStatus,
    getFoodCostColor,
    getFoodCostBgColor
} from '../types/menu.types';
import {
    RecipesService,
    calculateIngredientCost,
    getAvailableUnits
} from '../services/recipes.service';

// ============================================================
// TYPES
// ============================================================

interface RecipeEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    menuItem?: MenuItem | null;
    businessUnitId: string;
}

interface IngredientFormData {
    id: string; // Temporary ID for UI
    inventoryItemId: string;
    inventoryItemName: string;
    quantity: number;
    unit: string;
    availableUnits: string[];
    costPerUnit: number;
    totalCost: number;
}

// ============================================================
// INGREDIENT ROW COMPONENT
// ============================================================

const IngredientRow: React.FC<{
    ingredient: IngredientFormData;
    inventoryItems: InventoryItem[];
    onUpdate: (id: string, updates: Partial<IngredientFormData>) => void;
    onRemove: (id: string) => void;
}> = ({ ingredient, inventoryItems, onUpdate, onRemove }) => {
    const selectedItem = inventoryItems.find(i => i.id === ingredient.inventoryItemId);

    return (
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg">
            {/* Item Name */}
            <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{ingredient.inventoryItemName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedItem?.category} • ₱{ingredient.costPerUnit.toFixed(2)}/{selectedItem?.units.countUnit}
                </p>
            </div>

            {/* Quantity Input */}
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ingredient.quantity || ''}
                    onChange={(e) => onUpdate(ingredient.id, { quantity: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm text-right focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="0"
                />

                {/* Unit Selector */}
                <select
                    value={ingredient.unit}
                    onChange={(e) => onUpdate(ingredient.id, { unit: e.target.value })}
                    className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                    {ingredient.availableUnits.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                    ))}
                </select>
            </div>

            {/* Cost Display */}
            <div className="w-24 text-right">
                <span className="text-cyan-600 dark:text-cyan-400 font-medium">₱{ingredient.totalCost.toFixed(2)}</span>
            </div>

            {/* Remove Button */}
            <button
                onClick={() => onRemove(ingredient.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 rounded transition-colors"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

// ============================================================
// LIVE COST CARD COMPONENT
// ============================================================

const LiveCostCard: React.FC<{
    totalCost: number;
    sellingPrice: number;
}> = ({ totalCost, sellingPrice }) => {
    const grossMargin = sellingPrice - totalCost;
    const foodCostPercent = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0;
    const marginPercent = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;

    const status = getFoodCostStatus(foodCostPercent);
    const textColor = getFoodCostColor(status);
    const bgColor = getFoodCostBgColor(status);

    return (
        <div className={`p-4 rounded-xl border ${bgColor}`}>
            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <PesoSign size={14} />
                Live Costing
            </h4>

            <div className="space-y-3">
                {/* Total Cost */}
                <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300">Recipe Cost</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                        ₱{totalCost.toFixed(2)}
                    </span>
                </div>

                {/* Food Cost % */}
                <div className="flex justify-between items-center">
                    <span className="text-slate-300">Food Cost %</span>
                    <span className={`text-xl font-bold ${textColor}`}>
                        {foodCostPercent.toFixed(1)}%
                    </span>
                </div>

                {/* Gross Margin */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-600/50">
                    <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <TrendingUp size={14} />
                        Gross Margin
                    </span>
                    <div className="text-right">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                            ₱{grossMargin.toFixed(2)}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                            ({marginPercent.toFixed(1)}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Status Indicator */}
            <div className={`mt-3 text-xs ${textColor} text-center`}>
                {status === 'excellent' && '✨ Excellent margin!'}
                {status === 'good' && '👍 Good margin'}
                {status === 'warning' && '⚠️ Consider reducing costs'}
                {status === 'danger' && '🚨 Food cost too high!'}
            </div>
        </div>
    );
};

// ============================================================
// MAIN RECIPE EDITOR COMPONENT
// ============================================================

const RecipeEditor: React.FC<RecipeEditorProps> = ({
    isOpen,
    onClose,
    onSave,
    menuItem,
    businessUnitId
}) => {
    // Form state
    const [name, setName] = useState('');
    const [category, setCategory] = useState<MenuCategory>('Mains');
    const [description, setDescription] = useState('');
    const [sellingPrice, setSellingPrice] = useState(0);
    const [ingredients, setIngredients] = useState<IngredientFormData[]>([]);

    // UI state
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search state for adding ingredients
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const isEditing = !!menuItem;

    // Load inventory items
    useEffect(() => {
        const loadData = async () => {
            if (!businessUnitId) return;

            setIsLoading(true);
            try {
                const items = await InventoryService.getInventory(businessUnitId);
                // Only show RAW_MATERIAL and PRODUCTION items for recipes
                setInventoryItems(items.filter(i =>
                    i.type === 'RAW_MATERIAL' || i.type === 'PRODUCTION'
                ));
            } catch (err) {
                console.error('Error loading inventory:', err);
                setError('Failed to load inventory items');
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            loadData();
        }
    }, [businessUnitId, isOpen]);

    // Populate form when editing
    useEffect(() => {
        if (menuItem) {
            setName(menuItem.name);
            setCategory(menuItem.category);
            setDescription(menuItem.description || '');
            setSellingPrice(menuItem.sellingPrice);

            // Convert existing ingredients to form data
            const formIngredients: IngredientFormData[] = menuItem.ingredients.map((ing, idx) => {
                const invItem = inventoryItems.find(i => i.id === ing.inventoryItemId);
                return {
                    id: `existing-${idx}`,
                    inventoryItemId: ing.inventoryItemId,
                    inventoryItemName: ing.inventoryItemName,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    availableUnits: invItem ? getAvailableUnits(invItem.units.countUnit) : [ing.unit],
                    costPerUnit: ing.costPerBaseUnit,
                    totalCost: ing.totalCost
                };
            });
            setIngredients(formIngredients);
        } else {
            // Reset for new item
            setName('');
            setCategory('Mains');
            setDescription('');
            setSellingPrice(0);
            setIngredients([]);
        }
    }, [menuItem, inventoryItems, isOpen]);

    // Calculate total cost
    const totalCost = useMemo(() => {
        return ingredients.reduce((sum, ing) => sum + ing.totalCost, 0);
    }, [ingredients]);

    // Filtered inventory for search
    const filteredInventory = useMemo(() => {
        if (!searchQuery) return inventoryItems;
        const query = searchQuery.toLowerCase();
        return inventoryItems.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        );
    }, [inventoryItems, searchQuery]);

    // Add ingredient
    const handleAddIngredient = (item: InventoryItem) => {
        // Check if already added
        if (ingredients.some(ing => ing.inventoryItemId === item.id)) {
            return;
        }

        const availableUnits = getAvailableUnits(item.units.countUnit);
        const defaultUnit = availableUnits.includes('g') ? 'g' :
            availableUnits.includes('ml') ? 'ml' :
                item.units.countUnit;

        const newIngredient: IngredientFormData = {
            id: `new-${Date.now()}`,
            inventoryItemId: item.id,
            inventoryItemName: item.name,
            quantity: 0,
            unit: defaultUnit,
            availableUnits,
            costPerUnit: item.costPerUnit,
            totalCost: 0
        };

        setIngredients([...ingredients, newIngredient]);
        setShowSearch(false);
        setSearchQuery('');
    };

    // Update ingredient
    const handleUpdateIngredient = (id: string, updates: Partial<IngredientFormData>) => {
        setIngredients(prev => prev.map(ing => {
            if (ing.id !== id) return ing;

            const updated = { ...ing, ...updates };

            // Recalculate cost if quantity or unit changed
            if (updates.quantity !== undefined || updates.unit !== undefined) {
                const invItem = inventoryItems.find(i => i.id === updated.inventoryItemId);
                if (invItem) {
                    const { totalCost } = calculateIngredientCost(
                        updated.quantity,
                        updated.unit,
                        invItem
                    );
                    updated.totalCost = totalCost;
                }
            }

            return updated;
        }));
    };

    // Remove ingredient
    const handleRemoveIngredient = (id: string) => {
        setIngredients(prev => prev.filter(ing => ing.id !== id));
    };

    // Handle save
    const handleSave = async () => {
        if (!name.trim()) {
            setError('Please enter a menu item name');
            return;
        }

        if (sellingPrice <= 0) {
            setError('Please enter a valid selling price');
            return;
        }

        if (ingredients.length === 0) {
            setError('Please add at least one ingredient');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const ingredientInputs = ingredients.map(ing => ({
                inventoryItemId: ing.inventoryItemId,
                inventoryItemName: ing.inventoryItemName,
                quantity: ing.quantity,
                unit: ing.unit,
                baseQuantity: 0, // Will be calculated by service
                costPerBaseUnit: ing.costPerUnit,
                totalCost: ing.totalCost
            }));

            if (menuItem) {
                await RecipesService.updateMenuItem(menuItem.id, {
                    name: name.trim(),
                    category,
                    description: description.trim() || undefined,
                    sellingPrice,
                    ingredients: ingredientInputs
                });
            } else {
                await RecipesService.createMenuItem({
                    businessUnitId,
                    name: name.trim(),
                    category,
                    description: description.trim() || undefined,
                    sellingPrice,
                    ingredients: ingredientInputs
                });
            }

            onSave();
            onClose();
        } catch (err: any) {
            console.error('Error saving menu item (Full Details):', err);
            // Log specific Firestore error code if available
            if (err.code) console.error('Firestore Error Code:', err.code);
            if (err.message) console.error('Error Message:', err.message);

            setError(`Failed to save menu item: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full p-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ChefHat size={20} className="text-purple-600 dark:text-purple-400" />
                            {isEditing ? 'Edit Recipe' : 'Create New Recipe'}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 size={32} className="text-purple-400 animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
                                {/* Left Panel - Basic Info */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* Error Display */}
                                    {error && (
                                        <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm flex items-center gap-2">
                                            <AlertTriangle size={16} />
                                            {error}
                                        </div>
                                    )}

                                    {/* Name */}
                                    <div>
                                        <label className={labelClass}>Menu Item Name *</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g., Classic Margarita"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className={labelClass}>Category</label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value as MenuCategory)}
                                            className={inputClass}
                                        >
                                            {MENU_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat} className="bg-white dark:bg-slate-800">{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className={labelClass}>Description</label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className={`${inputClass} min-h-[80px] resize-y`}
                                            placeholder="Brief description of the dish..."
                                        />
                                    </div>

                                    {/* Selling Price */}
                                    <div>
                                        <label className={labelClass}>Selling Price (₱) *</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={sellingPrice || ''}
                                            onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                                            className={inputClass}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {/* Live Cost Card */}
                                    <LiveCostCard
                                        totalCost={totalCost}
                                        sellingPrice={sellingPrice}
                                    />
                                </div>

                                {/* Right Panel - Ingredients */}
                                <div className="lg:col-span-3 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                            <Package size={14} />
                                            Ingredients ({ingredients.length})
                                        </h4>
                                        <button
                                            onClick={() => setShowSearch(true)}
                                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                                        >
                                            <Plus size={14} />
                                            Add
                                        </button>
                                    </div>

                                    {/* Ingredient Search */}
                                    {showSearch && (
                                        <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-3 space-y-3 border border-slate-200 dark:border-slate-600">
                                            <div className="relative">
                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                                    placeholder="Search ingredients..."
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="max-h-48 overflow-y-auto space-y-1">
                                                {filteredInventory.length === 0 ? (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                                        No ingredients found
                                                    </p>
                                                ) : (
                                                    filteredInventory.map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => handleAddIngredient(item)}
                                                            disabled={ingredients.some(ing => ing.inventoryItemId === item.id)}
                                                            className="w-full flex items-center justify-between p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                                                        >
                                                            <div>
                                                                <p className="text-slate-900 dark:text-white text-sm">{item.name}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
                                                            </div>
                                                            <span className="text-xs text-slate-500 dark:text-slate-500">
                                                                ₱{item.costPerUnit}/{item.units.countUnit}
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>

                                            <button
                                                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                                                className="w-full py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}

                                    {/* Ingredients List */}
                                    <div className="space-y-2">
                                        {ingredients.length === 0 ? (
                                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                                                <Package size={32} className="mx-auto text-slate-400 dark:text-slate-500 mb-2" />
                                                <p className="text-slate-500 dark:text-slate-400 text-sm">No ingredients added yet</p>
                                                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Click "Add" to add ingredients</p>
                                            </div>
                                        ) : (
                                            ingredients.map(ing => (
                                                <IngredientRow
                                                    key={ing.id}
                                                    ingredient={ing}
                                                    inventoryItems={inventoryItems}
                                                    onUpdate={handleUpdateIngredient}
                                                    onRemove={handleRemoveIngredient}
                                                />
                                            ))
                                        )}
                                    </div>

                                    {/* Summary Row */}
                                    {ingredients.length > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm dark:shadow-none">
                                            <span className="font-medium text-slate-700 dark:text-white">Total Ingredient Cost</span>
                                            <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                                                ₱{totalCost.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90 text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            {isSaving ? 'Saving...' : isEditing ? 'Update Recipe' : 'Create Recipe'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default RecipeEditor;
