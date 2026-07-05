import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { KpiItem } from './types';

const KpiCard: React.FC<{ kpi: KpiItem }> = ({ kpi }) => {
  const Icon = kpi.icon;
  const isHighVariance = kpi.isVariance && (kpi.variancePercent ?? 0) > 5;

  return (
    <div className={`relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 hover:shadow-2xl hover:shadow-purple-500/10 dark:hover:shadow-purple-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden group ${isHighVariance ? 'ring-1 ring-red-500/50 border-red-500/30' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-slate-800/40 dark:to-slate-900/0 pointer-events-none" />

      <div className="p-6 relative z-10">
        {/* Icon + label */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} dark:bg-opacity-20 flex items-center justify-center shadow-inner`}>
              <Icon size={20} className={kpi.iconColor} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{kpi.label}</p>
          </div>
        </div>

        {/* Value */}
        <div className="flex items-end gap-2">
          <p className={`text-3xl font-black tracking-tighter ${isHighVariance ? 'text-transparent bg-clip-text bg-gradient-to-br from-red-600 to-rose-500 dark:from-red-400 dark:to-rose-400' : 'text-slate-900 dark:text-white'}`}>
            {kpi.value}
          </p>
        </div>

        {/* Subtext */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">{kpi.subtext}</p>

        {/* Investigate label for high variance */}
        {isHighVariance && (
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100/50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 backdrop-blur-md animate-pulse">
            <ShieldAlert size={14} className="text-red-600 dark:text-red-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Investigate Now</span>
          </div>
        )}
      </div>

      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${isHighVariance ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-purple-500/50 to-cyan-500/50'} opacity-80`} />
    </div>
  );
};

export const KpiCards: React.FC<{ kpis: KpiItem[] }> = ({ kpis }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
    {kpis.map((kpi) => (
      <KpiCard key={kpi.id} kpi={kpi} />
    ))}
  </div>
);
