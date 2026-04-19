import React, { useState, useEffect } from 'react';
import {
    X,
    Factory,
    Plus,
    Trash2,
    Search
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type {
    ProductionRecipe,
    ProductionCategory,
    RecipeIngredient,
    CreateProductionRecipeInput
} from '../types/menu.types';
import { PRODUCTION_CATEGORIES } from '../types/menu.types';
import { convertUnits } from '../services/recipes.service';
import { UOM_CODES } from '../../../shared/constants/uom.constants';
import { ProductionRecipeService } from '../services/production-recipe.service';
import type { InventoryItem } from '../../inventory/types/InventoryItem';

// ============================================================
// PROPS
// ============================================================

interface ProductionRecipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    recipe: ProductionRecipe | null;
    businessUnitId: string;
    inventoryItems: InventoryItem[];
}

// ============================================================
// COMPONENT
// ============================================================

const ProductionRecipeModal: React.FC<ProductionRecipeModalProps> = ({
    isOpen,
    onClose,
    onSave,
    recipe,
    businessUnitId,
    inventoryItems
}) => {
    // Form state
    const [name, setName] = useState('');
    const [category, setCategory] = useState<ProductionCategory>('Other');
    const [description, setDescription] = useState('');
    const [yieldQuantity, setYieldQuantity] = useState<number>(1);
    const [yieldUnit, setYieldUnit] = useState('G');
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    // FIX: Replace alert() with inline error state
    const [validationError, setValidationError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Ingredient search
    const [searchQuery, setSearchQuery] = useState('');
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);

    // Reset form when recipe changes
    useEffect(() => {
        if (recipe) {
            setName(recipe.name);
            setCategory(recipe.category);
            setDescription(recipe.description || '');
            setYieldQuantity(recipe.yieldQuantity);
            setYieldUnit(recipe.yieldUnit);
            setIngredients(recipe.ingredients);
        } else {
            setName('');
            setCategory('Other');
            setDescription('');
            setYieldQuantity(1);
            setYieldUnit('G');
            setIngredients([]);
        }
        // FIX: Reset errors when modal opens
        setValidationError(null);
        setSaveError(null);
    }, [recipe, isOpen]);

    // Calculate total ingredient cost
    const totalCost = ingredients.reduce((sum, ing) => sum + ing.totalCost, 0);
    const costPerUnit = yieldQuantity > 0 ? totalCost / yieldQuantity : 0;
    // Calculate total wastage cost (percentage of ingredient cost)
    const totalWastageCost = ingredients.reduce((sum, ing) => {
        const wPct = ing.wastagePercent ?? 0;
        return sum + (wPct > 0 ? (wPct / 100) * ing.totalCost : 0);
    }, 0);
    const totalTrueCost = totalCost + totalWastageCost;

    // Filter available inventory items
    const availableItems = inventoryItems.filter(item =>
        !ingredients.some(ing => ing.inventoryItemId === item.id) &&
        (searchQuery === '' ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Add ingredient
    const addIngredient = (item: InventoryItem) => {
        const newIngredient: RecipeIngredient = {
            inventoryItemId: item.id,
            inventoryItemName: item.name,
            quantity: 1,
            unit: item.units.recipeUnit,
            baseQuantity: 1,
            costPerBaseUnit: item.costPerUnit,
            totalCost: item.costPerUnit,
            wastagePercent: undefined
        };
        setIngredients([...ingredients, newIngredient]);
        setShowIngredientPicker(false);
        setSearchQuery('');
    };

    // Update wastage percentage
    const updateWastagePercent = (index: number, wastagePercent: number | undefined) => {
        setIngredients(prev => prev.map((ing, i) =>
            i === index ? { ...ing, wastagePercent } : ing
        ));
    };

    // Update ingredient
    const updateIngredient = (index: number, quantity: number, unit: string) => {
        setIngredients(prev => prev.map((ing, i) => {
            if (i !== index) return ing;

            // Calculate base quantity based on unit conversion
            let baseQuantity = quantity;
            const item = inventoryItems.find(it => it.id === ing.inventoryItemId);
            if (item && unit !== item.units.recipeUnit) {
                baseQuantity = convertUnits(quantity, unit, item.units.recipeUnit);
            }

            const totalCost = baseQuantity * ing.costPerBaseUnit;
            return { ...ing, quantity, unit, baseQuantity, totalCost };
        }));
    };

    // Remove ingredient
    const removeIngredient = (index: number) => {
        setIngredients(prev => prev.filter((_, i) => i !== index));
    };

    // Save recipe
    const handleSave = async () => {
        // FIX: Replace alert() with inline validation
        if (!name.trim()) {
            setValidationError('Please enter a recipe name');
            return;
        }
        if (ingredients.length === 0) {
            setValidationError('Please add at least one ingredient');
            return;
        }
        setValidationError(null);

        setIsSaving(true);
        try {
            const input: CreateProductionRecipeInput = {
                businessUnitId,
                name,
                category,
                description: description || undefined,
                yieldQuantity,
                yieldUnit,
                ingredients: ingredients.map(ing => {
                    const mapped: RecipeIngredient = {
                        inventoryItemId: ing.inventoryItemId,
                        inventoryItemName: ing.inventoryItemName,
                        quantity: ing.quantity,
                        unit: ing.unit,
                        baseQuantity: ing.baseQuantity,
                        costPerBaseUnit: ing.costPerBaseUnit,
                        totalCost: ing.totalCost,
                    };
                    if (ing.wastagePercent !== undefined) {
                        mapped.wastagePercent = ing.wastagePercent;
                    }
                    return mapped;
                })
            };

            if (recipe) {
                await ProductionRecipeService.updateRecipe(recipe.id, input);
            } else {
                await ProductionRecipeService.createRecipe(input);
            }

            onSave();
        } catch (err) {
            console.error('Error saving recipe:', err);
            // FIX: Replace alert() with inline save error
            setSaveError('Failed to save recipe. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 rounded-xl">
                            <Factory size={24} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {recipe ? 'Edit Production Recipe' : 'New Production Recipe'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Create recipes for production items
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Error Display */}
                    {(validationError || saveError) && (
                        <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm flex items-center justify-between">
                            <span>{validationError || saveError}</span>
                            <button onClick={() => { setValidationError(null); setSaveError(null); }} className="text-red-400 hover:text-red-300 ml-2">&times;</button>
                        </div>
                    )}
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-700 dark:text-slate-400 mb-2">Recipe Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Simple Syrup"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 dark:text-slate-400 mb-2">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as ProductionCategory)}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            >
                                {PRODUCTION_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-400 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            rows={2}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none"
                        />
                    </div>

                    {/* Yield */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-700 dark:text-slate-400 mb-2">Yield Quantity</label>
                            <input
                                type="number"
                                value={yieldQuantity}
                                onChange={(e) => setYieldQuantity(parseFloat(e.target.value) || 0)}
                                min="0.01"
                                step="0.1"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 dark:text-slate-400 mb-2">Unit</label>
                            <select
                                value={yieldUnit}
                                onChange={(e) => setYieldUnit(e.target.value)}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                            >
                                {UOM_CODES.map(code => (
                                    <option key={code} value={code}>{code}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Ingredients */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm text-slate-700 dark:text-slate-400">Ingredients</label>
                            <button
                                onClick={() => setShowIngredientPicker(true)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                                <Plus size={14} />
                                Add Ingredient
                            </button>
                        </div>

                        {/* Ingredient Picker */}
                        {showIngredientPicker && (
                            <div className="mb-4 p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                                <div className="relative mb-3">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search raw materials..."
                                        autoFocus
                                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {availableItems.length === 0 ? (
                                        <p className="text-slate-500 text-sm text-center py-4">
                                            No raw materials available
                                        </p>
                                    ) : (
                                        availableItems.slice(0, 10).map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => addIngredient(item)}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center justify-between transition-colors"
                                            >
                                                <span className="text-slate-900 dark:text-white text-sm">{item.name}</span>
                                                <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1">
                                                    <PesoSign size={10} />
                                                    {item.costPerUnit.toFixed(2)}/{item.units.recipeUnit}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <button
                                    onClick={() => { setShowIngredientPicker(false); setSearchQuery(''); }}
                                    className="mt-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Ingredient List */}
                        {ingredients.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                                <p className="text-slate-500">No ingredients added yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Column Headers */}
                                <div className="flex items-center gap-2 px-3 pb-1">
                                    <div className="flex-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ingredient</div>
                                    <div className="w-20 text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Qty</div>
                                    <div className="w-24 text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Unit</div>
                                    <div className="w-20 text-xs font-semibold text-orange-400 uppercase tracking-wide text-center">Wastage %</div>
                                    <div className="w-24 text-xs font-semibold text-orange-400 uppercase tracking-wide text-right">Waste Cost</div>
                                    <div className="w-24 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Ing. Cost</div>
                                    <div className="w-6" />
                                </div>
                                {ingredients.map((ing, index) => (
                                    <div
                                        key={ing.inventoryItemId}
                                        className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800"
                                    >
                                        {/* Name */}
                                        <div className="flex-1 text-slate-900 dark:text-white font-medium text-sm">
                                            {ing.inventoryItemName}
                                            {(ing.wastagePercent ?? 0) > 0 && (
                                                <span className="ml-2 text-xs text-orange-500 dark:text-orange-400 font-normal">
                                                    {ing.wastagePercent}% waste
                                                </span>
                                            )}
                                        </div>
                                        {/* Qty */}
                                        <input
                                            type="number"
                                            value={ing.quantity}
                                            onChange={(e) => updateIngredient(index, parseFloat(e.target.value) || 0, ing.unit)}
                                            min="0.01"
                                            step="0.1"
                                            className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm text-center focus:outline-none focus:border-amber-500"
                                        />
                                        {/* Unit */}
                                        <select
                                            value={ing.unit}
                                            onChange={(e) => updateIngredient(index, ing.quantity, e.target.value)}
                                            className="w-24 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500"
                                        >
                                            {UOM_CODES.map(code => (
                                                <option key={code} value={code}>{code}</option>
                                            ))}
                                        </select>
                                        {/* Wastage % */}
                                        <div className="w-20 flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={ing.wastagePercent === undefined ? '' : ing.wastagePercent}
                                                onChange={(e) => {
                                                    const rawVal = e.target.value;
                                                    const val = rawVal === '' ? undefined : parseFloat(rawVal);
                                                    updateWastagePercent(index, val === undefined ? undefined : Math.min(100, Math.max(0, val)));
                                                }}
                                                min="0"
                                                max="100"
                                                step="1"
                                                title="Expected prep-loss percentage (e.g. 10 for 10%)"
                                                placeholder=""
                                                className="w-14 px-2 py-1 bg-white dark:bg-slate-700 border border-orange-300 dark:border-orange-500/50 rounded text-slate-900 dark:text-white text-sm text-center focus:outline-none focus:border-orange-500"
                                            />
                                            <span className="text-xs text-orange-400 font-semibold">%</span>
                                        </div>
                                        {/* Wastage cost */}
                                        {(() => {
                                            const wPct = ing.wastagePercent ?? 0;
                                            const wCost = wPct > 0 ? (wPct / 100) * ing.totalCost : 0;
                                            return (
                                                <div className="w-24 text-right text-orange-500 dark:text-orange-400 text-sm flex items-center justify-end gap-1">
                                                    {wCost > 0 ? (
                                                        <><PesoSign size={12} />{wCost.toFixed(2)}</>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-600">—</span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        {/* Ingredient cost */}
                                        <div className="w-24 text-right text-amber-600 dark:text-amber-400 text-sm flex items-center justify-end gap-1">
                                            <PesoSign size={12} />
                                            {ing.totalCost.toFixed(2)}
                                        </div>
                                        <button
                                            onClick={() => removeIngredient(index)}
                                            className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cost Summary */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Ingredient Cost</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1">
                                    <PesoSign size={18} />
                                    {totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-orange-600 dark:text-orange-400 mb-1">Wastage Cost</p>
                                <p className="text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1">
                                    <PesoSign size={18} />
                                    {totalWastageCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="border-l border-amber-200 dark:border-amber-500/30 pl-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Cost per {yieldUnit}</p>
                                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                                    <PesoSign size={18} />
                                    {costPerUnit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                        {totalWastageCost > 0 && (
                            <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-500/30 flex items-center justify-between">
                                <span className="text-xs text-slate-500">Total true cost (incl. wastage)</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                    <PesoSign size={14} />
                                    {totalTrueCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !name.trim() || ingredients.length === 0}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : (recipe ? 'Update Recipe' : 'Create Recipe')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductionRecipeModal;
