import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  DollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  Percent,
  ShieldAlert,
  Mail,
  UserPlus,
  Wine,
  Beef,
  Fish,
  Leaf,
  Milk,
  Wheat,
  BarChart3,
  Bell,
  Layers,
  Clock,
  Search,
} from 'lucide-react';
import NotificationsTab from '../components/NotificationsTab';
import InvestigationsTab from '../components/InvestigationsTab';
import ShiftOverlayTab from '../components/ShiftOverlayTab';
import AssignInvestigationModal, { type AssignModalData } from '../components/AssignInvestigationModal';
import { useInventoryDashboard } from '../hooks/useInventoryDashboard';
import { useAuth } from '../../../contexts/useAuth';
import { useData } from '../../../shared/context/DataContext';
import type { DashboardPeriod, SuspiciousItem } from '../services/inventory-dashboard.service';
import { InvestigationsService } from '../services/investigations.service';

// ============================================================
// TYPES
// ============================================================

type TimeFilter = 'Today' | 'Week' | 'Month';
type ActiveTab = 'Overview' | 'Investigations' | 'Shift Overlay' | 'Notifications';

interface KpiItem {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  subtext: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  isVariance?: boolean;
  variancePercent?: number;
}

interface CategoryRisk {
  id: string;
  name: string;
  icon: React.ElementType;
  variance: number;
  sales: string;
  loss: string;
  expected: string;
  actual: string;
}

interface SuspiciousRow {
  id: string;
  item: string;
  category: string;
  open: number;
  recv: number;
  sold: number;
  expClose: number;
  actClose: number;
  varQty: number;
  varPeso: number;
  status: 'Investigate' | 'Watch' | 'Normal';
}

// Removed DUMMY_CATEGORIES as it's now dynamically fetched

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Full-width alert banner for critical variance */
const HighAlertBanner: React.FC<{ itemsCount: number; topItems: string; totalLoss: number }> = ({ itemsCount, topItems, totalLoss }) => {
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

/** Single KPI card */
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

/** Grid of 5 KPI cards */
const KpiCards: React.FC<{ kpis: KpiItem[] }> = ({ kpis }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
    {kpis.map((kpi) => (
      <KpiCard key={kpi.id} kpi={kpi} />
    ))}
  </div>
);

/** Category risk card */
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

/** 3×2 grid of category risk cards */
const CategoryRiskGrid: React.FC<{ categories: CategoryRisk[] }> = ({ categories }) => {
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

/** Suspicious items table */
const SuspiciousItemsTable: React.FC<{
  suspiciousItems: SuspiciousRow[];
  onAssign: (row: SuspiciousRow) => void;
}> = ({ suspiciousItems, onAssign }) => {

  const columns = ['ITEM', 'OPEN', 'RECV', 'SOLD', 'EXP. CLOSE', 'ACT. CLOSE', 'VAR QTY', 'VAR ₱', 'STATUS', 'ACTION'];

  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden">
      {/* Table header */}
      <div className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 dark:bg-slate-800/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center backdrop-blur-md shadow-inner">
            <Search size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Suspicious Items</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Ranked by variance value — requires investigation</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/20 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 shadow-inner">
          <ShieldAlert size={14} />
          {suspiciousItems.filter(s => s.status === 'Investigate').length} Critical Alerts
        </span>
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
            {suspiciousItems.map((row) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const InventoryIntegrityMonitor: React.FC = () => {
  const { currentUser } = useAuth();
  const { businesses } = useData();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Today');
  const [activeTab, setActiveTab] = useState<ActiveTab>('Overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<AssignModalData | null>(null);
  const [selectedBU, setSelectedBU] = useState<string>(currentUser?.businessId || '');

  // Keep selectedBU in sync if currentUser loads after mount
  React.useEffect(() => {
    if (!selectedBU && currentUser?.businessId) {
      setSelectedBU(currentUser.businessId);
    }
  }, [currentUser?.businessId, selectedBU]);

  // Hook to pull all data — driven by the BU selector, not the current user's fixed BU
  const filterKey = timeFilter.toLowerCase() as DashboardPeriod;
  const {
    kpis: dashboardKPIs,
    shiftVariances,
    investigations,
    loading,
    error,
    refetch,
  } = useInventoryDashboard(
    selectedBU === 'ALL' && currentUser ? currentUser : (selectedBU || currentUser?.businessId), 
    filterKey
  );

  // Convert raw DashboardKPIs into UI components KpiItem[]
  const kpiItems: KpiItem[] = dashboardKPIs ? [
    {
      id: 'net-sales',
      label: 'Net Sales',
      value: `₱${(dashboardKPIs.netSales || 0).toLocaleString()}`,
      rawValue: dashboardKPIs.netSales,
      subtext: `POS revenue (${dashboardKPIs.periodLabel})`,
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      id: 'expected-usage',
      label: 'Expected Usage',
      value: `₱${(dashboardKPIs.theoreticalUsage || 0).toLocaleString()}`,
      rawValue: dashboardKPIs.theoreticalUsage,
      subtext: 'Theoretical recipe usage',
      icon: Package,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      id: 'actual-usage',
      label: 'Actual Usage',
      value: `₱${(dashboardKPIs.actualUsage || 0).toLocaleString()}`,
      rawValue: dashboardKPIs.actualUsage,
      subtext: 'Used based on physical count',
      icon: TrendingDown,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    {
      id: 'gap',
      label: 'Unexplained Gap',
      value: `₱${(dashboardKPIs.unexplainedVariance || 0).toLocaleString()}`,
      rawValue: dashboardKPIs.unexplainedVariance,
      subtext: 'Actual − expected usage',
      icon: TrendingUp,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
    },
    {
      id: 'variance',
      label: 'Variance %',
      value: `${(dashboardKPIs.variancePercent || 0).toFixed(1)}%`,
      rawValue: dashboardKPIs.variancePercent,
      subtext: 'Acceptable: <2%  |  Watch: 2–5%',
      icon: Percent,
      iconColor: dashboardKPIs.varianceStatus === 'green' ? 'text-emerald-600' : dashboardKPIs.varianceStatus === 'yellow' ? 'text-amber-600' : 'text-red-600',
      iconBg: dashboardKPIs.varianceStatus === 'green' ? 'bg-emerald-50' : dashboardKPIs.varianceStatus === 'yellow' ? 'bg-amber-50' : 'bg-red-50',
      isVariance: true,
      variancePercent: dashboardKPIs.variancePercent,
    },
  ] : [];

  // Helper icon mapper for category risks
  const getCategoryIcon = (catName: string) => {
    const l = catName.toLowerCase();
    if (l.includes('wine') || l.includes('alcohol') || l.includes('spirits')) return Wine;
    if (l.includes('meat') || l.includes('beef')) return Beef;
    if (l.includes('fish') || l.includes('seafood')) return Fish;
    if (l.includes('produce') || l.includes('veg') || l.includes('fruit')) return Leaf;
    if (l.includes('milk') || l.includes('dairy')) return Milk;
    if (l.includes('wheat') || l.includes('bread') || l.includes('dry')) return Wheat;
    return Package; // fallback
  };

  // Build the live Category risks
  const liveCategories: CategoryRisk[] = (dashboardKPIs?.categoryRisks || []).slice(0, 6).map((c) => ({
    id: c.id,
    name: c.name,
    icon: getCategoryIcon(c.name),
    variance: c.variancePercent,
    sales: c.salesValue > 0 ? `₱${c.salesValue.toLocaleString()}` : '₱0',
    loss: `₱${c.lossValue.toLocaleString()}`,
    expected: `₱${c.expectedValue.toLocaleString()}`,
    actual: `₱${c.actualValue.toLocaleString()}`,
  }));

  // Convert raw SuspiciousItem[] into UI SuspiciousRow[]
  // All quantities are converted to Base/Count Units (× conversionRate)
  // VAR ₱ is computed from base-unit variance: varQtyBase × costPerBaseUnit
  const suspiciousItemsRows: SuspiciousRow[] = dashboardKPIs?.suspiciousItems.map((item: SuspiciousItem, index) => {
    const c = item.conversionRate || 1;
    const varQtyBase = (item.actualClosing - item.expectedClosing) * c;
    return {
      id: `suspicious-${index}`,
      item: item.itemName,
      category: `${item.category || 'Inventory'}${item.countUnit ? ' • ' + item.countUnit : ''}`,
      open: Math.round(((item.openQty || 0) * c) * 100) / 100,
      recv: Math.round(((item.recvQty || 0) * c) * 100) / 100,
      sold: Math.round(((item.soldQty || 0) * c) * 100) / 100,
      expClose: Math.round((item.expectedClosing * c) * 100) / 100,
      actClose: Math.round((item.actualClosing * c) * 100) / 100,
      varQty: Math.round(varQtyBase * 100) / 100,
      varPeso: Math.round(varQtyBase * item.costPerUnit * 100) / 100,
      status: item.status,
    };
  }) || [];

  const handleAssign = (row: SuspiciousRow) => {
    setModalData({
      itemId: row.id,
      itemName: row.item,
      category: row.category,
      estimatedLoss: Math.abs(row.varPeso),
      currentStatus: row.status === 'Investigate' ? 'Investigate' : 'Watch',
    });
    setModalOpen(true);
  };

  const handleResolveInvestigation = async (caseId: string, notes: string) => {
    const bizId = selectedBU || currentUser?.businessId;
    if (!bizId) return;
    try {
      await InvestigationsService.resolveInvestigation(bizId, caseId, notes);
    } catch (e) {
      console.error('Failed to resolve investigation', e);
    }
  };

  const timeOptions: TimeFilter[] = ['Today', 'Week', 'Month'];
  const tabOptions: { label: ActiveTab; icon: React.ElementType }[] = [
    { label: 'Overview', icon: BarChart3 },
    { label: 'Investigations', icon: Search },
    { label: 'Shift Overlay', icon: Clock },
    { label: 'Notifications', icon: Bell },
  ];

  const suspiciousInvestigate = suspiciousItemsRows.filter(s => s.status === 'Investigate');
  const topItemsText = suspiciousInvestigate.slice(0, 2).map(s => s.item).join(' + ') || (suspiciousInvestigate.length > 0 ? suspiciousInvestigate[0].item : 'Multiple Items');
  const alertTotalLoss = suspiciousInvestigate.reduce((sum, s) => sum + Math.abs(s.varPeso), 0);

  return (
    <div className="h-full w-full">
      <div className="max-w-[1440px] mx-auto space-y-6 sm:space-y-8 pb-10">

        {/* ============================================================ */}
        {/* PAGE HEADER                                                   */}
        {/* ============================================================ */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/20 dark:border-slate-700/50 p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/20 dark:shadow-black/40">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-600/30 flex-shrink-0 animate-pulse-slow">
              <Layers size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Integrity Monitor</h1>
              <p className="text-sm sm:text-base font-medium text-slate-500 dark:text-slate-400 mt-1">Real-time variance tracking & loss prevention</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* BU Selector */}
            {businesses.length > 1 && (
              <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 rounded-2xl px-4 py-2.5 shadow-sm">
                <Building2 size={16} className="text-purple-500 flex-shrink-0" />
                <select
                  value={selectedBU}
                  onChange={(e) => setSelectedBU(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-800">All Business Units (System-wide)</option>
                  {businesses.map(bu => (
                    <option key={bu.id} value={bu.id} className="bg-white dark:bg-slate-800">
                      {bu.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Time Filter Toggle */}
            <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-1.5 border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
              {timeOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTimeFilter(opt)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide uppercase transition-all duration-300 ${timeFilter === opt
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md border border-slate-200/50 dark:border-slate-700/50'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB NAVIGATION                                                */}
        {/* ============================================================ */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/50 pb-px overflow-x-auto custom-scrollbar">
          {tabOptions.map(({ label, icon: TabIcon }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={`inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all duration-300 whitespace-nowrap min-w-[140px] ${activeTab === label
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                }`}
            >
              <TabIcon size={18} className={activeTab === label ? "text-purple-500 dark:text-purple-400" : "opacity-70"} />
              {label}
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* OVERVIEW TAB CONTENT                                          */}
        {/* ============================================================ */}
        {activeTab === 'Overview' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Error Banner */}
            {error && (
              <div className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-900/20 backdrop-blur-xl px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{error}</p>
                </div>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all duration-200 active:scale-95 whitespace-nowrap"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Alert Banner */}
            <HighAlertBanner
              itemsCount={suspiciousInvestigate.length}
              topItems={topItemsText}
              totalLoss={alertTotalLoss}
            />

            {/* KPI Cards */}
            {loading && kpiItems.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-700/50">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Aggregating telemetry...</p>
              </div>
            ) : (
              <KpiCards kpis={kpiItems} />
            )}

            {/* Category Risk Grid */}
            <CategoryRiskGrid categories={liveCategories} />

            {/* Suspicious Items Table */}
            <SuspiciousItemsTable suspiciousItems={suspiciousItemsRows} onAssign={handleAssign} />
          </div>
        )}

        {/* ============================================================ */}
        {/* OTHER TABS                                              */}
        {/* ============================================================ */}
        {activeTab === 'Investigations' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <InvestigationsTab
              investigations={investigations}
              onResolve={handleResolveInvestigation}
            />
          </div>
        )}

        {activeTab === 'Shift Overlay' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ShiftOverlayTab
              staffVariances={shiftVariances}
            />
          </div>
        )}

        {activeTab === 'Notifications' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <NotificationsTab />
          </div>
        )}

        {/* Assign Investigation Modal */}
        <AssignInvestigationModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setModalData(null); }}
          data={modalData}
        />
      </div>
    </div>
  );
};

export default InventoryIntegrityMonitor;
