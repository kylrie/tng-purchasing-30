import React, { useState, useEffect } from 'react';
import {
    ChefHat, Plus, Search, TrendingUp, Loader2,
    Edit, Trash2, RefreshCw, Filter, ShieldAlert
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { MenuItem, MenuCategory } from '../types/menu.types';
import {
    MENU_CATEGORIES,
    getFoodCostStatus,
    getFoodCostColor,
    getFoodCostBgColor
} from '../types/menu.types';
import { RecipesService } from '../services/recipes.service';
import RecipeEditor from '../components/RecipeEditor';
import MenuItemDetailsDrawer from '../components/MenuItemDetailsDrawer';
import type { Business, User } from '../../procurement/types';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';

// ============================================================
// PROPS
// ============================================================

interface MenuDashboardProps {
    businesses: Business[];
    currentUser?: User;
}

// ============================================================
// MENU ITEM CARD COMPONENT
// ============================================================

const MenuItemCard: React.FC<{
    item: MenuItem;
    onEdit: () => void;
    onDelete: () => void;
    onClick: () => void;
}> = ({ item, onEdit, onDelete, onClick }) => {
    const status = getFoodCostStatus(item.foodCostPercent);
    const textColor = getFoodCostColor(status);
    const bgColor = getFoodCostBgColor(status);

    return (
        <div
            className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500/50 transition-all p-4 shadow-sm dark:shadow-none cursor-pointer group"
            onClick={onClick}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{item.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.category}</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded transition-colors"
                        title="Edit recipe"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 rounded transition-colors"
                        title="Delete recipe"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Description */}
            {item.description && (
                <p className="text-sm text-slate-500 dark:text-slate-500 mb-4 line-clamp-2">{item.description}</p>
            )}

            {/* Prices & Costs */}
            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Selling Price</span>
                    <span className="text-slate-900 dark:text-white font-medium">₱{item.sellingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Recipe Cost</span>
                    <span className="text-slate-700 dark:text-slate-300">₱{item.calculatedCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <TrendingUp size={12} />
                        Gross Margin
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-medium">₱{item.grossMargin.toFixed(2)}</span>
                </div>
            </div>

            {/* Margin Badge */}
            <div className={`flex items-center justify-between p-2 rounded-lg border ${bgColor}`}>
                <div className="flex items-center gap-2">
                    <PesoSign size={14} className={textColor} />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Food Cost</span>
                </div>
                <span className={`font-bold ${textColor}`}>
                    {item.foodCostPercent.toFixed(1)}%
                </span>
            </div>

            {/* Ingredients Count */}
            <div className="mt-3 text-xs text-slate-500 text-center">
                {item.ingredients.length} ingredient{item.ingredients.length !== 1 ? 's' : ''}
            </div>
        </div>
    );
};

// ============================================================
// MAIN MENU DASHBOARD COMPONENT
// ============================================================

const MenuDashboard: React.FC<MenuDashboardProps> = ({
    businesses
}) => {
    // Data state
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const { selectedBusinessUnit } = useBusinessUnit();

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<MenuCategory | 'ALL'>('ALL');
    const [showEditor, setShowEditor] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [viewingItem, setViewingItem] = useState<MenuItem | null>(null);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);

    // Load menu items
    const loadMenuItems = async () => {
        if (!selectedBusinessUnit) return;

        setIsLoading(true);
        try {
            console.log(`[MenuDashboard] Loading menu items for BU ${selectedBusinessUnit}...`);
            const items = await RecipesService.getMenuItems(selectedBusinessUnit);
            console.log(`[MenuDashboard] Loaded ${items.length} menu items.`);
            setMenuItems(items);
        } catch (error) {
            console.error('Error loading menu items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMenuItems();
    }, [selectedBusinessUnit]);

    // Filter items
    const filteredItems = menuItems.filter(item => {
        const matchesSearch = searchQuery === '' ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    // Group by category for summary
    const categoryStats = menuItems.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = { count: 0, totalMargin: 0 };
        }
        acc[item.category].count++;
        acc[item.category].totalMargin += item.grossMargin;
        return acc;
    }, {} as Record<string, { count: number; totalMargin: number }>);

    // Handle add new
    const handleAddNew = () => {
        setEditingItem(null);
        setShowEditor(true);
    };

    // Handle edit
    const handleEdit = (item: MenuItem) => {
        setEditingItem(item);
        setShowEditor(true);
    };

    // Handle delete
    const handleDelete = async (item: MenuItem) => {
        if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

        try {
            await RecipesService.deleteMenuItem(item.id);
            await loadMenuItems();
        } catch (error) {
            console.error('Error deleting menu item:', error);
        }
    };

    // Handle recalculate all costs
    const handleRecalculateAll = async () => {
        if (!confirm('Recalculate costs for all menu items based on current inventory prices?')) return;

        setIsRecalculating(true);
        try {
            const updated = await RecipesService.recalculateAllCosts(selectedBusinessUnit);
            alert(`Updated costs for ${updated} menu items`);
            await loadMenuItems();
        } catch (error) {
            console.error('Error recalculating costs:', error);
        } finally {
            setIsRecalculating(false);
        }
    };

    // Handle migrating legacy recipes
    const handleMigrateRecipes = async () => {
        if (!confirm('Run one-time migration to sync all existing MenuItem recipes to the Inventory system?')) return;

        setIsMigrating(true);
        try {
            const resultMsg = await RecipesService.migrateExistingRecipes(selectedBusinessUnit);
            alert(resultMsg);
        } catch (error: any) {
            console.error('Error migrating recipes:', error);
            alert('Error migrating recipes: ' + error.message);
        } finally {
            setIsMigrating(false);
        }
    };

    // Stats
    const totalItems = menuItems.length;
    const avgFoodCost = totalItems > 0
        ? menuItems.reduce((sum, item) => sum + item.foodCostPercent, 0) / totalItems
        : 0;
    const avgMargin = totalItems > 0
        ? menuItems.reduce((sum, item) => sum + item.grossMargin, 0) / totalItems
        : 0;

    const currentBusiness = businesses.find(b => b.id === selectedBusinessUnit);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ChefHat className="text-purple-600 dark:text-purple-400" />
                        Menu Engineering
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Recipe builder and cost analysis
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Recalculate Button */}
                    <button
                        onClick={handleRecalculateAll}
                        disabled={isRecalculating}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                        title="Recalculate all costs from current inventory prices"
                    >
                        <RefreshCw size={16} className={isRecalculating ? 'animate-spin' : ''} />
                        Recalculate
                    </button>

                    {/* Sync Legacy Recipes Button (Dev Tool) */}
                    <button
                        onClick={handleMigrateRecipes}
                        disabled={isMigrating}
                        className="px-4 py-2 bg-orange-100 dark:bg-orange-500/20 hover:bg-orange-200 dark:hover:bg-orange-500/30 text-orange-700 dark:text-orange-400 rounded-xl flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                        title="One-time sync of legacy recipes to Inventory"
                    >
                        <ShieldAlert size={16} className={isMigrating ? 'animate-spin' : ''} />
                        Sync Legacy Recipes
                    </button>

                    {/* Add New Button */}
                    <button
                        onClick={handleAddNew}
                        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        New Recipe
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Total Items</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalItems}</p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Avg Food Cost</p>
                    <p className={`text-2xl font-bold ${getFoodCostColor(getFoodCostStatus(avgFoodCost))}`}>
                        {avgFoodCost.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Avg Margin</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">₱{avgMargin.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Categories</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{Object.keys(categoryStats).length}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search menu items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-500 dark:text-slate-400" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as MenuCategory | 'ALL')}
                        className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                    >
                        <option value="ALL">All Categories</option>
                        {MENU_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Menu Items Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <Loader2 size={32} className="text-purple-400 animate-spin mx-auto mb-4" />
                        <p className="text-slate-400">Loading menu items...</p>
                    </div>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <ChefHat size={48} className="mx-auto text-slate-400 dark:text-slate-500 mb-4" />
                    <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">
                        {menuItems.length === 0 ? 'No recipes yet' : 'No matching items'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        {menuItems.length === 0
                            ? `Create your first recipe for ${currentBusiness?.name || 'this location'}`
                            : 'Try adjusting your search or filters'}
                    </p>
                    {menuItems.length === 0 && (
                        <button
                            onClick={handleAddNew}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 inline-flex items-center gap-2"
                        >
                            <Plus size={18} />
                            Create Recipe
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredItems.map(item => (
                        <MenuItemCard
                            key={item.id}
                            item={item}
                            onEdit={() => handleEdit(item)}
                            onDelete={() => handleDelete(item)}
                            onClick={() => setViewingItem(item)}
                        />
                    ))}
                </div>
            )}

            {/* Recipe Editor Modal */}
            <RecipeEditor
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                onSave={loadMenuItems}
                menuItem={editingItem}
                businessUnitId={selectedBusinessUnit}
            />

            {/* Details Drawer */}
            <MenuItemDetailsDrawer
                isOpen={!!viewingItem}
                onClose={() => setViewingItem(null)}
                menuItem={viewingItem}
            />
        </div>
    );
};

export default MenuDashboard;
