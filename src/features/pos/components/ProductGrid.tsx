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
            <div className="flex-1 p-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
            {/* Top Bar - Search & Categories */}
            <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-shadow"
                    />
                </div>

                {/* Categories */}
                <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === 'All'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                    >
                        All Items
                    </button>
                    {MENU_CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === category
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onAddItem(item)}
                            className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-500/50 active:scale-95 transition-all text-left flex flex-col h-40"
                        >
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                    {item.name}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {item.category}
                                </p>
                            </div>
                            <div className="mt-auto pt-3">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                                    ₱{item.sellingPrice.toFixed(2)}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="text-center text-slate-500 py-12">
                        No products found matching your criteria.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductGrid;
