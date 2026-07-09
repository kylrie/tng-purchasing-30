import React from 'react';
import { Search, ShieldAlert, UserPlus, ClipboardList, TrendingUp } from 'lucide-react';
import type { SuspiciousRow } from './types';

export const SuspiciousItemsTable: React.FC<{
  suspiciousItems: SuspiciousRow[];
  spotCheckRecommendations: SuspiciousRow[];
  onAssign: (row: SuspiciousRow) => void;
}> = ({ suspiciousItems, spotCheckRecommendations, onAssign }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'spot-check' | 'variance'>('spot-check');

  const currentItems = activeTab === 'spot-check' ? spotCheckRecommendations : suspiciousItems;

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return currentItems;
    const q = searchQuery.toLowerCase();
    return currentItems.filter(item => item.item.toLowerCase().includes(q));
  }, [currentItems, searchQuery]);

  const columns = activeTab === 'spot-check'
    ? ['ITEM', 'EXP. USAGE (QTY)', 'UNIT COST', 'USAGE VALUE (₱)', 'ACTION']
    : ['ITEM', 'OPEN', 'RECV', 'SOLD', 'EXP. CLOSE', 'ACT. CLOSE', 'VAR QTY', 'VAR ₱', 'STATUS', 'ACTION'];

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden">
      {/* Table header */}
      <div className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-4 bg-white/40 dark:bg-slate-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center backdrop-blur-md shadow-inner">
              <ClipboardList size={22} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Item Watchlist & Spot Checks</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {activeTab === 'spot-check'
                  ? 'High-exposure raw materials recommended for daily spot counts'
                  : 'Confirmed physical stock take variances requiring investigation'
                }
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-200/30 dark:border-slate-700/30 pt-3 gap-3">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 self-start">
            <button
              onClick={() => setActiveTab('spot-check')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'spot-check'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp size={14} />
              Spot Count Priority
            </button>
            <button
              onClick={() => setActiveTab('variance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'variance'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert size={14} />
              Confirmed Discrepancies
            </button>
          </div>

          {activeTab === 'variance' && (
            <span className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/20 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 shadow-inner whitespace-nowrap self-start sm:self-center">
              <ShieldAlert size={14} />
              {suspiciousItems.filter(s => s.status === 'Investigate').length} Critical Alerts
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50">
              {columns.map((col) => (
                <th
                  key={col}
                  className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ${['ITEM'].includes(col) ? 'text-left' :
                    ['STATUS', 'ACTION'].includes(col) ? 'text-center' :
                      'text-right'
                    }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm font-medium text-slate-400 dark:text-slate-500">
                  {activeTab === 'spot-check'
                    ? 'No high-exposure ingredients found for this timeframe.'
                    : 'No matching suspicious items found.'
                  }
                </td>
              </tr>
            ) : activeTab === 'spot-check' ? (
              filteredItems.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                >
                  {/* ITEM */}
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{row.item}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{row.category}</p>
                  </td>

                  {/* EXP. USAGE (QTY) */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {row.expClose.toLocaleString()}
                    </span>
                  </td>

                  {/* UNIT COST */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      ₱{(row.costPerUnit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* USAGE VALUE (₱) */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      ₱{(row.expClose * (row.costPerUnit || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* ACTION */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onAssign(row)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/50 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all duration-200 hover:-translate-y-px shadow-sm active:scale-95"
                    >
                      <ClipboardList size={14} />
                      Spot Count
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              filteredItems.map((row) => (
                <tr
                  key={row.id}
                  className={`transition-colors duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 ${row.status === 'Investigate' ? 'bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/50 dark:hover:bg-red-900/20' : ''
                    }`}
                >
                  {/* ITEM */}
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{row.item}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{row.category}</p>
                  </td>

                  {/* OPEN */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.open.toLocaleString()}</span>
                  </td>

                  {/* RECV */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.recv.toLocaleString()}</span>
                  </td>

                  {/* SOLD */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.sold.toLocaleString()}</span>
                  </td>

                  {/* EXP. CLOSE */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{row.expClose.toLocaleString()}</span>
                  </td>

                  {/* ACT. CLOSE */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{row.actClose.toLocaleString()}</span>
                  </td>

                  {/* VAR QTY */}
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-black ${row.varQty < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {row.varQty > 0 ? '+' : ''}{row.varQty.toLocaleString()}
                    </span>
                  </td>

                  {/* VAR ₱ */}
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-black ${row.varPeso < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      ₱{Math.abs(row.varPeso).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${row.status === 'Investigate'
                      ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 shadow-inner'
                      : row.status === 'Watch'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-inner'
                      }`}>
                      {row.status === 'Investigate' && <ShieldAlert size={12} />}
                      {row.status}
                    </span>
                  </td>

                  {/* ACTION */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onAssign(row)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 hover:-translate-y-px shadow-sm active:scale-95"
                    >
                      <UserPlus size={14} />
                      Assign
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
