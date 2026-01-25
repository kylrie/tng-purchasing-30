import React, { useState, useEffect } from 'react';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Loader2,
    Receipt,
    Building2,
    Clock,
    Coins
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import {
    FinanceDashboardService,
    type FinancialHealthData,
    type CashFlowDataPoint,
    type ExpenseCategory,
    type HighValueTransaction
} from '../services/finance.dashboard.service';
import type { Business } from '../../procurement/types';
import { BudgetDashboardWidget } from '../components/BudgetDashboardWidget';

// ============================================================
// TYPES
// ============================================================

interface FinanceOverviewProps {
    businesses: Business[];
}

// ============================================================
// FINANCIAL HEALTH CARD COMPONENT
// ============================================================

interface HealthCardProps {
    title: string;
    value: string;
    trend: number;
    icon: React.ReactNode;
    gradient: string;
    isNegative?: boolean;
}

const HealthCard: React.FC<HealthCardProps> = ({
    title,
    value,
    trend,
    icon,
    gradient,
    isNegative = false
}) => {
    const trendColor = trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-slate-400';
    const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;

    return (
        <div className={`relative overflow-hidden rounded-2xl p-6 ${gradient} shadow-xl`}>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/20" />
                <div className="absolute -right-4 -bottom-8 w-24 h-24 rounded-full bg-white/10" />
            </div>

            <div className="relative">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm shadow-sm">
                        {icon}
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/30 text-white shadow-sm ${trendColor}`}>
                        <TrendIcon size={14} />
                        <span className="text-xs font-semibold">{Math.abs(trend).toFixed(1)}%</span>
                    </div>
                </div>

                <p className="text-white/90 text-sm font-medium mb-1">{title}</p>
                <p className={`text-3xl font-bold ${isNegative ? 'text-rose-100' : 'text-white'} drop-shadow-sm`}>
                    {value}
                </p>
                <p className="text-white/70 text-xs mt-2">vs last month</p>
            </div>
        </div>
    );
};

// ============================================================
// CUSTOM TOOLTIP FOR BAR CHART
// ============================================================

const CustomBarTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ value: number; name: string; color: string }>;
    label?: string;
}> = ({ active, payload, label }) => {
    if (!active || !payload) return null;

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl">
            <p className="text-slate-800 dark:text-white font-semibold mb-2">{label}</p>
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-slate-600 dark:text-slate-400 capitalize">{entry.name}:</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                        {FinanceDashboardService.formatCurrency(entry.value)}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ============================================================
// CUSTOM TOOLTIP FOR PIE CHART
// ============================================================

const CustomPieTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ value: number; name: string; payload: ExpenseCategory }>;
}> = ({ active, payload }) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0];
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl">
            <div className="flex items-center gap-2">
                <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: data.payload.color }}
                />
                <span className="text-slate-800 dark:text-white font-semibold">{data.name}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                {FinanceDashboardService.formatFullCurrency(data.value)}
            </p>
        </div>
    );
};

// ============================================================
// TRANSACTION ROW COMPONENT
// ============================================================

const TransactionRow: React.FC<{ transaction: HighValueTransaction }> = ({ transaction }) => {
    const isIncome = transaction.type === 'income';

    return (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-slate-100 dark:border-transparent shadow-sm dark:shadow-none">
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${isIncome ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/20'}`}>
                    {isIncome ? (
                        <TrendingUp size={18} className="text-emerald-500 dark:text-emerald-400" />
                    ) : (
                        <TrendingDown size={18} className="text-rose-500 dark:text-rose-400" />
                    )}
                </div>
                <div>
                    <p className="text-slate-800 dark:text-white font-medium">{transaction.description}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
                        <span>{transaction.category}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {FinanceDashboardService.formatDate(transaction.date)}
                        </span>
                    </p>
                </div>
            </div>
            <p className={`text-lg font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isIncome ? '+' : '-'}{FinanceDashboardService.formatFullCurrency(transaction.amount)}
            </p>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const FinanceOverview: React.FC<FinanceOverviewProps> = ({ businesses }) => {
    // Business unit selection
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(
        businesses.length > 0 ? businesses[0].id : 'all'
    );

    // Data states
    const [healthData, setHealthData] = useState<FinancialHealthData | null>(null);
    const [cashFlowData, setCashFlowData] = useState<CashFlowDataPoint[]>([]);
    const [expenseData, setExpenseData] = useState<ExpenseCategory[]>([]);
    const [transactions, setTransactions] = useState<HighValueTransaction[]>([]);

    // Loading states
    const [isLoading, setIsLoading] = useState(true);

    // Load all data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const buFilter = selectedBusinessUnit === 'all' ? undefined : selectedBusinessUnit;
                const [health, cashFlow, expenses, txns] = await Promise.all([
                    FinanceDashboardService.getFinancialHealth(buFilter),
                    FinanceDashboardService.getCashFlowTrends(buFilter),
                    FinanceDashboardService.getExpenseDistribution(buFilter),
                    FinanceDashboardService.getHighValueTransactions(50000, buFilter)
                ]);

                setHealthData(health);
                setCashFlowData(cashFlow);
                setExpenseData(expenses);
                setTransactions(txns);
            } catch (error) {
                console.error('Error loading finance data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [selectedBusinessUnit]);

    // Calculate total expenses for pie chart center
    const totalExpenses = expenseData.reduce((sum, item) => sum + item.value, 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 size={40} className="text-purple-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading financial data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <Wallet className="text-purple-400" />
                        Finance Overview
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Financial health dashboard for strategic decision making
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-slate-400" />
                    <select
                        value={selectedBusinessUnit}
                        onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-white focus:outline-none focus:border-purple-500 shadow-sm dark:shadow-none"
                    >
                        <option value="all">All Business Units</option>
                        {businesses.map(bu => (
                            <option key={bu.id} value={bu.id}>{bu.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Section 1: Financial Health Cards */}
            {healthData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <HealthCard
                        title="Cash on Hand"
                        value={FinanceDashboardService.formatCurrency(healthData.cashOnHand)}
                        trend={healthData.cashOnHandTrend}
                        icon={<Wallet className="w-6 h-6 text-white" />}
                        gradient="bg-gradient-to-br from-blue-600 to-cyan-500"
                    />
                    <HealthCard
                        title="This Month's Revenue"
                        value={FinanceDashboardService.formatCurrency(healthData.monthlyRevenue)}
                        trend={healthData.revenueTrend}
                        icon={<TrendingUp className="w-6 h-6 text-white" />}
                        gradient="bg-gradient-to-br from-emerald-600 to-teal-500"
                    />
                    <HealthCard
                        title="This Month's OpEx"
                        value={FinanceDashboardService.formatCurrency(healthData.monthlyOpEx)}
                        trend={healthData.opExTrend}
                        icon={<TrendingDown className="w-6 h-6 text-white" />}
                        gradient="bg-gradient-to-br from-rose-600 to-orange-500"
                    />
                    <HealthCard
                        title="Net Profit/Loss"
                        value={FinanceDashboardService.formatCurrency(Math.abs(healthData.netProfit))}
                        trend={healthData.profitTrend}
                        icon={<Coins className="w-6 h-6 text-white" />}
                        gradient={healthData.netProfit >= 0
                            ? "bg-gradient-to-br from-purple-600 to-indigo-500"
                            : "bg-gradient-to-br from-red-700 to-rose-600"}
                        isNegative={healthData.netProfit < 0}
                    />
                </div>
            )}

            {/* Section 1.5: Budget Utilization Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BudgetDashboardWidget
                    title="Budget Utilization"
                    businessUnitId={selectedBusinessUnit === 'all' ? null : selectedBusinessUnit}
                    maxVisible={5}
                    getBusinessUnitName={(buId) => businesses.find(b => b.id === buId)?.name || buId}
                />
            </div>

            {/* Section 2: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Chart A: Cash Flow Trends (Bar Chart) */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 min-w-0 shadow-sm dark:shadow-none">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Receipt size={20} className="text-purple-600 dark:text-purple-400" />
                        Cash Flow Trends (Last 6 Months)
                    </h3>
                    <div className="h-80 w-full min-w-0">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                            <BarChart data={cashFlowData} barGap={8}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" className="dark:stroke-slate-700" />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    axisLine={{ stroke: '#94a3b8' }}
                                />
                                <YAxis
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    axisLine={{ stroke: '#94a3b8' }}
                                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Bar
                                    dataKey="income"
                                    name="income"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    dataKey="expense"
                                    name="expense"
                                    fill="#f43f5e"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-emerald-500" />
                            <span className="text-slate-400 text-sm">Income</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-rose-500" />
                            <span className="text-slate-400 text-sm">Expense</span>
                        </div>
                    </div>
                </div>

                {/* Chart B: Expense Distribution (Donut Chart) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 min-w-0 shadow-sm dark:shadow-none">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <TrendingDown size={20} className="text-rose-500 dark:text-rose-400" />
                        Expense Breakdown
                    </h3>
                    <div className="h-80 relative w-full min-w-0">
                        <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={expenseData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    dataKey="value"
                                    nameKey="name"
                                    strokeWidth={2}
                                    stroke="#1e293b"
                                >
                                    {expenseData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomPieTooltip />} />
                                <Legend
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    align="center"
                                    wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                                    formatter={(value: string) => <span className="text-slate-400">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Label */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: '40px' }}>
                            <div className="text-center">
                                <p className="text-slate-500 dark:text-slate-400 text-xs">Total</p>
                                <p className="text-slate-800 dark:text-white font-bold text-lg">
                                    {FinanceDashboardService.formatCurrency(totalExpenses)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 3: High-Value Transactions */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <Coins size={20} className="text-amber-500 dark:text-amber-400" />
                    Recent High-Value Transactions (₱50,000+)
                </h3>

                {transactions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        No high-value transactions found
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map(txn => (
                            <TransactionRow key={txn.id} transaction={txn} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinanceOverview;
