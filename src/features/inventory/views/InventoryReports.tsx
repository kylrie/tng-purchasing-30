import React, { useState, useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Package,
    AlertTriangle,
    Download,
    BarChart3,
    PieChart as PieChartIcon
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import type { COGSReport, StockValueTrend } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';
import type { User } from '../../procurement/types';

// ============================================================
// PROPS & TYPES
// ============================================================

interface InventoryReportsProps {
    currentUser: User;
}

type DateRange = '1M' | '3M' | '6M' | '1Y';

// ============================================================
// SUB-COMPONENTS
// ============================================================

const StatCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: { value: number; isPositive: boolean };
    color: 'purple' | 'cyan' | 'green' | 'amber' | 'red';
}> = ({ title, value, subtitle, icon, trend, color }) => {
    const colorClasses = {
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
        cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30',
        amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
        red: 'from-red-500/20 to-red-600/20 border-red-500/30'
    };

    const iconColors = {
        purple: 'text-purple-600 dark:text-purple-400',
        cyan: 'text-cyan-600 dark:text-cyan-400',
        green: 'text-green-600 dark:text-green-400',
        amber: 'text-amber-600 dark:text-amber-400',
        red: 'text-red-600 dark:text-red-400'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm rounded-xl border p-6 transition-all hover:scale-[1.02] shadow-sm dark:shadow-none`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                    {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
                    {trend && (
                        <div className={`flex items-center gap-1 mt-2 ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            <span className="text-sm font-medium">{Math.abs(trend.value)}%</span>
                            <span className="text-xs text-slate-500">vs last period</span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 ${iconColors[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

const COGSCard: React.FC<{
    report: COGSReport | null;
    isLoading: boolean;
}> = ({ report, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-48 mb-6" />
                <div className="space-y-4">
                    <div className="h-12 bg-slate-700 rounded" />
                    <div className="h-12 bg-slate-700 rounded" />
                    <div className="h-12 bg-slate-700 rounded" />
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center shadow-sm dark:shadow-none">
                <AlertTriangle size={32} className="text-amber-500 dark:text-amber-400 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No COGS data available</p>
                <p className="text-sm text-slate-500 mt-1">Complete at least one stock count to see COGS</p>
            </div>
        );
    }

    const formatCurrency = (val: number) =>
        `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PesoSign size={20} className="text-green-600 dark:text-green-400" />
                    Cost of Goods Sold (COGS)
                </h3>
                <span className="text-xs text-slate-500">
                    {report.periodStart.toLocaleDateString()} - {report.periodEnd.toLocaleDateString()}
                </span>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                        <span className="text-slate-600 dark:text-slate-300">Beginning Inventory</span>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(report.beginningInventoryValue)}</span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400" />
                        <span className="text-slate-600 dark:text-slate-300">+ Purchases (Approved PRFs)</span>
                    </div>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(report.purchasesValue)}</span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400" />
                        <span className="text-slate-600 dark:text-slate-300">- Ending Inventory</span>
                    </div>
                    <span className="font-medium text-purple-600 dark:text-purple-400">{formatCurrency(report.endingInventoryValue)}</span>
                </div>

                <div className="flex items-center justify-between py-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg px-4 -mx-1">
                    <span className="font-semibold text-slate-900 dark:text-white">Cost of Goods Sold</span>
                    <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(report.cogs)}</span>
                </div>
            </div>

            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-500 text-center">
                    COGS = Beginning Inventory + Purchases − Ending Inventory
                </p>
            </div>
        </div>
    );
};

const StockValueChart: React.FC<{
    data: StockValueTrend[];
    isLoading: boolean;
}> = ({ data, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 h-80 animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-48 mb-6" />
                <div className="h-full bg-slate-700/50 rounded" />
            </div>
        );
    }

    const chartData = data.map(item => ({
        ...item,
        month: new Date(item.date + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    }));

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 size={20} className="text-purple-600 dark:text-purple-400" />
                    Stock Value Trends
                </h3>
            </div>

            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="stockValueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                        <YAxis
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}K`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--tooltip-bg, #1e293b)',
                                borderColor: 'var(--tooltip-border, #475569)',
                                borderRadius: '8px',
                                color: 'var(--tooltip-text, #fff)'
                            }}
                            formatter={(val: any) => [`₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Stock Value']}
                            labelStyle={{ color: '#94a3b8' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            fill="url(#stockValueGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const InventoryReports: React.FC<InventoryReportsProps> = ({ currentUser }) => {
    const [cogsReport, setCogsReport] = useState<COGSReport | null>(null);
    const [stockTrends, setStockTrends] = useState<StockValueTrend[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>('6M');
    const [isLoading, setIsLoading] = useState(true);
    const [currentStockValue, setCurrentStockValue] = useState(0);
    const [itemCount, setItemCount] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);

    const getDateRange = (range: DateRange): { start: Date; end: Date } => {
        const end = new Date();
        const start = new Date();

        switch (range) {
            case '1M': start.setMonth(start.getMonth() - 1); break;
            case '3M': start.setMonth(start.getMonth() - 3); break;
            case '6M': start.setMonth(start.getMonth() - 6); break;
            case '1Y': start.setFullYear(start.getFullYear() - 1); break;
        }

        return { start, end };
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const { start, end } = getDateRange(dateRange);
                const months = dateRange === '1M' ? 1 : dateRange === '3M' ? 3 : dateRange === '6M' ? 6 : 12;

                const [trends, items] = await Promise.all([
                    InventoryService.getStockValueTrends(months),
                    InventoryService.getInventoryItems()
                ]);

                // Compute current stock value for COGS estimation
                // NOTE: For accurate COGS, beginningInventoryValue should come from
                // a recon_history snapshot at periodStart. Using current value as fallback.
                const totalValue = items.reduce((sum, item) =>
                    sum + (item.currentStock * item.costPerUnit), 0
                );

                const cogs = await InventoryService.calculateCOGS(start, end, totalValue, 0);

                setCogsReport(cogs);
                setStockTrends(trends);

                const totalValue = items.reduce((sum, item) =>
                    sum + (item.currentStock * item.costPerUnit), 0
                );
                setCurrentStockValue(totalValue);
                setItemCount(items.length);

                const lowStock = items.filter(item => {
                    return item.currentStock < item.parLevel * 0.5;
                });
                setLowStockCount(lowStock.length);

            } catch (error) {
                console.error('Error loading report data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [dateRange]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void currentUser; // Silence lint - currentUser may be used for permissions later

    const formatCurrency = (val: number) =>
        `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BarChart3 className="text-purple-600 dark:text-purple-400" />
                        Inventory Reports
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">COGS analysis and stock value trends</p>
                </div>

                <div className="flex items-center gap-2">
                    {(['1M', '3M', '6M', '1Y'] as DateRange[]).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${dateRange === range
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Current Stock Value"
                    value={formatCurrency(currentStockValue)}
                    icon={<PesoSign size={24} />}
                    trend={{ value: 5.2, isPositive: true }}
                    color="cyan"
                />
                <StatCard
                    title="COGS (Period)"
                    value={cogsReport ? formatCurrency(cogsReport.cogs) : '--'}
                    subtitle={`${dateRange} period`}
                    icon={<TrendingUp size={24} />}
                    color="purple"
                />
                <StatCard
                    title="Total Items"
                    value={itemCount.toString()}
                    subtitle="Active inventory items"
                    icon={<Package size={24} />}
                    color="green"
                />
                <StatCard
                    title="Low Stock Items"
                    value={lowStockCount.toString()}
                    subtitle="Below par level"
                    icon={<AlertTriangle size={24} />}
                    color={lowStockCount > 0 ? 'amber' : 'green'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <COGSCard report={cogsReport} isLoading={isLoading} />
                <StockValueChart data={stockTrends} isLoading={isLoading} />
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <PieChartIcon size={20} className="text-cyan-600 dark:text-cyan-400" />
                        Stock Value by Category
                    </h3>
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 transition-colors">
                        <Download size={16} />
                        Export Report
                    </button>
                </div>

                <div className="space-y-4">
                    {[
                        { name: 'Spirits', value: 45, color: '#8b5cf6' },
                        { name: 'Wine', value: 25, color: '#ef4444' },
                        { name: 'Beer', value: 15, color: '#f59e0b' },
                        { name: 'Mixers', value: 10, color: '#06b6d4' },
                        { name: 'Other', value: 5, color: '#64748b' }
                    ].map(category => (
                        <div key={category.name} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">{category.name}</span>
                                <span className="text-slate-400">{category.value}%</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${category.value}%`, backgroundColor: category.color }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                            <strong>Note:</strong> Purchases value is currently set to ₱0. Connect to the Approved PRFs API to automatically calculate purchases for accurate COGS.
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Variance calculation will be available after connecting to Sales API.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryReports;
