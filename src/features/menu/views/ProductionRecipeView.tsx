import React, { useState, useEffect } from 'react';
import {
    Factory,
    Plus,
    Search,
    Loader2,
    Building2,
    Edit,
    Trash2,
    Package
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { ProductionRecipe } from '../types/menu.types';
import { ProductionRecipeService } from '../services/production-recipe.service';
import ProductionRecipeModal from '../components/ProductionRecipeModal';
import type { Business, User } from '../../procurement/types';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import { InventoryService } from '../../inventory/services/inventory.service';

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
    onEdit: (recipe: ProductionRecipe) => void;
    onDelete: (recipe: ProductionRecipe) => void;
}> = ({ recipe, onEdit, onDelete }) => {
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-amber-500/50 transition-all">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Factory size={20} className="text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{recipe.name}</h3>
                        <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            {recipe.category}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onEdit(recipe)}
                        className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={() => onDelete(recipe)}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Yield Info */}
            <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                <p className="text-xs text-slate-500 mb-1">Yield</p>
                <p className="text-lg font-bold text-white">
                    {recipe.yieldQuantity} {recipe.yieldUnit}
                </p>
            </div>

            {/* Cost Info */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Cost</p>
                    <p className="text-sm font-medium text-white flex items-center justify-center gap-1">
                        <PesoSign size={14} />
                        {recipe.calculatedCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Cost/Unit</p>
                    <p className="text-sm font-medium text-amber-400 flex items-center justify-center gap-1">
                        <PesoSign size={14} />
                        {recipe.costPerUnit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Ingredients count */}
            <div className="mt-3 pt-3 border-t border-slate-700">
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

const ProductionRecipeView: React.FC<ProductionRecipeViewProps> = ({ businesses }) => {
    // State
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(
        businesses.length > 0 ? businesses[0].id : ''
    );
    const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<ProductionRecipe | null>(null);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            if (!selectedBusinessUnit) return;

            setIsLoading(true);
            try {
                const [fetchedRecipes, fetchedItems] = await Promise.all([
                    ProductionRecipeService.getRecipes(selectedBusinessUnit),
                    InventoryService.getInventory(selectedBusinessUnit, 'RAW_MATERIAL')
                ]);
                setRecipes(fetchedRecipes);
                setInventoryItems(fetchedItems);
            } catch (err) {
                console.error('Error loading production recipes:', err);
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
        setShowModal(false);
        setEditingRecipe(null);
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
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <Factory className="text-amber-400" />
                        Production Recipes
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Create recipes for production items (syrups, mixes, prep items)
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleAddNew}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        <Plus size={18} />
                        New Recipe
                    </button>

                    {/* Business Unit Selector */}
                    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                        <Building2 size={16} className="text-slate-400" />
                        <select
                            value={selectedBusinessUnit}
                            onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                            className="bg-transparent text-white focus:outline-none text-sm"
                        >
                            {businesses.map(bu => (
                                <option key={bu.id} value={bu.id} className="bg-slate-800">
                                    {bu.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search recipes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Total Recipes</p>
                    <p className="text-2xl font-bold text-white">{recipes.length}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Categories Used</p>
                    <p className="text-2xl font-bold text-amber-400">
                        {new Set(recipes.map(r => r.category)).size}
                    </p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Avg Cost/Recipe</p>
                    <p className="text-2xl font-bold text-white flex items-center gap-1">
                        <PesoSign size={20} />
                        {recipes.length > 0
                            ? (recipes.reduce((sum, r) => sum + r.calculatedCost, 0) / recipes.length).toFixed(2)
                            : '0.00'
                        }
                    </p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Raw Materials</p>
                    <p className="text-2xl font-bold text-blue-400">{inventoryItems.length}</p>
                </div>
            </div>

            {/* Recipes Grid */}
            {filteredRecipes.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700">
                    <Package size={48} className="mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400 mb-4">
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
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <ProductionRecipeModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingRecipe(null); }}
                onSave={handleSave}
                recipe={editingRecipe}
                businessUnitId={selectedBusinessUnit}
                inventoryItems={inventoryItems}
            />
        </div>
    );
};

export default ProductionRecipeView;
