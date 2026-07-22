import React, { useState } from 'react';
import type { MenuItem } from '../../menu/types/menu.types';
import { MENU_CATEGORIES } from '../../menu/types/menu.types';
import { SERVICE_TYPES } from '../../inventory/types/InventoryItem';
import { Search, Filter, Plus } from 'lucide-react';
import { sortByAvailability, isOutOfStock } from '../utils/menuSort';

interface ProductGridProps {
    menuItems: MenuItem[];
    isLoading: boolean;
    onAddItem: (item: MenuItem) => void;
    sellableStockMap?: Map<string, number>;
}

// QR-Operations design language (light, high-contrast, fast to scan). The POS
// engine (filters, sellable-stock rules, onAddItem) is unchanged — only presentation.
const ProductGrid: React.FC<ProductGridProps> = ({ menuItems, isLoading, onAddItem, sellableStockMap }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = React.useDeferredValue(searchQuery);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [activeServiceType, setActiveServiceType] = useState<string>('All');

    const filteredItems = React.useMemo(() => {
        const matched = menuItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(deferredSearchQuery.toLowerCase());
            const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
            const matchesServiceType = activeServiceType === 'All' || item.serviceType === activeServiceType;
            return matchesSearch && matchesCategory && matchesServiceType;
        });
        // Available items first, out-of-stock last (stable within each group).
        return sortByAvailability(matched, sellableStockMap);
    }, [menuItems, deferredSearchQuery, activeCategory, activeServiceType, sellableStockMap]);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-100">
                <div className="animate-spin rounded-full h-11 w-11 border-b-2 border-slate-900" />
                <p className="mt-4 text-sm font-bold text-slate-500">Loading menu…</p>
            </div>
        );
    }

    const chipCls = (active: boolean): string =>
        `shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-bold border-2 transition-colors ${active
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`;

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
            {/* Search + filters */}
            <div className="px-4 md:px-5 pt-4 pb-3 border-b-2 border-slate-200 bg-white space-y-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2.25} />
                        <input
                            type="text"
                            placeholder="Search products…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-slate-200 bg-white text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:border-slate-400"
                        />
                    </div>

                    {/* Service type filter */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-400">
                            <Filter size={13} strokeWidth={2.5} /> Type
                        </span>
                        <button type="button" onClick={() => setActiveServiceType('All')} className={chipCls(activeServiceType === 'All')}>
                            All
                        </button>
                        {SERVICE_TYPES.map(type => (
                            <button key={type} type="button" onClick={() => setActiveServiceType(type)} className={chipCls(activeServiceType === type)}>
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                    <button type="button" onClick={() => setActiveCategory('All')} className={chipCls(activeCategory === 'All')}>
                        All
                    </button>
                    {MENU_CATEGORIES.map(category => (
                        <button key={category} type="button" onClick={() => setActiveCategory(category)} className={chipCls(activeCategory === category)}>
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {filteredItems.map(item => {
                        const sellableStock = sellableStockMap?.get(item.id);
                        const outOfStock = isOutOfStock(item.id, sellableStockMap);

                        return (
                            <button
                                key={item.id}
                                onClick={() => !outOfStock && onAddItem(item)}
                                disabled={outOfStock}
                                className={`group relative flex flex-col text-left rounded-xl border-2 p-3 min-h-[128px] transition-all outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${outOfStock
                                    ? 'bg-slate-50 border-slate-200 opacity-70 cursor-not-allowed'
                                    : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm active:scale-[0.98]'}`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <p className={`text-[10px] font-black uppercase tracking-wide truncate ${outOfStock ? 'text-slate-400' : 'text-slate-400'}`}>
                                        {item.category}{item.serviceType ? ` · ${item.serviceType}` : ''}
                                    </p>
                                    {outOfStock ? (
                                        <span className="shrink-0 text-[9px] font-black uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
                                            Out of stock
                                        </span>
                                    ) : sellableStock !== undefined && sellableStock > 0 ? (
                                        <span className="shrink-0 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full tabular-nums">
                                            {sellableStock} left
                                        </span>
                                    ) : null}
                                </div>

                                <h3 className={`font-bold text-sm md:text-[15px] leading-snug line-clamp-3 ${outOfStock ? 'text-slate-400' : 'text-slate-900'}`}>
                                    {item.name}
                                </h3>

                                <div className="mt-auto pt-2 flex items-end justify-between">
                                    <div className={`text-lg md:text-xl font-black tabular-nums ${outOfStock ? 'text-slate-400' : 'text-slate-900'}`}>
                                        <span className="text-slate-400 text-sm font-bold mr-0.5">₱</span>{item.sellingPrice.toFixed(2)}
                                    </div>
                                    {!outOfStock && (
                                        <span className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center group-hover:bg-slate-800 transition-colors">
                                            <Plus size={16} strokeWidth={3} />
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {filteredItems.length === 0 && (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center px-4">
                        <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center mb-4">
                            <Search className="text-slate-400" size={24} strokeWidth={2} />
                        </div>
                        <h3 className="text-base font-black text-slate-800">No items found</h3>
                        <p className="mt-1 text-sm text-slate-500 max-w-xs">
                            Nothing matches {searchQuery ? `“${searchQuery}”` : 'these filters'}
                            {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
                            {activeServiceType !== 'All' ? ` · ${activeServiceType}` : ''}.
                        </p>
                        <button
                            type="button"
                            onClick={() => { setSearchQuery(''); setActiveCategory('All'); setActiveServiceType('All'); }}
                            className="mt-4 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-black"
                        >
                            Reset filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(ProductGrid);
