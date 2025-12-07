import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, Clock, Receipt, AlertTriangle, FileText, DollarSign, User, Building2, Wallet } from 'lucide-react';
import Card from '../../../shared/components/Card';
import type { User as UserType, Business } from '../../../shared/types';
import { PCFService, PCFStatus, type PCFLiquidation } from '../services/pcf.service';

interface PCFApprovalViewProps {
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

const PCFApprovalView: React.FC<PCFApprovalViewProps> = ({ currentUser, businesses, allUsers }) => {
    const [liquidations, setLiquidations] = useState<PCFLiquidation[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectModalId, setRejectModalId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [selectedLiquidation, setSelectedLiquidation] = useState<PCFLiquidation | null>(null);

    // Fetch all pending liquidations (manager view)
    const loadPendingLiquidations = async () => {
        setLoading(true);
        try {
            const pendingLiquidations = await PCFService.getPendingLiquidations();
            setLiquidations(pendingLiquidations);
        } catch (error) {
            console.error('Error loading pending liquidations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPendingLiquidations();
    }, []);

    // Get pending liquidations count
    const pendingLiquidations = useMemo(() => {
        return liquidations.filter(l => l.status === PCFStatus.PENDING_APPROVAL);
    }, [liquidations]);

    // Get user by ID
    const getUserById = (userId: string) => {
        return allUsers.find(u => u.id === userId);
    };

    // Get business by ID
    const getBusinessName = (businessId: string) => {
        return businesses.find(b => b.id === businessId)?.name || 'Unknown';
    };

    // Handle approve - Fast Track PRF creation
    const handleApprove = async (liquidation: PCFLiquidation) => {
        if (!confirm(`Approve this PCF liquidation for ${formatCurrency(liquidation.totalAmount)}?\n\nThis will automatically create a PRF for replenishment (Fast Track - skips approval queue).`)) {
            return;
        }

        setProcessingId(liquidation.id);
        try {
            const result = await PCFService.approveAndReplenish(
                liquidation.id,
                currentUser.id,
                currentUser.name,
                liquidation.businessId,
                liquidation.userName
            );

            alert(`✅ PCF Approved!\n\nPRF ${result.prfId} created for replenishment.\n(Auto-approved, ready for fund release)`);

            // Refresh list
            await loadPendingLiquidations();
            setSelectedLiquidation(null);
        } catch (error: any) {
            console.error('Error approving PCF:', error);
            alert(`Failed to approve: ${error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    // Handle reject
    const handleReject = async () => {
        if (!rejectModalId || !rejectReason.trim()) {
            alert('Please provide a reason for rejection.');
            return;
        }

        setProcessingId(rejectModalId);
        try {
            await PCFService.rejectLiquidation(
                rejectModalId,
                currentUser.id,
                currentUser.name,
                rejectReason
            );

            alert('PCF Liquidation rejected.');

            // Refresh list
            await loadPendingLiquidations();
            setRejectModalId(null);
            setRejectReason('');
            setSelectedLiquidation(null);
        } catch (error: any) {
            console.error('Error rejecting PCF:', error);
            alert(`Failed to reject: ${error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl pb-10">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">PCF Approvals</h1>
                <p className="text-slate-400 text-sm">Review and approve Petty Cash Fund liquidations. Approval auto-creates PRF for replenishment.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-yellow-900/30 to-slate-900 border-yellow-700/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-yellow-900/50 flex items-center justify-center">
                            <Clock size={24} className="text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Pending Approval</p>
                            <p className="text-2xl font-bold text-yellow-400">{pendingLiquidations.length}</p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center">
                            <DollarSign size={24} className="text-slate-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Pending Amount</p>
                            <p className="text-2xl font-bold text-white">
                                {formatCurrency(pendingLiquidations.reduce((sum, l) => sum + l.totalAmount, 0))}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-purple-900/30 to-slate-900 border-purple-700/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-900/50 flex items-center justify-center">
                            <Wallet size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Fast Track</p>
                            <p className="text-sm text-purple-300">Auto-creates PRF @ APPROVED</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pending List */}
                <Card className="lg:col-span-2">
                    <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                        <Clock size={20} className="text-yellow-400" />
                        Pending Liquidations
                    </h3>

                    {pendingLiquidations.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
                            <p className="text-slate-400">No pending PCF liquidations to approve.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingLiquidations.map((liq) => {
                                const user = getUserById(liq.userId);
                                return (
                                    <div
                                        key={liq.id}
                                        onClick={() => setSelectedLiquidation(liq)}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedLiquidation?.id === liq.id
                                            ? 'border-purple-500 bg-purple-900/20'
                                            : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <User size={14} className="text-slate-500" />
                                                    <span className="font-medium text-white">{liq.userName}</span>
                                                    <span className="text-xs text-slate-500">({user?.role || 'Unknown'})</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Building2 size={12} />
                                                    {getBusinessName(liq.businessId)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg text-white">{formatCurrency(liq.totalAmount)}</p>
                                                <p className="text-xs text-slate-500">
                                                    {liq.expenses.length} expense{liq.expenses.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500">
                                            Submitted: {new Date(liq.dateSubmitted || liq.dateCreated).toLocaleDateString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                {/* Detail Panel - Removed, now using Drawer */}
            </div>

            {/* Detail Drawer (slide-in from right) */}
            {selectedLiquidation && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setSelectedLiquidation(null)}
                    />

                    {/* Drawer */}
                    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FileText size={20} className="text-purple-400" />
                                    PCF Liquidation Details
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    Submitted: {new Date(selectedLiquidation.dateSubmitted || selectedLiquidation.dateCreated).toLocaleDateString('en-US', {
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
                            {/* Custodian Info */}
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Custodian</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-900/50 flex items-center justify-center">
                                        <User size={20} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium text-lg">{selectedLiquidation.userName}</p>
                                        <p className="text-sm text-slate-400 flex items-center gap-1">
                                            <Building2 size={12} />
                                            {getBusinessName(selectedLiquidation.businessId)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Amount Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-400">VAT</p>
                                    <p className="text-xl font-medium text-white">{formatCurrency(selectedLiquidation.totalVat)}</p>
                                </div>
                                <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-400">EWT</p>
                                    <p className="text-xl font-medium text-white">{formatCurrency(selectedLiquidation.totalEwt)}</p>
                                </div>
                            </div>

                            {/* Total Amount Card */}
                            <div className="bg-gradient-to-r from-purple-900/40 to-slate-800/50 rounded-lg p-4 border border-purple-700/30">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-300">Total Amount</span>
                                    <span className="text-2xl font-bold text-white">{formatCurrency(selectedLiquidation.totalAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-xs text-slate-400">Net (Amt - EWT + VAT)</span>
                                    <span className="text-sm text-slate-300">{formatCurrency(selectedLiquidation.netAmount)}</span>
                                </div>
                            </div>

                            {/* Expense Details Table */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Receipt size={14} className="text-purple-400" />
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
                                                <th className="px-3 py-2 text-left">Description</th>
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
                                                    <td className="px-3 py-2 max-w-[150px] truncate" title={exp.itemDescription}>
                                                        {exp.itemDescription || '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(exp.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-800/70 border-t border-slate-600">
                                            <tr>
                                                <td colSpan={5} className="px-3 py-2 text-right font-medium text-slate-300">Total:</td>
                                                <td className="px-3 py-2 text-right font-bold text-white">{formatCurrency(selectedLiquidation.totalAmount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Receipts Link */}
                            {selectedLiquidation.receiptsLink && (
                                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                                    <p className="text-xs text-blue-300 mb-2">📎 Receipts/Attachments</p>
                                    <a
                                        href={selectedLiquidation.receiptsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 underline text-sm break-all"
                                    >
                                        {selectedLiquidation.receiptsLink}
                                    </a>
                                </div>
                            )}

                            {/* Remarks */}
                            {selectedLiquidation.remarks && (
                                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
                                    <p className="text-xs text-slate-400 mb-2">Remarks</p>
                                    <p className="text-sm text-slate-300">{selectedLiquidation.remarks}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer with Actions */}
                        <div className="p-4 border-t border-slate-700 bg-slate-800/50 space-y-4">
                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleApprove(selectedLiquidation)}
                                    disabled={processingId === selectedLiquidation.id}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    <CheckCircle size={18} />
                                    {processingId === selectedLiquidation.id ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                    onClick={() => setRejectModalId(selectedLiquidation.id)}
                                    disabled={processingId === selectedLiquidation.id}
                                    className="px-6 bg-red-600/20 hover:bg-red-600/30 text-red-400 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 border border-red-700/30 transition-colors"
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>

                            {/* Fast Track Notice */}
                            <div className="flex items-start gap-2 p-3 bg-blue-900/30 border border-blue-700/30 rounded-lg">
                                <AlertTriangle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-blue-300">
                                    <strong>Fast Track:</strong> Approving creates PRF at "Approved for Payment" status.
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Reject Modal */}
            {rejectModalId && (
                <>
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setRejectModalId(null)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
                            <div className="p-6 border-b border-slate-700">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <XCircle size={24} className="text-red-400" />
                                    Reject PCF Liquidation
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Reason for Rejection</label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="Please provide a reason..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setRejectModalId(null);
                                        setRejectReason('');
                                    }}
                                    className="px-4 py-2 text-slate-300 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={!rejectReason.trim() || processingId === rejectModalId}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                                >
                                    {processingId === rejectModalId ? 'Rejecting...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PCFApprovalView;
