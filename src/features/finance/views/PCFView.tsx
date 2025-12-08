import React, { useState, useEffect } from 'react';
import { Wallet, Plus, FileText, CheckCircle, Clock, XCircle, AlertTriangle, Receipt, DollarSign, Building2, Eye } from 'lucide-react';
import Card from '../../../shared/components/Card';
import type { User, Business } from '../../../shared/types';
import { PCFService, PCFStatus, type PCFLiquidation } from '../services/pcf.service';
import PCFLiquidationDrawer from '../components/PCFLiquidationDrawer';

interface PCFViewProps {
    currentUser: User;
    businesses: Business[];
    allUsers: User[];
}

// Helper: Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

const PCFView: React.FC<PCFViewProps> = ({ currentUser, businesses }) => {
    const [liquidations, setLiquidations] = useState<PCFLiquidation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDrawer, setShowDrawer] = useState(false);
    const [selectedLiquidation, setSelectedLiquidation] = useState<PCFLiquidation | null>(null);
    const [editingLiquidation, setEditingLiquidation] = useState<PCFLiquidation | null>(null);
    const [walletStats, setWalletStats] = useState({
        cashOnHand: 0,
        activeLiquidationsTotal: 0,
        activeLiquidationsCount: 0,
    });

    const pcfCeiling = currentUser.pcfCeiling || 0;

    // Fetch liquidations and calculate wallet
    const loadData = async () => {
        setLoading(true);
        try {
            const [userLiquidations, stats] = await Promise.all([
                PCFService.getUserLiquidations(currentUser.id),
                PCFService.calculateCashOnHand(currentUser.id, pcfCeiling),
            ]);
            setLiquidations(userLiquidations);
            setWalletStats(stats);
        } catch (error) {
            console.error('Error loading PCF data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser.id, pcfCeiling]);

    // Status badge helper
    const getStatusBadge = (status: PCFStatus) => {
        const configs: Record<PCFStatus, { bg: string; text: string; icon: React.ReactNode }> = {
            [PCFStatus.DRAFT]: { bg: 'bg-slate-600/30', text: 'text-slate-300', icon: <FileText size={12} /> },
            [PCFStatus.PENDING_APPROVAL]: { bg: 'bg-yellow-600/30', text: 'text-yellow-300', icon: <Clock size={12} /> },
            [PCFStatus.APPROVED]: { bg: 'bg-green-600/30', text: 'text-green-300', icon: <CheckCircle size={12} /> },
            [PCFStatus.APPROVED_WAITING_RELEASE]: { bg: 'bg-blue-600/30', text: 'text-blue-300', icon: <Wallet size={12} /> },
            [PCFStatus.REPLENISHED]: { bg: 'bg-emerald-600/30', text: 'text-emerald-300', icon: <DollarSign size={12} /> },
            [PCFStatus.REJECTED]: { bg: 'bg-red-600/30', text: 'text-red-300', icon: <XCircle size={12} /> },
        };
        const config = configs[status];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                {config.icon}
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    // Get business name
    const getBusinessName = (businessId: string) => {
        return businesses.find(b => b.id === businessId)?.name || 'Unknown';
    };

    // Handle submit from drawer
    const handleSubmitLiquidation = async (expenses: any[], receiptsLink: string, remarks: string) => {
        await PCFService.submitLiquidation(
            currentUser.id,
            currentUser.name,
            currentUser.businessId,
            expenses,
            receiptsLink,
            undefined,
            remarks
        );
        await loadData();
        setShowDrawer(false);
    };

    // Handle save draft from drawer
    const handleSaveDraft = async (expenses: any[], receiptsLink: string, remarks: string) => {
        await PCFService.createDraftLiquidation(
            currentUser.id,
            currentUser.name,
            currentUser.businessId,
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

    // Handle submit edited/refiled liquidation
    const handleEditSubmit = async (expenses: any[], receiptsLink: string, remarks: string) => {
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
                <button
                    onClick={() => setShowDrawer(true)}
                    disabled={walletStats.cashOnHand <= 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus size={18} />
                    New Liquidation
                </button>
            </div>

            {/* Wallet Cards - SAFETY NET LOGIC */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* PCF Ceiling Card */}
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-blue-900/50 flex items-center justify-center">
                            <DollarSign size={28} className="text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-400 uppercase tracking-wider">PCF Ceiling</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(pcfCeiling)}</p>
                            <p className="text-xs text-slate-500">Your allocated revolving fund</p>
                        </div>
                    </div>
                </Card>

                {/* Pending/Used Amount */}
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-yellow-700/30">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-yellow-900/50 flex items-center justify-center">
                            <Clock size={28} className="text-yellow-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-400 uppercase tracking-wider">
                                Pending ({walletStats.activeLiquidationsCount})
                            </p>
                            <p className="text-2xl font-bold text-yellow-400">
                                {formatCurrency(walletStats.activeLiquidationsTotal)}
                            </p>
                            <p className="text-xs text-slate-500">Awaiting replenishment</p>
                        </div>
                    </div>
                </Card>

                {/* Cash On Hand - Available Balance */}
                <Card className={`bg-gradient-to-br ${walletStats.cashOnHand > 0 ? 'from-emerald-900/30 to-slate-900 border-emerald-700/50' : 'from-red-900/30 to-slate-900 border-red-700/50'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${walletStats.cashOnHand > 0 ? 'bg-emerald-900/50' : 'bg-red-900/50'}`}>
                            <Wallet size={28} className={walletStats.cashOnHand > 0 ? 'text-emerald-400' : 'text-red-400'} />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Available Balance</p>
                            <p className={`text-2xl font-bold ${walletStats.cashOnHand > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(walletStats.cashOnHand)}
                            </p>
                            {walletStats.cashOnHand <= 0 ? (
                                <p className="text-xs text-red-400 flex items-center gap-1">
                                    <AlertTriangle size={10} /> Wait for replenishment
                                </p>
                            ) : (
                                <p className="text-xs text-emerald-500">Ready for use</p>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Visual Progress Bar */}
            <Card className="!py-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Fund Utilization</span>
                    <span className="text-sm text-slate-300">{usedPercent.toFixed(0)}% used</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
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
            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                <p className="text-xs text-slate-400">
                    <strong className="text-blue-400">Safety Net Calculation:</strong>{' '}
                    Available Balance = Ceiling ({formatCurrency(pcfCeiling)}) − Pending Liquidations ({formatCurrency(walletStats.activeLiquidationsTotal)})
                </p>
            </div>

            {/* Liquidations Table */}
            <Card>
                <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                    <Receipt size={20} className="text-purple-400" />
                    Liquidation History
                </h3>

                {liquidations.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                        <p className="text-slate-400">No liquidations yet. Create your first one!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs uppercase text-slate-400 bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Business</th>
                                    <th className="px-4 py-3 text-center">Items</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">PRF</th>
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {liquidations.map((liq) => (
                                    <tr
                                        key={liq.id}
                                        onClick={() => setSelectedLiquidation(liq)}
                                        className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-3">
                                            {new Date(liq.dateCreated).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 flex items-center gap-2">
                                            <Building2 size={14} className="text-slate-500" />
                                            {getBusinessName(liq.businessId)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-slate-700 px-2 py-1 rounded text-xs">
                                                {liq.expenses.length}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatCurrency(liq.totalAmount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(liq.status)}
                                                {liq.isLate && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                                        LATE {liq.daysLate ? `(+${liq.daysLate}d)` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-purple-400">
                                            {liq.replenishmentPrfId || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Eye size={16} className="text-slate-400" />
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
                onSubmit={editingLiquidation ? handleEditSubmit : handleSubmitLiquidation}
                onSaveDraft={editingLiquidation ? undefined : handleSaveDraft}
                cashOnHand={walletStats.cashOnHand}
                pcfCeiling={pcfCeiling}
                editingId={editingLiquidation?.id}
                initialData={editingLiquidation ? {
                    expenses: editingLiquidation.expenses,
                    receiptsLink: editingLiquidation.receiptsLink,
                    remarks: editingLiquidation.remarks,
                } : null}
                title={editingLiquidation ? 'Edit & Refile Liquidation' : undefined}
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
                    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-slide-in-right">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Receipt size={20} className="text-purple-400" />
                                    Liquidation Details
                                    {selectedLiquidation.isLate && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                            LATE {selectedLiquidation.daysLate ? `(+${selectedLiquidation.daysLate}d)` : ''}
                                        </span>
                                    )}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    {new Date(selectedLiquidation.dateCreated).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLiquidation(null)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
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
                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Status</p>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedLiquidation.status)}
                                        {selectedLiquidation.isLate && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
                                                LATE
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Total Amount</p>
                                    <p className="text-xl font-bold text-white">{formatCurrency(selectedLiquidation.totalAmount)}</p>
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
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
                                <Building2 size={18} className="text-slate-500" />
                                <div>
                                    <p className="text-xs text-slate-400">Business Unit</p>
                                    <p className="text-white">{getBusinessName(selectedLiquidation.businessId)}</p>
                                </div>
                            </div>

                            {/* Expense Details Section */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FileText size={14} className="text-purple-400" />
                                    Expense Items ({selectedLiquidation.expenses.length})
                                </h3>
                                <div className="overflow-x-auto border border-slate-700 rounded-lg">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-800 text-slate-400 uppercase">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Date</th>
                                                <th className="px-3 py-2 text-left">Payee/Vendor</th>
                                                <th className="px-3 py-2 text-left">OR#</th>
                                                <th className="px-3 py-2 text-left">Classification</th>
                                                <th className="px-3 py-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 text-slate-300">
                                            {selectedLiquidation.expenses.map((exp, i) => (
                                                <tr key={i} className="hover:bg-slate-800/30">
                                                    <td className="px-3 py-2">{exp.date}</td>
                                                    <td className="px-3 py-2">{exp.payeeVendor || '-'}</td>
                                                    <td className="px-3 py-2 font-mono">{exp.orNo}</td>
                                                    <td className="px-3 py-2">
                                                        <span className="bg-slate-700 px-2 py-0.5 rounded text-xs">
                                                            {exp.classification}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(exp.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

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
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex gap-3">
                            <button
                                onClick={() => setSelectedLiquidation(null)}
                                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            >
                                Close
                            </button>
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
        </div>
    );
};

export default PCFView;
