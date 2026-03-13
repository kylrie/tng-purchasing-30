import React, { useState } from 'react';
import type { MenuItem } from '../../menu/types/menu.types';
import { MENU_CATEGORIES } from '../../menu/types/menu.types';
import { Search } from 'lucide-react';

interface ProductGridProps {
    menuItems: MenuItem[];
    isLoading: boolean;
    onAddItem: (item: MenuItem) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ menuItems, isLoading, onAddItem }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('All');

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    if (isLoading) {
        return (
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-slate-500 font-medium animate-pulse">Loading products...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-[#0B1120] border-r border-slate-200/60 dark:border-slate-800/80 backdrop-blur-3xl relative z-0">
            {/* Top Bar - Search & Categories */}
            <div className="p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-10">
                <div className="relative mb-5 max-w-2xl mx-auto md:mx-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-800 transition-all duration-300 shadow-sm"
                    />
                </div>

                {/* Categories */}
                <div className="flex overflow-x-auto pb-2 gap-2.5 scrollbar-hide -mx-2 px-2 mask-linear-fade">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 transform active:scale-95 ${activeCategory === 'All'
                            ? 'bg-indigo-600 text-white shadow-[0_4px_14px_rgba(79,70,229,0.3)] ring-2 ring-indigo-600/20 ring-offset-2 dark:ring-offset-slate-900'
                            : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60 shadow-sm'
                            }`}
                    >
                        All Items
                    </button>
                    {MENU_CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 transform active:scale-95 ${activeCategory === category
                                ? 'bg-indigo-600 text-white shadow-[0_4px_14px_rgba(79,70,229,0.3)] ring-2 ring-indigo-600/20 ring-offset-2 dark:ring-offset-slate-900'
                                : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60 shadow-sm'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 auto-rows-max">
                    {filteredItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onAddItem(item)}
                            className="group relative bg-white dark:bg-slate-900 rounded-[1.25rem] p-4 md:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-indigo-500/30 active:scale-[0.97] transition-all duration-300 text-left flex flex-col h-[180px] overflow-hidden"
                        >
                            {/* Subtle gradient background effect on hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-transparent dark:from-indigo-900/0 opacity-0 group-hover:opacity-100 group-hover:from-indigo-50/50 dark:group-hover:from-indigo-500/5 transition-opacity duration-300 ease-in-out pointer-events-none" />

                            <div className="flex-1 relative z-10 w-full">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-3 text-sm md:text-base leading-snug group-hover:text-indigo-900 dark:group-hover:text-indigo-300 transition-colors duration-300">
                                    {item.name}
                                </h3>
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-wider">
                                    {item.category}
                                </p>
                            </div>
                            <div className="mt-auto pt-4 relative z-10 w-full flex items-end justify-between">
                                <div className="font-black text-indigo-600 dark:text-indigo-400 text-lg md:text-xl tracking-tight">
                                    ₱{item.sellingPrice.toFixed(2)}
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 text-indigo-600 dark:text-indigo-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20 px-4">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Search className="text-slate-400" size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No products found</h3>
                        <p className="text-slate-500 max-w-sm">
                            We couldn't find anything matching "{searchQuery}" in {activeCategory === 'All' ? 'all categories' : `the ${activeCategory} category`}.
                        </p>
                        <button
                            onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                            className="mt-6 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductGrid;
