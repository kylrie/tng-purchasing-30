import React, { useState } from 'react';
import { Search, ShieldCheck, ChevronRight } from 'lucide-react';
import type { BlackBookRecipe } from '../types/blackbook.types';

interface BlackBookSidebarProps {
    recipes: BlackBookRecipe[];
    selectedRecipeId: string | null;
    onSelectRecipe: (recipe: BlackBookRecipe) => void;
}

const BlackBookSidebar: React.FC<BlackBookSidebarProps> = ({
    recipes,
    selectedRecipeId,
    onSelectRecipe
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecipes = recipes.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.prepStation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.ingredients?.some(i => i.inventoryItemName.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <aside className="w-72 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-[#e8e0d4] dark:border-slate-700 flex flex-col h-full overflow-hidden">
            {/* Search */}
            <div className="p-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search recipe, ingredient, station"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#faf8f5] dark:bg-slate-700 border border-[#e8e0d4] dark:border-slate-600 rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                </div>
            </div>

            {/* Menu Header */}
            <div className="px-4 pb-2">
                <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Menu Black Book</h3>
            </div>

            {/* Recipe List */}
            <div className="flex-1 overflow-y-auto px-2 space-y-1">
                {filteredRecipes.map(recipe => (
                    <button
                        key={recipe.id}
                        onClick={() => onSelectRecipe(recipe)}
                        className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 group ${
                            selectedRecipeId === recipe.id
                                ? 'bg-[#2c2520] dark:bg-amber-900/30 text-white dark:text-amber-100 shadow-md'
                                : 'hover:bg-[#f5f0e8] dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm truncate">{recipe.name}</span>
                            <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${
                                selectedRecipeId === recipe.id ? 'text-amber-400' : 'text-slate-400 opacity-0 group-hover:opacity-100'
                            }`} />
                        </div>
                        <div className={`text-xs mt-1 ${selectedRecipeId === recipe.id ? 'text-amber-200 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            {recipe.prepStation} · {recipe.version} · {recipe.approvalStatus}
                        </div>
                    </button>
                ))}
                {filteredRecipes.length === 0 && (
                    <div className="text-center text-sm text-slate-400 py-8">No recipes found</div>
                )}
            </div>

            {/* Protection Rules Card */}
            <div className="p-4 border-t border-[#e8e0d4] dark:border-slate-700">
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3">Protection Rules</h4>
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" /> Owners/Admin can edit</div>
                    <div className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" /> Kitchen staff can only view</div>
                    <div className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" /> All changes create a version</div>
                    <div className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" /> Only approved recipes go live</div>
                    <div className="flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" /> Training video required before deployment</div>
                </div>
            </div>
        </aside>
    );
};

export default BlackBookSidebar;
