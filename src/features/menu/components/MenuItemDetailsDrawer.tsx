import { X, ChefHat, AlertCircle, Package } from 'lucide-react';
import { getFoodCostColor, getFoodCostBgColor, getFoodCostStatus } from '../types/menu.types';
import type { MenuItem } from '../types/menu.types';
import PesoSign from '../../../shared/components/PesoSign';

interface MenuItemDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    menuItem: MenuItem | null;
}

const MenuItemDetailsDrawer: React.FC<MenuItemDetailsDrawerProps> = ({
    isOpen,
    onClose,
    menuItem
}) => {
    if (!menuItem) return null;

    const status = getFoodCostStatus(menuItem.foodCostPercent);
    const costColor = getFoodCostColor(status);
    const costBg = getFoodCostBgColor(status);

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div className={`fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ChefHat className="text-purple-600 dark:text-purple-400" size={24} />
                            Recipe Details
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {menuItem.category}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="h-[calc(100vh-80px)] overflow-y-auto p-6 space-y-8">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{menuItem.name}</h3>
                        {menuItem.description && (
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                {menuItem.description}
                            </p>
                        )}
                        {menuItem.imageUrl && (
                            <div className="mt-4 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                                <img src={menuItem.imageUrl} alt={menuItem.name} className="w-full h-48 object-cover" />
                            </div>
                        )}
                    </div>

                    {/* Financial Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Selling Price</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                                <PesoSign size={16} className="mr-1" />
                                {menuItem.sellingPrice.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Recipe Cost</p>
                            <p className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-center">
                                <PesoSign size={16} className="mr-1" />
                                {menuItem.calculatedCost.toFixed(2)}
                            </p>
                        </div>
                        <div className={`p-4 rounded-xl border ${costBg}`}>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Food Cost %</p>
                            <p className={`text-xl font-bold ${costColor} flex items-center gap-2`}>
                                {menuItem.foodCostPercent.toFixed(1)}%
                                {status === 'warning' && <AlertCircle size={16} />}
                            </p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">Gross Margin</p>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                                <PesoSign size={16} className="mr-1" />
                                {menuItem.grossMargin.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Ingredients List */}
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Package size={20} className="text-indigo-500" />
                            Ingredients Breakdown
                        </h4>
                        <div className="space-y-3">
                            {menuItem.ingredients.map((ingredient, index) => (
                                <div key={`${ingredient.inventoryItemId}-${index}`} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-colors">
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {ingredient.inventoryItemName}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {ingredient.quantity} {ingredient.unit}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-slate-700 dark:text-slate-300 flex items-center justify-end">
                                            <PesoSign size={12} className="mr-1" />
                                            {ingredient.totalCost.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            ₱{ingredient.costPerBaseUnit.toFixed(2)} / base unit
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {menuItem.ingredients.length === 0 && (
                                <div className="text-center py-8 text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    No ingredients added yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Footer */}
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                            <span>Last Updated</span>
                            <span>
                                {menuItem.updatedAt?.toDate().toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MenuItemDetailsDrawer;
