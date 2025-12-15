import React from 'react';
import { X, Clock, CheckCircle2, XCircle, ChevronRight, User, Ban } from 'lucide-react';
import type { Requisition, RequisitionHistory } from '../types';
import { RequisitionStatus } from '../types';
import Card from '../../../shared/components/Card';

interface PRFDetailsDrawerProps {
    requisition: Requisition | null;
    isOpen: boolean;
    onClose: () => void;
    onApprove?: () => void;
    onReject?: () => void;
    onCancel?: () => void; // SuperAdmin only: cancel requisition
    canApprove?: boolean;
    canReject?: boolean;
    canCancel?: boolean; // SuperAdmin only
    isLoading?: boolean;
}

// Helper: Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

// Helper: Format date nicely
const formatDate = (dateValue: string | Date | any): string => {
    if (!dateValue) return '-';
    // Handle Firestore Timestamp
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

// Helper: Get timeline icon based on action
const getTimelineIcon = (action: string, stage: RequisitionStatus) => {
    if (action.toLowerCase().includes('approve') || stage.toString().includes('APPROVED')) {
        return <CheckCircle2 size={16} className="text-green-400" />;
    }
    if (action.toLowerCase().includes('reject')) {
        return <XCircle size={16} className="text-red-400" />;
    }
    if (action.toLowerCase().includes('created')) {
        return <Clock size={16} className="text-blue-400" />;
    }
    return <ChevronRight size={16} className="text-slate-400" />;
};

const PRFDetailsDrawer: React.FC<PRFDetailsDrawerProps> = ({
    requisition,
    isOpen,
    onClose,
    onApprove,
    onReject,
    onCancel,
    canApprove = false,
    canReject = false,
    canCancel = false,
    isLoading = false,
}) => {
    if (!isOpen || !requisition) return null;

    const totalAmount = requisition.items.reduce((sum, item) => {
        return sum + ((item.price || 0) * (item.quantity || 0));
    }, 0);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-white">{requisition.id}</h2>
                        <p className="text-sm text-slate-400">{requisition.description || 'No description'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Supplier Info */}
                    {requisition.prfDetails?.supplier && (
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">Supplier</h3>
                            <p className="text-white font-medium">{requisition.prfDetails.supplier.name}</p>
                            <p className="text-sm text-slate-400">{requisition.prfDetails.supplier.address || 'No address'}</p>
                            {requisition.prfDetails.supplier.tin && (
                                <p className="text-xs text-slate-500 mt-1">TIN: {requisition.prfDetails.supplier.tin}</p>
                            )}
                        </div>
                    )}

                    {/* Items Table */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Items ({requisition.items.length})</h3>
                        <Card className="!p-0 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Item</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Price</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {requisition.items.map((item, index) => (
                                        <tr key={item.itemId || index} className="hover:bg-slate-800/40">
                                            <td className="px-4 py-3 text-slate-200">{item.name}</td>
                                            <td className="px-4 py-3 text-center text-slate-400">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(item.price || 0)}</td>
                                            <td className="px-4 py-3 text-right text-white font-medium">
                                                {formatCurrency((item.price || 0) * (item.quantity || 0))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-purple-900/30 border-t border-purple-700/50">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right text-purple-300 font-semibold">Total Amount</td>
                                        <td className="px-4 py-3 text-right text-purple-200 font-bold text-lg">
                                            {formatCurrency(totalAmount)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </Card>
                    </div>

                    {/* Approval History Timeline */}
                    {requisition.history && requisition.history.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">History</h3>
                            <div className="relative pl-6">
                                {/* Timeline line */}
                                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-700" />

                                <div className="space-y-4">
                                    {requisition.history.map((entry: RequisitionHistory, index: number) => (
                                        <div key={index} className="relative">
                                            {/* Timeline dot */}
                                            <div className="absolute -left-4 mt-1 p-1 bg-slate-900 rounded-full border border-slate-700">
                                                {getTimelineIcon(entry.action, entry.stage)}
                                            </div>

                                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-white">{entry.action}</span>
                                                    <span className="text-xs text-slate-500">{formatDate(entry.date)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <User size={12} />
                                                    <span>{entry.actorName || 'System'}</span>
                                                </div>
                                                {entry.comments && (
                                                    <p className="text-xs text-slate-500 mt-2 italic">"{entry.comments}"</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                {(canApprove || canReject || canCancel) && (
                    <div className="p-6 border-t border-slate-700 flex justify-between gap-3">
                        {/* Left side: SuperAdmin Cancel Button */}
                        <div>
                            {canCancel && requisition.status !== RequisitionStatus.CANCELLED && (
                                <button
                                    onClick={onCancel}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-orange-600/20 text-orange-400 border border-orange-500/50 rounded-lg font-medium hover:bg-orange-600/30 disabled:opacity-50 flex items-center gap-2"
                                    title="SuperAdmin: Cancel Requisition"
                                >
                                    <Ban size={16} /> Cancel
                                </button>
                            )}
                        </div>

                        {/* Right side: Other Actions */}
                        <div className="flex gap-3">
                            {canReject && (
                                <button
                                    onClick={onReject}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/50 rounded-lg font-medium hover:bg-red-600/30 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <XCircle size={16} /> Reject
                                </button>
                            )}
                            {canApprove && (
                                <button
                                    onClick={onApprove}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <CheckCircle2 size={16} /> Approve
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PRFDetailsDrawer;
