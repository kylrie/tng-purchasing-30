import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, FileText, User, Building2, Receipt, Printer } from 'lucide-react';
import Card from '../../../shared/components/Card';
import type { User as UserType, Business } from '../../../shared/types';
import { PCFService, type PCFLiquidation } from '../services/pcf.service';
import PCFPrintModal from '../components/PCFPrintModal';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';

interface PCFAuditReviewViewProps {
    currentUser: UserType;
    businesses: Business[];
    allUsers: UserType[];
}

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

const PCFAuditReviewView: React.FC<PCFAuditReviewViewProps> = ({ currentUser, businesses, allUsers }) => {
    const [liquidations, setLiquidations] = useState<PCFLiquidation[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectModalId, setRejectModalId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [approveModalId, setApproveModalId] = useState<string | null>(null);
    const [auditRemarks, setAuditRemarks] = useState('');
    const [selectedLiquidation, setSelectedLiquidation] = useState<PCFLiquidation | null>(null);

    const [printLiquidation, setPrintLiquidation] = useState<PCFLiquidation | null>(null);
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

    const loadAuditReviewLiquidations = async () => {
        setLoading(true);
        try {
            const items = await PCFService.getAuditReviewLiquidations();
            setLiquidations(items);
        } catch (error) {
            console.error('Error loading audit review liquidations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAuditReviewLiquidations();
    }, []);

    const getUserById = (userId: string) => allUsers.find(u => u.id === userId);
    const getBusinessName = (businessId: string) => businesses.find(b => b.id === businessId)?.name || 'Unknown';

    const handleApproveAuditReview = async (liquidation: PCFLiquidation) => {
        // Open the approve modal instead of confirm dialog
        setApproveModalId(liquidation.id);
    };

    const handleConfirmApproval = async () => {
        if (!approveModalId) return;
        setProcessingId(approveModalId);
        try {
            await PCFService.approveAuditReview(approveModalId, currentUser.id, currentUser.name, auditRemarks);
            alert('✅ Audit Review Approved!\n\nMoved to pending manager approval.');
            await loadAuditReviewLiquidations();
            setSelectedLiquidation(null);
            setApproveModalId(null);
            setAuditRemarks('');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to approve: ${message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModalId || !rejectReason.trim()) {
            alert('Please provide a reason for rejection.');
            return;
        }
        setProcessingId(rejectModalId);
        try {
            await PCFService.rejectLiquidation(rejectModalId, currentUser.id, currentUser.name, rejectReason);
            alert('PCF Liquidation rejected.');
            await loadAuditReviewLiquidations();
            setRejectModalId(null);
            setRejectReason('');
            setSelectedLiquidation(null);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to reject: ${message}`);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl pb-10">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="text-rose-500 dark:text-rose-400" size={28} />
                    PCF Audit Review
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Review PCF liquidations before manager approval.</p>
            </div>

            {/* Stats */}
            <Card className="bg-white dark:bg-gradient-to-br dark:from-rose-900/30 dark:to-slate-900 border border-slate-200 dark:border-rose-700/30 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Audit Review</p>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{liquidations.length}</p>
                    </div>
                    <div className="ml-auto text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Amount</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(liquidations.reduce((sum, l) => sum + l.totalAmount, 0))}
                        </p>
                    </div>
                </div>
            </Card>

            {/* List */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-rose-500 dark:text-rose-400" />
                    Items for Audit Review
                </h3>



                {/* Date Filter */}
                <div className="mb-4 flex justify-end">
                    <DateRangeFilter
                        onFilterChange={(start, end) => setDateRange({ start, end })}
                    />
                </div>

                {(() => {
                    let filteredLiquidations = liquidations;
                    if (dateRange.start && dateRange.end) {
                        const start = new Date(dateRange.start);
                        const end = new Date(dateRange.end);
                        end.setHours(23, 59, 59, 999);

                        filteredLiquidations = filteredLiquidations.filter(l => {
                            const date = new Date(l.dateSubmitted || l.dateCreated);
                            return date >= start && date <= end;
                        });
                    }

                    if (filteredLiquidations.length === 0) {
                        return (
                            <div className="text-center py-12">
                                <CheckCircle size={48} className="mx-auto text-green-500 dark:text-green-600 mb-4" />
                                <p className="text-slate-500 dark:text-slate-400">No PCF liquidations pending audit review.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-3">
                            {filteredLiquidations.map((liq) => {
                                const user = getUserById(liq.userId);
                                return (
                                    <div
                                        key={liq.id}
                                        onClick={() => setSelectedLiquidation(liq)}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedLiquidation?.id === liq.id
                                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-sm dark:shadow-none'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <User size={14} className="text-slate-500" />
                                                    <span className="font-medium text-slate-900 dark:text-white">{liq.userName}</span>
                                                    <span className="text-xs text-slate-500">({user?.role || 'Unknown'})</span>
                                                    <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-600/30 text-rose-700 dark:text-rose-300 rounded text-xs font-medium">
                                                        AUDIT REVIEW
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <Building2 size={12} />
                                                    {getBusinessName(liq.businessId)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(liq.totalAmount)}</p>
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
                    );
                })()}
            </Card>

            {/* Detail Drawer */}
            {
                selectedLiquidation && (
                    <>
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSelectedLiquidation(null)} />
                        <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <AlertTriangle size={20} className="text-rose-500 dark:text-rose-400" />
                                        Audit Review Details
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        Submitted: {new Date(selectedLiquidation.dateSubmitted || selectedLiquidation.dateCreated).toLocaleDateString()}
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
                                    <button onClick={() => setSelectedLiquidation(null)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                        <XCircle size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                {/* Custodian Info */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Custodian</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                                            <User size={20} className="text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <div>
                                            <p className="text-slate-900 dark:text-white font-medium text-lg">{selectedLiquidation.userName}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                <Building2 size={12} />
                                                {getBusinessName(selectedLiquidation.businessId)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="bg-gradient-to-r from-rose-50 to-slate-50 dark:from-rose-900/40 dark:to-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-rose-700/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 dark:text-slate-300">Total Amount</span>
                                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(selectedLiquidation.totalAmount)}</span>
                                    </div>
                                </div>

                                {/* Expenses Table */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Receipt size={14} className="text-rose-500 dark:text-rose-400" />
                                        Expense Items ({selectedLiquidation.expenses.length})
                                    </h3>
                                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Date</th>
                                                    <th className="px-3 py-2 text-left">Payee</th>
                                                    <th className="px-3 py-2 text-left">OR#</th>
                                                    <th className="px-3 py-2 text-left">Description</th>
                                                    <th className="px-3 py-2 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-700 dark:text-slate-300">
                                                {selectedLiquidation.expenses.map((exp, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                        <td className="px-3 py-2">{exp.date}</td>
                                                        <td className="px-3 py-2">{exp.payeeVendor || '-'}</td>
                                                        <td className="px-3 py-2 font-mono">{exp.orNo}</td>
                                                        <td className="px-3 py-2">{exp.itemDescription || '-'}</td>
                                                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(exp.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Receipts Link */}
                                {selectedLiquidation.receiptsLink && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-4">
                                        <p className="text-xs text-blue-600 dark:text-blue-300 mb-2">📎 Receipts/Attachments</p>
                                        <a href={selectedLiquidation.receiptsLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline text-sm break-all">
                                            {selectedLiquidation.receiptsLink}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleApproveAuditReview(selectedLiquidation!)}
                                        disabled={processingId === selectedLiquidation.id}
                                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-rose-600/20"
                                    >
                                        <CheckCircle size={18} />
                                        {processingId === selectedLiquidation.id ? 'Processing...' : 'Approve Audit Review'}
                                    </button>
                                    <button
                                        onClick={() => setRejectModalId(selectedLiquidation.id)}
                                        disabled={processingId === selectedLiquidation.id}
                                        className="px-6 bg-white dark:bg-red-600/20 hover:bg-red-50 dark:hover:bg-red-600/30 text-red-600 dark:text-red-400 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 border border-red-200 dark:border-red-700/30"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                    <button onClick={() => setPrintLiquidation(selectedLiquidation)} className="px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white py-3 rounded-lg">
                                        <Printer size={18} />
                                    </button>
                                </div>
                                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/30 rounded-lg">
                                    <AlertTriangle size={16} className="text-rose-500 dark:text-rose-400" />
                                    <p className="text-xs text-rose-700 dark:text-rose-300">
                                        <strong>Audit Review:</strong> Approving will move this to manager approval.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }

            {/* Reject Modal */}
            {
                rejectModalId && (
                    <>
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setRejectModalId(null)} />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md shadow-2xl">
                                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <XCircle size={24} className="text-red-500 dark:text-red-400" />
                                        Reject PCF Liquidation
                                    </h2>
                                </div>
                                <div className="p-6">
                                    <label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Reason for Rejection</label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="Please provide a reason..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                                    />
                                </div>
                                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                                    <button onClick={() => { setRejectModalId(null); setRejectReason(''); }} className="px-4 py-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                                        Cancel
                                    </button>
                                    <button onClick={handleReject} disabled={!rejectReason.trim() || processingId === rejectModalId} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50">
                                        {processingId === rejectModalId ? 'Rejecting...' : 'Reject'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }

            {/* Approve Modal */}
            {
                approveModalId && (
                    <>
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setApproveModalId(null)} />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md shadow-2xl">
                                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <CheckCircle size={24} className="text-green-500 dark:text-green-400" />
                                        Approve Audit Review
                                    </h2>
                                </div>
                                <div className="p-6">
                                    <label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Audit Remarks (Optional)</label>
                                    <textarea
                                        value={auditRemarks}
                                        onChange={(e) => setAuditRemarks(e.target.value)}
                                        placeholder="Add any remarks or notes for this approval..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:outline-none resize-none"
                                    />
                                    <p className="text-xs text-slate-500 mt-2">This will move the liquidation to pending manager approval.</p>
                                </div>
                                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                                    <button onClick={() => { setApproveModalId(null); setAuditRemarks(''); }} className="px-4 py-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                                        Cancel
                                    </button>
                                    <button onClick={handleConfirmApproval} disabled={processingId === approveModalId} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
                                        {processingId === approveModalId ? 'Approving...' : 'Approve'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }

            {/* Print Modal */}
            {
                printLiquidation && (
                    <PCFPrintModal
                        liquidation={printLiquidation}
                        onClose={() => setPrintLiquidation(null)}
                        business={businesses.find(b => b.id === printLiquidation.businessId)}
                    />
                )
            }
        </div >
    );
};

export default PCFAuditReviewView;
