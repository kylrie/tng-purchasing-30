import React, { useState, useEffect } from 'react';
import {
    Package,
    DollarSign,
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    Building2,
    BarChart3,
    Percent,
    Search,
    Shield,
    Eye,
    ShieldAlert,
    Calendar
} from 'lucide-react';
import { InventoryDashboardService } from '../services/inventory-dashboard.service';
import type { DashboardKPIs, DashboardPeriod, DateRange, SuspiciousItem } from '../services/inventory-dashboard.service';
import type { Business } from '../../procurement/types';

// ============================================================
// PROPS
// ============================================================

interface InventoryDashboardProps {
    currentUser: { id: string; name: string };
    businesses: Business[];
    uomOptions: string[];
}

// ============================================================
// KPI CARD COMPONENT
// ============================================================

interface KPICardProps {
    icon: React.ElementType;
    label: string;
    value: string;
    subtitle?: string;
    accentColor: string;
    iconBg: string;
    iconColor: string;
    statusDot?: 'green' | 'yellow' | 'red';
}

const KPICard: React.FC<KPICardProps> = ({ icon: Icon, label, value, subtitle, accentColor, iconBg, iconColor, statusDot }) => (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group`}>
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentColor}`} />
        <div className="p-6">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shadow-sm`}>
                    <Icon size={22} className={iconColor} />
                </div>
                {statusDot && (
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDot === 'green' ? 'bg-emerald-500' :
                            statusDot === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                            } animate-pulse`} />
                        <span className={`text-xs font-semibold uppercase tracking-wider ${statusDot === 'green' ? 'text-emerald-500' :
                            statusDot === 'yellow' ? 'text-amber-500' : 'text-red-500'
                            }`}>
                            {statusDot === 'green' ? 'Good' : statusDot === 'yellow' ? 'Warning' : 'Alert'}
                        </span>
                    </div>
                )}
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
            {subtitle && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{subtitle}</p>
            )}
        </div>
    </div>
);

// ============================================================
// STATUS BADGE
// ============================================================

const StatusBadge: React.FC<{ status: SuspiciousItem['status'] }> = ({ status }) => {
    const config = {
        Normal: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: Shield },
        Watch: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: Eye },
        Investigate: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: ShieldAlert },
    }[status];

    const IconComp = config.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${config.bg} ${config.text}`}>
            <IconComp size={12} />
            {status}
        </span>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ businesses }) => {
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(
        businesses.length > 0 ? businesses[0].id : ''
    );
    const [period, setPeriod] = useState<DashboardPeriod>('today');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadKPIs = async () => {
            if (!selectedBusinessUnit) return;
            // For custom, don't load until both dates are set
            if (period === 'custom' && (!customStart || !customEnd)) return;

            setIsLoading(true);
            setError(null);
            try {
                let customRange: DateRange | undefined;
                if (period === 'custom' && customStart && customEnd) {
                    const start = new Date(customStart);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(customEnd);
                    end.setHours(23, 59, 59, 999);
                    customRange = { start, end };
                }
                const data = await InventoryDashboardService.getDashboardKPIs(selectedBusinessUnit, period, customRange);
                setKpis(data);
            } catch (err) {
                console.error('Error loading KPIs:', err);
                setError('Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        loadKPIs();
    }, [selectedBusinessUnit, period, customStart, customEnd]);

    const formatCurrency = (value: number) =>
        `₱${Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formatPercent = (value: number) =>
        `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

    const currentBusiness = businesses.find(b => b.id === selectedBusinessUnit);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BarChart3 className="text-purple-600 dark:text-purple-400" />
                        POS Exception Dashboard
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {currentBusiness?.name || 'Select a business unit'} — Variance & exception tracking
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Building2 size={20} className="text-slate-500 dark:text-slate-400" />
                    <select
                        value={selectedBusinessUnit}
                        onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                        {businesses.map(bu => (
                            <option key={bu.id} value={bu.id}>{bu.name}</option>
                        ))}
                    </select>

                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                        {(['today', 'week', 'month', 'custom'] as DashboardPeriod[]).map((p) => {
                            const labels: Record<DashboardPeriod, string> = {
                                today: 'Today',
                                week: 'Weekly',
                                month: 'Monthly',
                                custom: 'Custom'
                            };
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${period === p
                                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                >
                                    {p === 'custom' && <Calendar size={14} />}
                                    {labels[p]}
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Date Range Inputs */}
                    {period === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                            />
                            <span className="text-slate-400 text-sm">to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-400">Loading dashboard...</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                        <p className="text-red-400">{error}</p>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 1: THE 5 BIG CARDS                                   */}
            {/* ============================================================ */}
            {!isLoading && !error && kpis && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                        {/* Card 1: Net Sales */}
                        <KPICard
                            icon={DollarSign}
                            label={`Net Sales ${kpis.periodLabel}`}
                            value={formatCurrency(kpis.netSales)}
                            subtitle="Total revenue from POS orders"
                            accentColor="from-emerald-500 to-cyan-500"
                            iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
                            iconColor="text-emerald-600 dark:text-emerald-400"
                        />

                        {/* Card 2: Expected Stock Usage */}
                        <KPICard
                            icon={Package}
                            label="Expected Stock Usage"
                            value={formatCurrency(kpis.theoreticalUsage)}
                            subtitle="Theoretical consumption from recipes × sales"
                            accentColor="from-blue-500 to-indigo-500"
                            iconBg="bg-blue-500/10 dark:bg-blue-500/20"
                            iconColor="text-blue-600 dark:text-blue-400"
                        />

                        {/* Card 3: Actual Stock Usage */}
                        <KPICard
                            icon={TrendingDown}
                            label="Actual Stock Usage"
                            value={formatCurrency(kpis.actualUsage)}
                            subtitle="Opening + purchases − physical closing count"
                            accentColor="from-amber-500 to-orange-500"
                            iconBg="bg-amber-500/10 dark:bg-amber-500/20"
                            iconColor="text-amber-600 dark:text-amber-400"
                        />

                        {/* Card 4: Unexplained Gap */}
                        <KPICard
                            icon={TrendingUp}
                            label="Unexplained Gap"
                            value={`${kpis.unexplainedVariance >= 0 ? '+' : '−'}${formatCurrency(kpis.unexplainedVariance)}`}
                            subtitle="Actual usage − expected usage"
                            accentColor={
                                kpis.varianceStatus === 'green' ? 'from-emerald-500 to-green-500' :
                                    kpis.varianceStatus === 'yellow' ? 'from-amber-500 to-yellow-500' :
                                        'from-red-500 to-rose-500'
                            }
                            iconBg={
                                kpis.varianceStatus === 'green' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' :
                                    kpis.varianceStatus === 'yellow' ? 'bg-amber-500/10 dark:bg-amber-500/20' :
                                        'bg-red-500/10 dark:bg-red-500/20'
                            }
                            iconColor={
                                kpis.varianceStatus === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
                                    kpis.varianceStatus === 'yellow' ? 'text-amber-600 dark:text-amber-400' :
                                        'text-red-600 dark:text-red-400'
                            }
                            statusDot={kpis.varianceStatus}
                        />

                        {/* Card 5: Variance % */}
                        <KPICard
                            icon={Percent}
                            label="Variance %"
                            value={formatPercent(kpis.variancePercent)}
                            subtitle={
                                kpis.varianceStatus === 'green' ? '0–2% — Within tolerance' :
                                    kpis.varianceStatus === 'yellow' ? '2–5% — Needs attention' :
                                        '>5% — Investigate immediately'
                            }
                            accentColor={
                                kpis.varianceStatus === 'green' ? 'from-emerald-500 to-green-500' :
                                    kpis.varianceStatus === 'yellow' ? 'from-amber-500 to-yellow-500' :
                                        'from-red-500 to-rose-500'
                            }
                            iconBg={
                                kpis.varianceStatus === 'green' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' :
                                    kpis.varianceStatus === 'yellow' ? 'bg-amber-500/10 dark:bg-amber-500/20' :
                                        'bg-red-500/10 dark:bg-red-500/20'
                            }
                            iconColor={
                                kpis.varianceStatus === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
                                    kpis.varianceStatus === 'yellow' ? 'text-amber-600 dark:text-amber-400' :
                                        'text-red-600 dark:text-red-400'
                            }
                            statusDot={kpis.varianceStatus}
                        />
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 2: TOP 10 SUSPICIOUS ITEMS TABLE                     */}
                    {/* ============================================================ */}
                    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/10 dark:border-slate-700/60 shadow-lg overflow-hidden">
                        {/* Table Header */}
                        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/60">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center">
                                        <Search size={18} className="text-red-600 dark:text-red-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                            Top 10 Suspicious Items
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Sorted by variance value (₱) — Expected vs physical stock
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                                        <Shield size={10} /> Normal
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                                        <Eye size={10} /> Watch
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold">
                                        <ShieldAlert size={10} /> Investigate
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        {kpis.suspiciousItems.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900/40">
                                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">#</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Item Name</th>
                                            <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Expected Closing</th>
                                            <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actual Closing</th>
                                            <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Variance Qty</th>
                                            <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Variance Value (₱)</th>
                                            <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                                        {kpis.suspiciousItems.map((item, index) => (
                                            <tr
                                                key={index}
                                                className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30 ${item.status === 'Investigate' ? 'bg-red-50/40 dark:bg-red-900/10' :
                                                    item.status === 'Watch' ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''
                                                    }`}
                                            >
                                                <td className="px-6 py-4 text-sm font-mono text-slate-400 dark:text-slate-500">
                                                    {index + 1}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {item.itemName}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                        {item.expectedClosing.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                        {item.actualClosing.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-sm font-bold ${item.varianceQty > 0 ? 'text-red-600 dark:text-red-400' :
                                                        item.varianceQty < 0 ? 'text-blue-600 dark:text-blue-400' :
                                                            'text-slate-500'
                                                        }`}>
                                                        {item.varianceQty > 0 ? '+' : ''}{item.varianceQty.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-sm font-bold ${item.varianceValue > 0 ? 'text-red-600 dark:text-red-400' :
                                                        item.varianceValue < 0 ? 'text-blue-600 dark:text-blue-400' :
                                                            'text-slate-500'
                                                        }`}>
                                                        {item.varianceValue > 0 ? '+' : ''}₱{Math.abs(item.varianceValue).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <StatusBadge status={item.status} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-6 py-12 text-center">
                                <Shield size={36} className="mx-auto mb-3 text-emerald-400" />
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">All Clear</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    No suspicious variance detected. Import POS data and run stock counts to begin tracking.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Empty state when absolutely no data */}
                    {kpis.netSales === 0 && kpis.actualUsage === 0 && kpis.suspiciousItems.length === 0 && (
                        <div className="bg-white/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                                <BarChart3 size={28} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Data Yet</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                Start importing POS sales data and completing stock take sessions to see your variance KPIs and suspicious items here.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default InventoryDashboard;
