import React, { useState } from 'react';
import type { MenuItem } from '../../menu/types/menu.types';
import { MENU_CATEGORIES } from '../../menu/types/menu.types';
import { Search, Sparkles } from 'lucide-react';

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
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-[#020203]">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-xl bg-indigo-500/30 animate-pulse"></div>
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-r-2 border-indigo-400 relative z-10"></div>
                </div>
                <p className="text-indigo-200/50 font-medium animate-pulse mt-6 tracking-widest text-xs uppercase">Initializing UI</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#020203] relative z-0 overflow-hidden selection:bg-indigo-500/30">
            {/* Ultra-Premium Ambient Background (Nebula) */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-900/20 via-purple-900/10 to-transparent blur-[120px] -z-10 pointer-events-none rounded-full transform -translate-y-1/2 transition-all duration-[10000ms] ease-in-out hover:scale-110"></div>
            <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-gradient-to-tl from-blue-900/10 via-transparent to-transparent blur-[150px] -z-10 pointer-events-none rounded-full transform translate-y-1/3 translate-x-1/3 transition-all duration-[10000ms] ease-in-out hover:scale-110 hidden md:block"></div>

            {/* Top Bar - Search & Categories */}
            <div className="pt-6 pb-4 px-6 relative z-10">
                <div className="relative mb-6 max-w-2xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-md opacity-0 transition-opacity duration-500 focus-within:opacity-100"></div>
                    <div className="relative flex items-center group">
                        <Search className="absolute left-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors duration-500" size={18} strokeWidth={2.5} />
                        <input
                            type="text"
                            placeholder="Find extraordinary products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl text-slate-200 placeholder-slate-600 focus:outline-none focus:bg-white/[0.04] focus:border-indigo-500/40 transition-all duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] text-sm tracking-wide font-medium"
                        />
                        <div className="absolute right-4 px-2 py-1 rounded bg-white/[0.05] text-[10px] text-slate-400 border border-white/[0.05] pointer-events-none tracking-widest font-mono hidden sm:block">⌘K</div>
                    </div>
                </div>

                {/* Categories */}
                <div className="flex overflow-x-auto pb-2 gap-3 scrollbar-hide mask-linear-fade">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`relative whitespace-nowrap px-6 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-500 overflow-hidden group ${activeCategory === 'All'
                            ? 'text-white'
                            : 'text-slate-400 hover:text-slate-200 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05]'
                            }`}
                    >
                        {activeCategory === 'All' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90"></div>
                        )}
                        {activeCategory === 'All' && (
                            <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/40 to-transparent mix-blend-overlay"></div>
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            {activeCategory === 'All' && <Sparkles size={14} className="text-indigo-200" />}
                            All
                        </span>
                        {activeCategory === 'All' && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-white blur-sm"></div>
                        )}
                    </button>
                    {MENU_CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`relative whitespace-nowrap px-6 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-500 overflow-hidden ${activeCategory === category
                                ? 'text-white'
                                : 'text-slate-400 hover:text-slate-200 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05]'
                                }`}
                        >
                            {activeCategory === category && (
                                <div className="absolute inset-0 bg-white/[0.1] backdrop-blur-md border border-white/[0.2]"></div>
                            )}
                            {activeCategory === category && (
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20"></div>
                            )}
                            <span className="relative z-10">{category}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 z-10 scrollbar-hide">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 md:gap-6 auto-rows-max">
                    {filteredItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onAddItem(item)}
                            className="group relative rounded-3xl text-left flex flex-col h-[180px] md:h-[200px] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020203] hover:-translate-y-2 hover:scale-[1.03]"
                        >
                            {/* Card Background & Borders */}
                            <div className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.05] rounded-3xl overflow-hidden group-hover:bg-white/[0.04] transition-colors duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                                {/* Top highlight border */}
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                            </div>

                            {/* Hover Reveal Mesh */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none overflow-hidden rounded-3xl">
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/30 rounded-full blur-[40px] transform group-hover:translate-x-5 group-hover:translate-y-5 transition-transform duration-1000 ease-out"></div>
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-[40px] transform group-hover:-translate-x-5 group-hover:-translate-y-5 transition-transform duration-1000 ease-out"></div>
                            </div>

                            <div className="flex-1 relative z-10 w-full p-4 md:p-5 flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">
                                        {item.category}
                                    </p>
                                </div>
                                <h3 className="font-semibold text-slate-300 text-sm md:text-base leading-snug group-hover:text-white transition-colors duration-300 drop-shadow-sm line-clamp-3">
                                    {item.name}
                                </h3>

                                <div className="mt-auto relative w-full flex items-end justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-600 font-medium tracking-widest uppercase mb-0.5">Price</span>
                                        <div className="font-bold text-slate-200 text-lg md:text-xl tracking-tighter group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-300 group-hover:to-purple-300 transition-all duration-300">
                                            <span className="text-zinc-600 mr-1 text-sm md:text-base group-hover:text-indigo-400/50 transition-colors">₱</span>
                                            {item.sellingPrice.toFixed(2)}
                                        </div>
                                    </div>

                                    {/* Liquid Action Button */}
                                    <div className="relative w-8 h-8 md:w-10 md:h-10">
                                        <div className="absolute inset-0 rounded-full bg-indigo-500 blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
                                        <div className="absolute inset-0 rounded-full bg-white/[0.05] border border-white/[0.05] flex items-center justify-center group-hover:bg-indigo-500 group-hover:border-indigo-400/50 transition-colors duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-white transition-colors duration-500 transform group-hover:scale-110 relative z-10"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center py-20 px-4 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-transparent to-transparent blur-3xl -z-10"></div>
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-3xl flex items-center justify-center mb-6 transform rotate-3">
                            <Search className="text-slate-600" size={28} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-300 mb-2 tracking-tight">Void of Results</h3>
                        <p className="text-slate-500 max-w-sm text-center text-xs md:text-sm leading-relaxed mb-8">
                            Our deep scan couldn't locate "{searchQuery}" within the {activeCategory === 'All' ? 'entire catalogue' : `bounds of ${activeCategory}`}.
                        </p>
                        <button
                            onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                            className="relative px-8 py-3 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 font-bold tracking-widest text-[10px] md:text-xs uppercase rounded-full border border-white/[0.05] transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:-translate-y-0.5 active:translate-y-0 overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                            <span className="relative z-10">Reset Filters</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductGrid;
