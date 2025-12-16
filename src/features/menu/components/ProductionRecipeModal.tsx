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
import { PRODUCTION_CATEGORIES, UNIT_CONVERSIONS } from '../types/menu.types';
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
    const [yieldUnit, setYieldUnit] = useState('serving');
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
    const [isSaving, setIsSaving] = useState(false);

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
            setYieldUnit('serving');
            setIngredients([]);
        }
    }, [recipe, isOpen]);

    // Calculate total cost
    const totalCost = ingredients.reduce((sum, ing) => sum + ing.totalCost, 0);
    const costPerUnit = yieldQuantity > 0 ? totalCost / yieldQuantity : 0;

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
            unit: item.units.countUnit,
            baseQuantity: 1,
            costPerBaseUnit: item.costPerUnit,
            totalCost: item.costPerUnit
        };
        setIngredients([...ingredients, newIngredient]);
        setShowIngredientPicker(false);
        setSearchQuery('');
    };

    // Update ingredient
    const updateIngredient = (index: number, quantity: number, unit: string) => {
        setIngredients(prev => prev.map((ing, i) => {
            if (i !== index) return ing;

            // Calculate base quantity based on unit conversion
            let baseQuantity = quantity;
            const item = inventoryItems.find(it => it.id === ing.inventoryItemId);
            if (item && unit !== item.units.countUnit) {
                const conversion = UNIT_CONVERSIONS[unit]?.[item.units.countUnit];
                if (conversion) {
                    baseQuantity = quantity * conversion;
                }
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
        if (!name.trim()) {
            alert('Please enter a recipe name');
            return;
        }
        if (ingredients.length === 0) {
            alert('Please add at least one ingredient');
            return;
        }

        setIsSaving(true);
        try {
            const input: CreateProductionRecipeInput = {
                businessUnitId,
                name,
                category,
                description: description || undefined,
                yieldQuantity,
                yieldUnit,
                ingredients: ingredients.map(ing => ({
                    inventoryItemId: ing.inventoryItemId,
                    inventoryItemName: ing.inventoryItemName,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    baseQuantity: ing.baseQuantity,
                    costPerBaseUnit: ing.costPerBaseUnit
                }))
            };

            if (recipe) {
                await ProductionRecipeService.updateRecipe(recipe.id, input);
            } else {
                await ProductionRecipeService.createRecipe(input);
            }

            onSave();
        } catch (err) {
            console.error('Error saving recipe:', err);
            alert('Failed to save recipe');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
                            <Factory size={24} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {recipe ? 'Edit Production Recipe' : 'New Production Recipe'}
                            </h2>
                            <p className="text-sm text-slate-400">
                                Create recipes for production items
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Recipe Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Simple Syrup"
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as ProductionCategory)}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-amber-500"
                            >
                                {PRODUCTION_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-amber-500 resize-none"
                        />
                    </div>

                    {/* Yield */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Yield Quantity</label>
                            <input
                                type="number"
                                value={yieldQuantity}
                                onChange={(e) => setYieldQuantity(parseFloat(e.target.value) || 0)}
                                min="0.01"
                                step="0.1"
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Unit</label>
                            <input
                                type="text"
                                value={yieldUnit}
                                onChange={(e) => setYieldUnit(e.target.value)}
                                placeholder="e.g., ml, kg, serving"
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Ingredients */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm text-slate-400">Ingredients</label>
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
                            <div className="mb-4 p-4 bg-slate-900/50 rounded-xl border border-slate-600">
                                <div className="relative mb-3">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search raw materials..."
                                        autoFocus
                                        className="w-full pl-9 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
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
                                                className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg flex items-center justify-between transition-colors"
                                            >
                                                <span className="text-white text-sm">{item.name}</span>
                                                <span className="text-slate-400 text-xs flex items-center gap-1">
                                                    <PesoSign size={10} />
                                                    {item.costPerUnit.toFixed(2)}/{item.units.countUnit}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <button
                                    onClick={() => { setShowIngredientPicker(false); setSearchQuery(''); }}
                                    className="mt-2 text-sm text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Ingredient List */}
                        {ingredients.length === 0 ? (
                            <div className="text-center py-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-600">
                                <p className="text-slate-500">No ingredients added yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {ingredients.map((ing, index) => (
                                    <div
                                        key={ing.inventoryItemId}
                                        className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl"
                                    >
                                        <div className="flex-1 text-white font-medium text-sm">
                                            {ing.inventoryItemName}
                                        </div>
                                        <input
                                            type="number"
                                            value={ing.quantity}
                                            onChange={(e) => updateIngredient(index, parseFloat(e.target.value) || 0, ing.unit)}
                                            min="0.01"
                                            step="0.1"
                                            className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center"
                                        />
                                        <input
                                            type="text"
                                            value={ing.unit}
                                            onChange={(e) => updateIngredient(index, ing.quantity, e.target.value)}
                                            className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center"
                                        />
                                        <div className="w-24 text-right text-amber-400 text-sm flex items-center justify-end gap-1">
                                            <PesoSign size={12} />
                                            {ing.totalCost.toFixed(2)}
                                        </div>
                                        <button
                                            onClick={() => removeIngredient(index)}
                                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cost Summary */}
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Total Cost</p>
                                <p className="text-2xl font-bold text-white flex items-center justify-center gap-1">
                                    <PesoSign size={20} />
                                    {totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Cost per {yieldUnit}</p>
                                <p className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-1">
                                    <PesoSign size={20} />
                                    {costPerUnit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
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
