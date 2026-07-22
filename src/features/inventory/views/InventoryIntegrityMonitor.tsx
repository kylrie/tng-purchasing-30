import React, { useState, useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  Clock,
  BarChart3,
  DollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  Percent,
  Wine,
  Beef,
  Fish,
  Leaf,
  Milk,
  Wheat,
  Bell,
  Layers
} from 'lucide-react';
import NotificationsTab from '../components/NotificationsTab';
import InvestigationsTab from '../components/InvestigationsTab';
import ShiftOverlayTab from '../components/ShiftOverlayTab';
import AssignInvestigationModal, { type AssignModalData } from '../components/AssignInvestigationModal';
import { useInventoryDashboard } from '../hooks/useInventoryDashboard';
import { useAuth } from '../../../contexts/useAuth';
import { useData } from '../../../shared/context/DataContext';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import type { DashboardPeriod, SuspiciousItem } from '../services/inventory-dashboard.service';
import { InvestigationsService } from '../services/investigations.service';

import { HighAlertBanner } from '../components/integrity-monitor/HighAlertBanner';
import { KpiCards } from '../components/integrity-monitor/KpiCards';
import { CategoryRiskGrid } from '../components/integrity-monitor/CategoryRiskGrid';
import { SuspiciousItemsTable } from '../components/integrity-monitor/SuspiciousItemsTable';
import type { KpiItem, CategoryRisk, SuspiciousRow } from '../components/integrity-monitor/types';

type TimeFilter = 'Today' | 'Week' | 'Month' | 'Custom';
type ActiveTab = 'Overview' | 'Investigations' | 'Shift Overlay' | 'Notifications';

// ============================================================
// MAIN COMPONENT
// ============================================================

const InventoryIntegrityMonitor: React.FC = () => {
  const { currentUser } = useAuth();
  useData(); // retained for side-effects / context subscription
  const { selectedBusinessUnit } = useBusinessUnit();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Today');
  const [activeTab, setActiveTab] = useState<ActiveTab>('Overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<AssignModalData | null>(null);

  // Custom Date Range states: default to current month range
  const getInitialStartDate = () => {
    const d = new Date();
    d.setDate(1); // Default to start of month for custom
    return d.toISOString().split('T')[0];
  };
  const [customStartDate, setCustomStartDate] = useState<string>(getInitialStartDate());
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const customRange = useMemo(() => {
    if (timeFilter !== 'Custom') return undefined;
    const start = new Date(customStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [timeFilter, customStartDate, customEndDate]);

  // Resolve selectedBU: if global is 'all', fall back to user's own BU
  const selectedBU = selectedBusinessUnit === 'all'
    ? (currentUser?.businessId || currentUser?.businessUnitIds?.[0] || '')
    : selectedBusinessUnit;

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
    filterKey,
    customRange
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
  // Service data is already in recipe/base units — do NOT multiply by conversionRate
  // (that was double-counting and inflating numbers by 700x for liquor, etc.)
  // VAR ₱ uses the pre-computed varianceValue from the service
  const suspiciousItemsRows: SuspiciousRow[] = dashboardKPIs?.suspiciousItems.map((item: SuspiciousItem, index) => {
    const varQty = item.actualClosing - item.expectedClosing;
    return {
      id: `suspicious-${index}`,
      item: item.itemName,
      category: `${item.category || 'Inventory'}${item.recipeUnit ? ' • ' + item.recipeUnit : ''}`,
      open: Math.round((item.openQty || 0) * 100) / 100,
      recv: Math.round((item.recvQty || 0) * 100) / 100,
      sold: Math.round((item.soldQty || 0) * 100) / 100,
      expClose: Math.round(item.expectedClosing * 100) / 100,
      actClose: Math.round(item.actualClosing * 100) / 100,
      varQty: Math.round(varQty * 100) / 100,
      varPeso: Math.round((item.varianceValue || (varQty * item.costPerUnit)) * 100) / 100,
      status: item.status,
      costPerUnit: item.costPerUnit,
      itemId: item.itemId,
    };
  }) || [];

  const spotCheckRows: SuspiciousRow[] = dashboardKPIs?.spotCheckRecommendations.map((item: SuspiciousItem, index) => {
    const varQty = item.actualClosing - item.expectedClosing;
    return {
      id: `spotcheck-${index}`,
      item: item.itemName,
      category: `${item.category || 'Inventory'}${item.recipeUnit ? ' • ' + item.recipeUnit : ''}`,
      open: Math.round((item.openQty || 0) * 100) / 100,
      recv: Math.round((item.recvQty || 0) * 100) / 100,
      sold: Math.round((item.soldQty || 0) * 100) / 100,
      expClose: Math.round(item.expectedClosing * 100) / 100,
      actClose: Math.round(item.actualClosing * 100) / 100,
      varQty: Math.round(varQty * 100) / 100,
      varPeso: Math.round((item.varianceValue || (varQty * item.costPerUnit)) * 100) / 100,
      status: item.status,
      costPerUnit: item.costPerUnit,
      itemId: item.itemId,
    };
  }) || [];

  const handleAssign = (row: SuspiciousRow) => {
    setModalData({
      itemId: row.itemId,
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

  const timeOptions: TimeFilter[] = ['Today', 'Week', 'Month', 'Custom'];
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
            {/* Custom Date Range Inputs */}
            {timeFilter === 'Custom' && (
              <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-1.5 border border-slate-200/50 dark:border-slate-700/50 shadow-inner animate-in fade-in slide-in-from-right-4 duration-300">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
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
            <SuspiciousItemsTable 
              suspiciousItems={suspiciousItemsRows} 
              spotCheckRecommendations={spotCheckRows} 
              onAssign={handleAssign} 
            />
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
