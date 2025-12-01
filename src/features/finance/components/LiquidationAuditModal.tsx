import React, { useState } from 'react';
import { X, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import type { Requisition } from '../../procurement/types';

interface LiquidationAuditModalProps {
    requisition: Requisition;
    onClose: () => void;
    onApprove: (auditNotes: string) => Promise<void>;
    onReject: (rejectionReason: string) => Promise<void>;
}

const LiquidationAuditModal: React.FC<LiquidationAuditModalProps> = ({
    requisition,
    onClose,
    onApprove,
    onReject
}) => {
    const [notes, setNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);
    const [loading, setLoading] = useState(false);

    const liquidation = requisition.liquidationDetails;
    if (!liquidation) return null;

    const prfTotal = requisition.totalAmount;
    const actualTotal = liquidation.totalActualAmount;
    const difference = prfTotal - actualTotal;

    // Determine the attachment link (check both liquidationDetails and legacy attachments array)
    const attachmentLink = liquidation.attachmentLink || (requisition.attachments && requisition.attachments.length > 0 ? requisition.attachments[0] : null);

    const handleSubmit = async () => {
        if (!action) return;

        setLoading(true);
        try {
            if (action === 'approve') {
                await onApprove(notes);
            } else {
                if (!rejectionReason.trim()) {
                    alert('Please provide a reason for rejection');
                    setLoading(false);
                    return;
                }
                await onReject(rejectionReason);
            }
            onClose();
        } catch (error) {
            console.error('Error submitting audit:', error);
            alert('Failed to submit audit. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-slate-800/95 backdrop-blur-md border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Audit Liquidation</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Requisition Info */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-400 mb-2">Requisition Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">ID:</span>
                                <span className="ml-2 text-white font-mono">{requisition.id}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Filed By:</span>
                                <span className="ml-2 text-white">{liquidation.filedBy}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Date Filed:</span>
                                <span className="ml-2 text-white">{new Date(liquidation.dateFiled).toLocaleDateString()}</span>
                            </div>
                            {/* Added Attachment Link */}
                            {attachmentLink && (
                                <div className="col-span-2">
                                    <span className="text-slate-500 block mb-1">Supporting Documents:</span>
                                    <a 
                                        href={attachmentLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                                    >
                                        <ExternalLink size={16} />
                                        <span className="font-medium">Open Receipt Folder in Google Drive</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                            <div className="text-sm text-blue-300 mb-1">PRF Amount</div>
                            <div className="text-2xl font-bold text-blue-400">₱{prfTotal.toLocaleString()}</div>
                        </div>
                        <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30">
                            <div className="text-sm text-purple-300 mb-1">Actual Amount</div>
                            <div className="text-2xl font-bold text-purple-400">₱{actualTotal.toLocaleString()}</div>
                        </div>
                        <div className={`rounded-lg p-4 border ${difference >= 0 ? 'bg-green-900/20 border-green-700/30' : 'bg-red-900/20 border-red-700/30'}`}>
                            <div className={`text-sm mb-1 ${difference >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                {difference >= 0 ? 'Refund' : 'Reimbursement'}
                            </div>
                            <div className={`text-2xl font-bold ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ₱{Math.abs(difference).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-3">Itemized Costs</h3>
                        <div className="border border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 border-b border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">Item</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Qty</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Budgeted</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Actual</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Variance</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">Receipt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {requisition.items.map((item, index) => {
                                        const budgeted = item.price * item.quantity;
                                        const actual = (item.actualCost || 0) * item.quantity;
                                        const variance = budgeted - actual;

                                        return (
                                            <tr key={index} className="hover:bg-slate-700/30">
                                                <td className="px-4 py-3 font-medium text-slate-200">{item.name}</td>
                                                <td className="px-4 py-3 text-right text-slate-400">{item.quantity} {item.uom}</td>
                                                <td className="px-4 py-3 text-right text-slate-300">₱{budgeted.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-slate-300">₱{actual.toLocaleString()}</td>
                                                <td className={`px-4 py-3 text-right font-semibold ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {variance >= 0 ? '+' : ''}₱{variance.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.receiptImageUrl ? (
                                                        <a
                                                            href={item.receiptImageUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300 text-xs underline"
                                                        >
                                                            {item.receiptRef || 'View'}
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-500 text-xs">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Action Selection */}
                    {!action && (
                        <div className="flex gap-4">
                            <button
                                onClick={() => setAction('approve')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                            >
                                <CheckCircle size={20} />
                                Approve Liquidation
                            </button>
                            <button
                                onClick={() => setAction('reject')}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                            >
                                <XCircle size={20} />
                                Reject Liquidation
                            </button>
                        </div>
                    )}

                    {/* Approval Form */}
                    {action === 'approve' && (
                        <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/30 space-y-4">
                            <h3 className="text-lg font-semibold text-green-300">Approve Liquidation</h3>
                            <div>
                                <label className="block text-sm font-medium text-green-200 mb-2">
                                    Audit Notes (Optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any notes about this audit..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white placeholder-slate-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                >
                                    {loading ? 'Processing...' : 'Confirm Approval'}
                                </button>
                                <button
                                    onClick={() => setAction(null)}
                                    disabled={loading}
                                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Rejection Form */}
                    {action === 'reject' && (
                        <div className="bg-red-900/20 rounded-lg p-4 border border-red-700/30 space-y-4">
                            <h3 className="text-lg font-semibold text-red-300">Reject Liquidation</h3>
                            <div>
                                <label className="block text-sm font-medium text-red-200 mb-2">
                                    Reason for Rejection <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Explain why this liquidation is being rejected..."
                                    rows={4}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-slate-500"
                                    required
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !rejectionReason.trim()}
                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                                >
                                    {loading ? 'Processing...' : 'Confirm Rejection'}
                                </button>
                                <button
                                    onClick={() => setAction(null)}
                                    disabled={loading}
                                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiquidationAuditModal;
