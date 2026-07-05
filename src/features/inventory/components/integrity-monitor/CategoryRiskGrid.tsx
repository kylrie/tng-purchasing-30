import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { CategoryRisk } from './types';

const CategoryRiskCard: React.FC<{ category: CategoryRisk }> = ({ category }) => {
  const Icon = category.icon;

  const borderColor =
    category.variance > 5 ? 'from-red-500 to-rose-600' :
      category.variance >= 2 ? 'from-amber-400 to-orange-500' :
        'from-emerald-400 to-teal-500';

  const pillBg =
    category.variance > 5 ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' :
      category.variance >= 2 ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
        'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';

  return (
    <div className={`relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg shadow-slate-200/20 dark:shadow-black/20 hover:shadow-xl hover:shadow-purple-500/5 dark:hover:shadow-purple-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden group`}>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${borderColor} opacity-80`} />

      <div className="p-5 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
              <Icon size={20} className="text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">{category.name}</h3>
          </div>
          <span className={`text-[11px] font-black tracking-widest px-3 py-1 rounded-lg border ${pillBg} backdrop-blur-md`}>
            {category.variance.toFixed(1)}%
          </span>
        </div>

        {/* 2x2 data grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-700/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sales</p>
            <p className="text-sm font-black text-slate-800 dark:text-white mt-1">{category.sales}</p>
          </div>
          <div className="bg-red-50/50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-500/80 dark:text-red-400/80">Loss</p>
            <p className="text-sm font-black text-red-600 dark:text-red-400 mt-1">{category.loss}</p>
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-700/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Expected</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{category.expected}</p>
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-700/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Actual</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{category.actual}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CategoryRiskGrid: React.FC<{ categories: CategoryRisk[] }> = ({ categories }) => {
  if (!categories || categories.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center backdrop-blur-md shadow-inner">
            <BarChart3 size={22} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Category Risk Panel</h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Variance breakdown by food & beverage category</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 xl:gap-6">
        {categories.map((cat) => (
          <CategoryRiskCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
};
