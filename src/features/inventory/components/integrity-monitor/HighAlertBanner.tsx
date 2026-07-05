import React from 'react';
import { AlertTriangle, UserPlus, Mail } from 'lucide-react';

export const HighAlertBanner: React.FC<{ itemsCount: number; topItems: string; totalLoss: number }> = ({ itemsCount, topItems, totalLoss }) => {
  if (itemsCount === 0) return null;
  return (
    <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 dark:bg-red-900/20 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(239,68,68,0.2)] dark:shadow-[0_0_40px_-10px_rgba(239,68,68,0.15)] px-6 py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-400 to-rose-600" />
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="flex items-start sm:items-center gap-4 relative z-10 w-full">
        <div className="mt-1 sm:mt-0 flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/30 flex items-center justify-center animate-pulse-slow">
          <AlertTriangle size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base sm:text-lg font-black text-red-700 dark:text-red-400 leading-tight tracking-tight">
            HIGH ALERT — {topItems}: <span className="font-extrabold text-red-600 dark:text-red-300">₱{totalLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> unexplained loss this period
          </h3>
          <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1 font-medium">
            Variance exceeds 5% threshold. Immediate investigation recommended to prevent further shrinkage.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 flex-shrink-0 w-full xl:w-auto relative z-10 mt-2 xl:mt-0">
        <button className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 border border-transparent shadow-lg shadow-red-500/25 rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95">
          <UserPlus size={16} />
          Assign Now
        </button>
        <button className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-300 bg-white/50 dark:bg-slate-900/50 hover:bg-white/80 dark:hover:bg-slate-800/80 backdrop-blur-md border border-red-200 dark:border-red-500/30 shadow-sm rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95">
          <Mail size={16} />
          Notify
        </button>
      </div>
    </div>
  );
};
