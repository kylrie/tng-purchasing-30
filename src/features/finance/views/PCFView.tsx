import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wallet, Plus, FileText, CheckCircle, Clock, XCircle, AlertTriangle, Receipt, Building2, Eye, Users, User as UserIcon, Ban, Printer, Download } from 'lucide-react';
import { exportToCSV, formatDateForExport, formatCurrencyForExport, type ExportColumn } from '../../../shared/utils/exportUtils';
import PesoSign from '../../../shared/components/PesoSign';
import Card from '../../../shared/components/Card';
import type { User as UserType, Business } from '../../../shared/types';
import { PCFService, PCFStatus, type PCFLiquidation, type PCFExpenseItem } from '../services/pcf.service';
import PCFLiquidationDrawer from '../components/PCFLiquidationDrawer';
import PCFPrintModal from '../components/PCFPrintModal';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { usePermissions } from '../../../hooks/usePermissions';
import { SettingsService, type AllocationRule } from '../../../shared/services/settings.service';

interface PCFViewProps {
    currentUser: UserType;
    businesses: Business[];
    allUsers: UserType[];
}

// Helper: Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

const PCFView: React.FC<PCFViewProps> = ({ currentUser, businesses, allUsers }) => {
    const [liquidations, setLiquidations] = useState<PCFLiquidation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDrawer, setShowDrawer] = useState(false);
    const [selectedLiquidation, setSelectedLiquidation] = useState<PCFLiquidation | null>(null);
    const [editingLiquidation, setEditingLiquidation] = useState<PCFLiquidation | null>(null);
    const [printLiquidation, setPrintLiquidation] = useState<PCFLiquidation | null>(null);
    const [walletStats, setWalletStats] = useState({
        cashOnHand: 0,
        activeLiquidationsTotal: 0,
        activeLiquidationsCount: 0,
    });
    const [viewAll, setViewAll] = useState(false);
    const [detailTab, setDetailTab] = useState<'details' | 'sharing'>('details');
    const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

    const { hasPermission } = usePermissions();
    // Can view all: Either role-based pcf:view:all OR per-user pcf:view:history:all
    const canViewAll = hasPermission('pcf:view:all') || hasPermission('pcf:view:history:all');
    const pcfCeiling = currentUser.pcfCeiling || 0;

    // Get username from allUsers list
    const getUserName = (userId: string): string => {
        const user = allUsers.find(u => u.id === userId);
        return user?.name || 'Unknown User';
    };

    // Fetch liquidations and calculate wallet
    // FIX High #4: Wrapped in useCallback with proper dependencies
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (viewAll && canViewAll) {
                // Fetch all liquidations when viewing all
                const allLiquidations = await PCFService.getAllLiquidations();
                setLiquidations(allLiquidations);
                // Don't show wallet stats when viewing all
                setWalletStats({ cashOnHand: 0, activeLiquidationsTotal: 0, activeLiquidationsCount: 0 });
            } else {
                // Fetch only user's liquidations
                const [userLiquidations, stats] = await Promise.all([
                    PCFService.getUserLiquidations(currentUser.id),
                    PCFService.calculateCashOnHand(currentUser.id, pcfCeiling),
                ]);
                setLiquidations(userLiquidations);
                setWalletStats(stats);
            }
        } catch (error) {
            console.error('Error loading PCF data:', error);
        } finally {
            setLoading(false);
        }
    }, [currentUser.id, pcfCeiling, viewAll, canViewAll]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Load expense allocation rules
    useEffect(() => {
        const loadAllocationRules = async () => {
            try {
                const settings = await SettingsService.getExpenseSharingRules();
                setAllocationRules(settings.rules || []);
            } catch (error) {
                console.error('Error loading allocation rules:', error);
            }
        };
        loadAllocationRules();
    }, []);

    // Status badge helper
    const getStatusBadge = (status: PCFStatus) => {
        const configs: Record<PCFStatus, { bg: string; text: string; icon: React.ReactNode }> = {
            [PCFStatus.DRAFT]: { bg: 'bg-slate-600/30', text: 'text-slate-300', icon: <FileText size={12} /> },
            [PCFStatus.AUDIT_REVIEW]: { bg: 'bg-rose-600/30', text: 'text-rose-300', icon: <AlertTriangle size={12} /> },
            [PCFStatus.PENDING_APPROVAL]: { bg: 'bg-yellow-600/30', text: 'text-yellow-300', icon: <Clock size={12} /> },
            [PCFStatus.APPROVED]: { bg: 'bg-green-600/30', text: 'text-green-300', icon: <CheckCircle size={12} /> },
            [PCFStatus.APPROVED_WAITING_RELEASE]: { bg: 'bg-blue-600/30', text: 'text-blue-300', icon: <Wallet size={12} /> },
            [PCFStatus.REPLENISHED]: { bg: 'bg-emerald-600/30', text: 'text-emerald-300', icon: <PesoSign size={12} /> },
            [PCFStatus.REJECTED]: { bg: 'bg-red-600/30', text: 'text-red-300', icon: <XCircle size={12} /> },
            [PCFStatus.CANCELLED]: { bg: 'bg-orange-600/30', text: 'text-orange-300', icon: <Ban size={12} /> },
        };
        const config = configs[status];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                {config.icon}
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    // Filter liquidations by date
    const filteredLiquidations = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return liquidations;

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        return liquidations.filter(liq => {
            const date = new Date(liq.dateCreated);
            return date >= start && date <= end;
        });
    }, [liquidations, dateRange]);

    // Get business name
    const getBusinessName = (businessId: string) => {
        return businesses.find(b => b.id === businessId)?.name || 'Unknown';
    };

    // Export handler for PCF liquidations
    const handleExport = () => {
        const columns: ExportColumn<PCFLiquidation>[] = [
            { header: 'Date', accessor: (liq) => formatDateForExport(liq.dateCreated) },
            { header: 'Custodian', accessor: (liq) => getUserName(liq.userId) },
            { header: 'Business Unit', accessor: (liq) => getBusinessName(liq.businessId) },
            { header: 'Items', accessor: (liq) => liq.expenses.length },
            { header: 'Amount', accessor: (liq) => formatCurrencyForExport(liq.totalAmount) },
            { header: 'Status', accessor: (liq) => liq.status },
            { header: 'PRF Reference', accessor: (liq) => liq.replenishmentPrfId || '' },
            { header: 'Late', accessor: (liq) => liq.isLate ? `Yes (${liq.daysLate || 0} days)` : 'No' },
        ];

        const filename = viewAll ? 'all_pcf_liquidations_export' : 'my_pcf_liquidations_export';
        exportToCSV(filteredLiquidations, columns, filename);
    };

    // Handle submit from drawer
    // FIX: Replace any[] with PCFExpenseItem[] for type safety
    const handleSubmitLiquidation = async (expenses: PCFExpenseItem[], receiptsLink: string, remarks: string) => {
        // DERIVE BU FROM ITEMS: Use the BU from the first item, or fallback to user's BU
        const liquidationBuId = expenses.length > 0 && expenses[0].buId ? expenses[0].buId : currentUser.businessId;

        await PCFService.submitLiquidation(
            currentUser.id,
            currentUser.name,
            liquidationBuId,
            expenses,
            receiptsLink,
            undefined,
            remarks
        );
        await loadData();
        setShowDrawer(false);
    };

    // Handle save draft from drawer
    // FIX: Replace any[] with PCFExpenseItem[] for type safety
    const handleSaveDraft = async (expenses: PCFExpenseItem[], receiptsLink: string, remarks: string) => {
        // DERIVE BU FROM ITEMS: Use the BU from the first item, or fallback to user's BU
        const liquidationBuId = expenses.length > 0 && expenses[0].buId ? expenses[0].buId : currentUser.businessId;

        await PCFService.createDraftLiquidation(
            currentUser.id,
            currentUser.name,
            liquidationBuId,
            expenses,
            receiptsLink,
            remarks
        );
        await loadData();
        // Don't close drawer - user may want to continue editing
    };

    // Handle edit rejected liquidation - opens drawer with prefilled data
    const handleEditRejected = (liquidation: PCFLiquidation) => {
        setEditingLiquidation(liquidation);
        setSelectedLiquidation(null); // Close detail drawer
        setShowDrawer(true); // Open edit drawer
    };

    // Handle edit draft liquidation - opens drawer with prefilled data
    const handleEditDraft = (liquidation: PCFLiquidation) => {
        setEditingLiquidation(liquidation);
        setSelectedLiquidation(null); // Close detail drawer
        setShowDrawer(true); // Open edit drawer
    };

    // Handle update draft - just saves changes without submitting
    // FIX: Replace any[] with PCFExpenseItem[] for type safety
    const handleUpdateDraft = async (expenses: PCFExpenseItem[], receiptsLink: string, remarks: string) => {
        if (!editingLiquidation) return;

        await PCFService.updateDraftLiquidation(
            editingLiquidation.id,
            expenses,
            receiptsLink,
            remarks
        );
        await loadData();
        setShowDrawer(false);
        setEditingLiquidation(null);
    };

    // Handle submit draft for approval
    const handleSubmitDraft = async (liquidation: PCFLiquidation) => {
        try {
            await PCFService.submitForApproval(liquidation.id);
            await loadData();
            setSelectedLiquidation(null);
        } catch (error) {
            console.error('Submit draft error:', error);
            alert('Failed to submit draft for approval. Please try again.');
        }
    };

    // Handle submit edited/refiled liquidation
    // FIX: Replace any[] with PCFExpenseItem[] for type safety
    const handleEditSubmit = async (expenses: PCFExpenseItem[], receiptsLink: string, remarks: string) => {
        if (!editingLiquidation) return;

        await PCFService.refileLiquidation(
            editingLiquidation.id,
            expenses,
            receiptsLink,
            remarks
        );
        await loadData();
        setShowDrawer(false);
        setEditingLiquidation(null);
    };

    // Handle close drawer (reset edit mode)
    const handleCloseDrawer = () => {
        setShowDrawer(false);
        setEditingLiquidation(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    // No PCF ceiling set - show message
    if (!pcfCeiling || pcfCeiling <= 0) {
        return (
            <div className="space-y-6 max-w-7xl pb-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Petty Cash Fund</h1>
                        <p className="text-slate-400 text-sm">Manage your PCF liquidations and replenishments.</p>
                    </div>
                </div>
                <Card>
                    <div className="text-center py-12">
                        <Wallet size={48} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">No PCF Ceiling Assigned</h3>
                        <p className="text-slate-400">
                            You don't have a PCF ceiling assigned yet. Please contact your administrator to set up your Petty Cash Fund allocation.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    // Calculate percentages for visual
    const usedPercent = Math.min(100, (walletStats.activeLiquidationsTotal / pcfCeiling) * 100);

    return (
        <div className="space-y-6 max-w-7xl pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Petty Cash Fund</h1>
                    <p className="text-slate-400 text-sm">Revolving fund management with auto-replenishment.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Toggle - Only show when user has pcf:view:all permission */}
                    {canViewAll && (
                        <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                            <button
                                onClick={() => setViewAll(false)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${!viewAll
                                    ? 'bg-purple-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <UserIcon size={14} />
                                My Liquidations
                            </button>
                            <button
                                onClick={() => setViewAll(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewAll
                                    ? 'bg-purple-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Users size={14} />
                                All Liquidations
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setShowDrawer(true)}
                        disabled={walletStats.cashOnHand <= 0 && !viewAll}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={18} />
                        New Liquidation
                    </button>
                </div>
            </div>

            {/* Wallet Cards - SAFETY NET LOGIC */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* PCF Ceiling Card */}
                <Card className="bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-900 border-blue-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <PesoSign size={28} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">PCF Ceiling</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(pcfCeiling)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">Your allocated revolving fund</p>
                        </div>
                    </div>
                </Card>

                {/* Pending/Used Amount */}
                <Card className="bg-gradient-to-br from-white to-amber-50 dark:from-slate-800 dark:to-slate-900 border-amber-100 dark:border-yellow-700/30 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-yellow-900/50 flex items-center justify-center">
                            <Clock size={28} className="text-amber-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                                Pending ({walletStats.activeLiquidationsCount})
                            </p>
                            <p className="text-2xl font-bold text-amber-600 dark:text-yellow-400">
                                {formatCurrency(walletStats.activeLiquidationsTotal)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">Awaiting replenishment</p>
                        </div>
                    </div>
                </Card>

                {/* Cash On Hand - Available Balance */}
                <Card className={`bg-gradient-to-br relative overflow-hidden group shadow-sm ${walletStats.cashOnHand > 0
                    ? 'from-white to-emerald-50 border-emerald-100 dark:from-emerald-900/30 dark:to-slate-900 dark:border-emerald-700/50'
                    : 'from-white to-red-50 border-red-100 dark:from-red-900/30 dark:to-slate-900 dark:border-red-700/50'}`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-colors ${walletStats.cashOnHand > 0
                        ? 'bg-emerald-500/5 group-hover:bg-emerald-500/10'
                        : 'bg-red-500/5 group-hover:bg-red-500/10'
                        }`}></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${walletStats.cashOnHand > 0 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                            <Wallet size={28} className={walletStats.cashOnHand > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Available Balance</p>
                            <p className={`text-2xl font-bold ${walletStats.cashOnHand > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(walletStats.cashOnHand)}
                            </p>
                            {walletStats.cashOnHand <= 0 ? (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                    <AlertTriangle size={10} /> Wait for replenishment
                                </p>
                            ) : (
                                <p className="text-xs text-emerald-600 dark:text-emerald-500">Ready for use</p>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Visual Progress Bar */}
            <Card className="!py-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Fund Utilization</span>
                    <span className="text-sm text-slate-800 dark:text-slate-300 font-medium">{usedPercent.toFixed(0)}% used</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${usedPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>Used: {formatCurrency(walletStats.activeLiquidationsTotal)}</span>
                    <span>Available: {formatCurrency(walletStats.cashOnHand)}</span>
                </div>
            </Card>

            {/* Safety Net Formula */}
            <div className="bg-blue-50/50 dark:bg-slate-800/30 border border-blue-100 dark:border-slate-700 rounded-lg p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-blue-600 dark:text-blue-400">Safety Net Calculation:</strong>{' '}
                    Available Balance = Ceiling ({formatCurrency(pcfCeiling)}) − Pending Liquidations ({formatCurrency(walletStats.activeLiquidationsTotal)})
                </p>
            </div>

            {/* Liquidations Table */}
            <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm dark:shadow-none overflow-hidden !p-0">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <Receipt size={20} className="text-purple-600 dark:text-purple-400" />
                        Liquidation History
                    </h3>

                    <div className="flex justify-end gap-2">
                        <DateRangeFilter
                            onFilterChange={(start, end) => setDateRange({ start, end })}
                        />
                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                            title="Export to CSV"
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {filteredLiquidations.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">No liquidations yet. Create your first one!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                            <thead className="text-xs uppercase text-slate-600 dark:text-slate-400 bg-slate-50/90 dark:bg-slate-900/80 sticky top-0 z-20 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    {viewAll && <th className="px-4 py-3 font-semibold">Custodian</th>}
                                    <th className="px-4 py-3 font-semibold">Business</th>
                                    <th className="px-4 py-3 text-center font-semibold">Items</th>
                                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">PRF</th>
                                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredLiquidations.map((liq) => (
                                    <tr
                                        key={liq.id}
                                        onClick={() => setSelectedLiquidation(liq)}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-3 text-slate-900 dark:text-white">
                                            {new Date(liq.dateCreated).toLocaleDateString()}
                                        </td>
                                        {viewAll && (
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <UserIcon size={14} className="text-slate-400 dark:text-slate-500" />
                                                    <span className="text-slate-600 dark:text-slate-300">{getUserName(liq.userId)}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 size={14} className="text-slate-400 dark:text-slate-500" />
                                                <span className="text-slate-600 dark:text-slate-300">{getBusinessName(liq.businessId)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs text-slate-600 dark:text-slate-300 font-medium">
                                                {liq.expenses.length}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(liq.totalAmount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(liq.status)}
                                                {liq.isLate && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                                                        LATE {liq.daysLate ? `(+${liq.daysLate}d)` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-purple-600 dark:text-purple-400">
                                            {liq.replenishmentPrfId || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPrintLiquidation(liq); }}
                                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                                                    title="Print Preview"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                <Eye size={16} className="text-slate-400" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* New Liquidation Drawer */}
            <PCFLiquidationDrawer
                isOpen={showDrawer}
                onClose={handleCloseDrawer}
                onSubmit={
                    editingLiquidation?.status === PCFStatus.DRAFT
                        ? handleEditSubmit // Submit draft for approval after editing
                        : editingLiquidation?.status === PCFStatus.REJECTED
                            ? handleEditSubmit // Refile rejected
                            : handleSubmitLiquidation // New liquidation
                }
                onSaveDraft={
                    editingLiquidation?.status === PCFStatus.DRAFT
                        ? handleUpdateDraft // Update existing draft
                        : editingLiquidation
                            ? undefined // No save draft for rejected refiling
                            : handleSaveDraft // New draft
                }
                cashOnHand={walletStats.cashOnHand}
                pcfCeiling={pcfCeiling}
                businesses={businesses}
                editingId={editingLiquidation?.id}
                initialData={editingLiquidation ? {
                    expenses: editingLiquidation.expenses,
                    receiptsLink: editingLiquidation.receiptsLink,
                    remarks: editingLiquidation.remarks,
                } : null}
                title={
                    editingLiquidation?.status === PCFStatus.DRAFT
                        ? 'Edit Draft Liquidation'
                        : editingLiquidation?.status === PCFStatus.REJECTED
                            ? 'Edit & Refile Liquidation'
                            : undefined
                }
            />

            {/* Detail Drawer (slide-in from right) */}
            {selectedLiquidation && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setSelectedLiquidation(null)}
                    />

                    {/* Drawer */}
                    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col animate-slide-in-right">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Receipt size={20} className="text-purple-600 dark:text-purple-400" />
                                    Liquidation Details
                                    {selectedLiquidation.isLate && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                                            LATE {selectedLiquidation.daysLate ? `(+${selectedLiquidation.daysLate}d)` : ''}
                                        </span>
                                    )}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {new Date(selectedLiquidation.dateCreated).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div className="flex items-center">
                                <button
                                    onClick={() => {
                                        const lines: string[] = [];
                                        const esc = (v: string | number | null | undefined) => {
                                            if (v === null || v === undefined) return '';
                                            const s = String(v);
                                            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
                                        };

                                        // Header section with Metadata
                                        lines.push('PCF Liquidation Export');
                                        lines.push(`Title,Liquidation Details`);
                                        lines.push(`Export Date,${new Date().toLocaleString()}`);
                                        lines.push(`Status,${selectedLiquidation.status}`);
                                        lines.push(`Late,${selectedLiquidation.isLate ? `Yes (+${selectedLiquidation.daysLate} days)` : 'No'}`);
                                        lines.push(`Total Amount,${selectedLiquidation.totalAmount.toFixed(2)}`);
                                        lines.push(`Remarks,${esc(selectedLiquidation.remarks || '')}`);
                                        if (selectedLiquidation.replenishmentPrfId) lines.push(`Replenishment PRF,${esc(selectedLiquidation.replenishmentPrfId)}`);
                                        lines.push('');

                                        // Expenses Table
                                        lines.push('Date,Payee/Vendor,TIN,OR No.,Address,COA Code,COA Name,Description,VAT,EWT,Amount,Business Unit');

                                        selectedLiquidation.expenses.forEach(exp => {
                                            lines.push([
                                                esc(exp.date),
                                                esc(exp.payeeVendor),
                                                esc(exp.tin),
                                                esc(exp.orNo),
                                                esc(exp.completeAddress),
                                                esc(exp.coaCode),
                                                esc(exp.coaName),
                                                esc(exp.itemDescription),
                                                (exp.vat || 0).toFixed(2),
                                                (exp.ewt || 0).toFixed(2),
                                                (exp.amount || 0).toFixed(2),
                                                esc(exp.buName)
                                            ].join(','));
                                        });

                                        // Footer Totals
                                        lines.push('');
                                        lines.push(`,,,,,,,,${(selectedLiquidation.totalVat || 0).toFixed(2)},${(selectedLiquidation.totalEwt || 0).toFixed(2)},${selectedLiquidation.totalAmount.toFixed(2)},`);

                                        const BOM = '\uFEFF';
                                        const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        const today = new Date().toISOString().split('T')[0];
                                        link.download = `pcf_liquidation_details_${today}.csv`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors mr-2"
                                    title="Export to CSV"
                                >
                                    <Receipt size={20} />
                                </button>
                                <button
                                    onClick={() => setSelectedLiquidation(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-700 px-4 bg-slate-50 dark:bg-slate-800/30">
                            <button
                                onClick={() => setDetailTab('details')}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${detailTab === 'details'
                                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 dark:border-purple-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                                    }`}
                            >
                                Details
                            </button>
                            {allocationRules.some(r => r.isEnabled) && (
                                <button
                                    onClick={() => setDetailTab('sharing')}
                                    className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${detailTab === 'sharing'
                                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 dark:border-purple-400'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                                        }`}
                                >
                                    BU Sharing
                                    <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-600/30 text-purple-600 dark:text-purple-300 rounded text-[10px] font-medium">
                                        {allocationRules.find(r => r.isEnabled)?.allocations.length || 0}
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Late Submission Warning */}
                            {selectedLiquidation.isLate && (
                                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-start gap-3">
                                    <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-red-400">Late Submission</p>
                                        <p className="text-xs text-red-300/70 mt-1">
                                            This liquidation was submitted {selectedLiquidation.daysLate} day{selectedLiquidation.daysLate !== 1 ? 's' : ''} after the deadline
                                            (Day {selectedLiquidation.deadlineDay} of the month).
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Status & Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</p>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedLiquidation.status)}
                                        {selectedLiquidation.isLate && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                                LATE
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Amount</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(selectedLiquidation.totalAmount)}</p>
                                </div>
                            </div>

                            {/* PRF Link if available */}
                            {selectedLiquidation.replenishmentPrfId && (
                                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                                    <p className="text-xs text-purple-300 uppercase tracking-wider mb-1">Replenishment PRF</p>
                                    <p className="text-lg font-mono text-purple-400">{selectedLiquidation.replenishmentPrfId}</p>
                                </div>
                            )}

                            {/* Business Info */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-transparent">
                                <Building2 size={18} className="text-slate-500" />
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Business Unit</p>
                                    <p className="text-slate-900 dark:text-white">{getBusinessName(selectedLiquidation.businessId)}</p>
                                </div>
                            </div>

                            {/* Details Tab */}
                            {detailTab === 'details' && (
                                <>
                                    {/* Expense Details Section */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <FileText size={14} className="text-purple-600 dark:text-purple-400" />
                                            Expense Items ({selectedLiquidation.expenses.length})
                                        </h3>
                                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase sticky top-0 z-20 backdrop-blur-sm">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Date</th>
                                                        <th className="px-3 py-2 text-left">Payee/Vendor</th>
                                                        <th className="px-3 py-2 text-left">OR#</th>
                                                        <th className="px-3 py-2 text-left">COA</th>
                                                        <th className="px-3 py-2 text-left">Description</th>
                                                        <th className="px-3 py-2 text-left">BU</th>
                                                        <th className="px-3 py-2 text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300">
                                                    {selectedLiquidation.expenses.map((exp, i) => {
                                                        const isShared = exp.buName?.toUpperCase().includes('ATHOUSANDCONCEPTS') && exp.buName?.toUpperCase().includes('CORP');
                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                                <td className="px-3 py-2">{exp.date}</td>
                                                                <td className="px-3 py-2">{exp.payeeVendor || '-'}</td>
                                                                <td className="px-3 py-2 font-mono">{exp.orNo}</td>
                                                                <td className="px-3 py-2">
                                                                    <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
                                                                        {exp.coaCode || exp.classification || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-normal break-words max-w-[120px]">
                                                                    {exp.itemDescription || '-'}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs">{exp.buName || '-'}</span>
                                                                        {isShared && (
                                                                            <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-600/30 text-purple-600 dark:text-purple-300 rounded text-[8px] font-medium">SHARE</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-medium">{formatCurrency(exp.amount)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* BU Sharing Tab */}
                            {detailTab === 'sharing' && (() => {
                                // Find the allocation rule for this liquidation's business
                                const activeRule = allocationRules.find(r => r.isEnabled);
                                const totalLiquidationAmount = selectedLiquidation.totalAmount;

                                // Calculate shares based on allocation rules
                                const allocatedShares = activeRule?.allocations.map((alloc, index) => {
                                    const isLast = index === activeRule.allocations.length - 1;
                                    let amount: number;
                                    if (isLast) {
                                        // Use remainder for last allocation to avoid rounding errors
                                        const previousTotal = activeRule.allocations.slice(0, index).reduce((sum, a) =>
                                            sum + Math.round((totalLiquidationAmount * a.percentage / 100) * 100) / 100, 0
                                        );
                                        amount = totalLiquidationAmount - previousTotal;
                                    } else {
                                        amount = Math.round((totalLiquidationAmount * alloc.percentage / 100) * 100) / 100;
                                    }
                                    return {
                                        buName: alloc.targetBuName,
                                        percentage: alloc.percentage,
                                        amount
                                    };
                                }) || [];

                                return (
                                    <div className="space-y-4">
                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                                                <p className="text-xs text-purple-400 uppercase">Total Amount</p>
                                                <p className="text-xl font-bold text-purple-300">{formatCurrency(totalLiquidationAmount)}</p>
                                            </div>
                                            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                                                <p className="text-xs text-purple-400 uppercase">Allocated To</p>
                                                <p className="text-xl font-bold text-purple-300">{allocatedShares.length} BUs</p>
                                            </div>
                                        </div>

                                        {/* Per-BU Breakdown */}
                                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-300 mb-3">Per-BU Share (Based on Allocation Rules)</h4>
                                            {activeRule ? (
                                                <>
                                                    <p className="text-xs text-slate-500 mb-3">
                                                        From: <span className="text-purple-600 dark:text-purple-400">{activeRule.sourceBuName}</span>
                                                    </p>
                                                    <div className="space-y-2">
                                                        {allocatedShares.map((share, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-sm bg-slate-100 dark:bg-slate-700/30 px-3 py-2 rounded">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-slate-700 dark:text-slate-300 whitespace-normal break-words max-w-[150px]">{share.buName}</span>
                                                                    <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                                                                        {share.percentage}%
                                                                    </span>
                                                                </div>
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(share.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 flex justify-between text-sm font-bold">
                                                        <span className="text-slate-700 dark:text-slate-300">Total</span>
                                                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalLiquidationAmount)}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-4">
                                                    <p className="text-slate-400 text-sm">No expense allocation rules configured.</p>
                                                    <p className="text-slate-500 text-xs mt-1">Configure rules in Admin → Settings → Expense Allocation</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Tax Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-400">VAT</p>
                                    <p className="text-lg font-medium text-white">{formatCurrency(selectedLiquidation.totalVat)}</p>
                                </div>
                                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-400">EWT</p>
                                    <p className="text-lg font-medium text-white">{formatCurrency(selectedLiquidation.totalEwt)}</p>
                                </div>
                                <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-emerald-400">Net Amount</p>
                                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(selectedLiquidation.netAmount)}</p>
                                </div>
                            </div>

                            {/* Remarks */}
                            {selectedLiquidation.remarks && (
                                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
                                    <p className="text-xs text-slate-400 mb-2">Remarks</p>
                                    <p className="text-sm text-slate-300">{selectedLiquidation.remarks}</p>
                                </div>
                            )}

                            {/* Receipts Link */}
                            {selectedLiquidation.receiptsLink && (
                                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                                    <p className="text-xs text-blue-300 mb-2">Receipts/Attachments</p>
                                    <a
                                        href={selectedLiquidation.receiptsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 underline text-sm"
                                    >
                                        {selectedLiquidation.receiptsLink}
                                    </a>
                                </div>
                            )}

                            {/* Rejection Reason if rejected */}
                            {selectedLiquidation.status === PCFStatus.REJECTED && selectedLiquidation.rejectionReason && (
                                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                                    <p className="text-xs text-red-300 mb-2">Rejection Reason</p>
                                    <p className="text-sm text-red-400">{selectedLiquidation.rejectionReason}</p>
                                    {selectedLiquidation.rejectedByName && (
                                        <p className="text-xs text-slate-500 mt-2">Rejected by: {selectedLiquidation.rejectedByName}</p>
                                    )}
                                </div>
                            )}

                            {/* Liquidation Submitted Date */}
                            {selectedLiquidation.dateSubmitted && (
                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                                        <Receipt size={12} /> Liquidation Submitted
                                    </p>
                                    <p className="text-sm text-blue-400 font-medium">
                                        {new Date(selectedLiquidation.dateSubmitted).toLocaleString('en-US', {
                                            month: 'short', day: '2-digit', year: 'numeric',
                                            hour: 'numeric', minute: '2-digit', hour12: true
                                        })}
                                    </p>
                                </div>
                            )}

                            {/* Audit Cleared Remarks - Show when audit approved */}
                            {selectedLiquidation.auditRemarks && (
                                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                                    <h5 className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                        <CheckCircle size={12} /> Audit Cleared Remarks
                                    </h5>
                                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedLiquidation.auditRemarks}</p>
                                    {selectedLiquidation.auditClearedAt && (
                                        <p className="text-xs text-green-500 mt-2">
                                            Cleared on: {new Date(selectedLiquidation.auditClearedAt).toLocaleString('en-US', {
                                                month: 'short', day: '2-digit', year: 'numeric',
                                                hour: 'numeric', minute: '2-digit', hour12: true
                                            })}
                                        </p>
                                    )}
                                    {selectedLiquidation.auditReviewedByName && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            Audit reviewed by: {selectedLiquidation.auditReviewedByName}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Audit Notes History */}
                            {selectedLiquidation.auditNotesHistory && selectedLiquidation.auditNotesHistory.length > 0 && (
                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                    <h5 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-1">
                                        <FileText size={12} /> Audit Notes History
                                    </h5>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {selectedLiquidation.auditNotesHistory
                                            .slice()
                                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                            .map((entry, index) => (
                                                <div
                                                    key={entry.id || index}
                                                    className={`p-2 rounded border ${entry.action === 'REJECTED'
                                                        ? 'bg-red-900/20 border-red-700/30'
                                                        : entry.action === 'CLEARED'
                                                            ? 'bg-green-900/20 border-green-700/30'
                                                            : entry.action === 'REFILE'
                                                                ? 'bg-blue-900/20 border-blue-700/30'
                                                                : entry.action === 'APPROVED'
                                                                    ? 'bg-emerald-900/20 border-emerald-700/30'
                                                                    : 'bg-slate-700/50 border-slate-600'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-xs font-medium uppercase ${entry.action === 'REJECTED'
                                                            ? 'text-red-400'
                                                            : entry.action === 'CLEARED'
                                                                ? 'text-green-400'
                                                                : entry.action === 'REFILE'
                                                                    ? 'text-blue-400'
                                                                    : entry.action === 'APPROVED'
                                                                        ? 'text-emerald-400'
                                                                        : 'text-slate-400'
                                                            }`}>
                                                            {entry.action === 'REJECTED' && '❌ '}
                                                            {entry.action === 'CLEARED' && '✅ '}
                                                            {entry.action === 'REFILE' && '🔄 '}
                                                            {entry.action === 'APPROVED' && '✓ '}
                                                            {entry.action === 'COMMENT' && '💬 '}
                                                            {entry.action === 'AUDIT_REVIEW' && '🔍 '}
                                                            {entry.action}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {new Date(entry.timestamp).toLocaleDateString('en-US', {
                                                                month: 'short', day: '2-digit', year: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{entry.note}</p>
                                                    <p className="text-xs text-slate-500 mt-1">by {entry.actorName}</p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex gap-3">
                            <button
                                onClick={() => setSelectedLiquidation(null)}
                                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            {selectedLiquidation.status === PCFStatus.DRAFT && (
                                <>
                                    <button
                                        onClick={() => handleEditDraft(selectedLiquidation)}
                                        className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <FileText size={16} />
                                        Edit Draft
                                    </button>
                                    <button
                                        onClick={() => handleSubmitDraft(selectedLiquidation)}
                                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <CheckCircle size={16} />
                                        Submit for Approval
                                    </button>
                                </>
                            )}
                            {selectedLiquidation.status === PCFStatus.REJECTED && (
                                <button
                                    onClick={() => handleEditRejected(selectedLiquidation)}
                                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                >
                                    <FileText size={16} />
                                    Edit & Refile
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Print Modal */}
            {printLiquidation && (
                <PCFPrintModal
                    liquidation={printLiquidation}
                    onClose={() => setPrintLiquidation(null)}
                    business={businesses.find(b => b.id === printLiquidation.businessId)}
                />
            )}
        </div>
    );
};

export default PCFView;
