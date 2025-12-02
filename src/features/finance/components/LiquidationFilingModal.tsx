import React, { useState } from 'react';
import { X, Upload, Receipt, DollarSign } from 'lucide-react';
import type { Requisition, RequisitionItem, LiquidationDetails } from '../../procurement/types';

interface LiquidationFilingModalProps {
    requisition: Requisition;
    onClose: () => void;
    onSubmit: (liquidationData: LiquidationDetails, updatedItems: RequisitionItem[]) => Promise<void>;
    currentUserId: string;
}

const LiquidationFilingModal: React.FC<LiquidationFilingModalProps> = ({
    requisition,
    onClose,
    onSubmit,
    currentUserId
}) => {
    const [items, setItems] = useState<RequisitionItem[]>(
        requisition.items.map(item => ({
            ...item,
            actualCost: item.actualCost || item.price,
            receiptRef: item.receiptRef || '',
            receiptImageUrl: item.receiptImageUrl || ''
        }))
    );
    const [attachmentLink, setAttachmentLink] = useState('');
    const [loading, setLoading] = useState(false);

    const prfTotal = requisition.totalAmount;
    const actualTotal = items.reduce((sum, item) => sum + (item.actualCost || 0) * item.quantity, 0);
    const difference = prfTotal - actualTotal;
    const refundAmount = difference > 0 ? difference : 0;
    const reimbursementAmount = difference < 0 ? Math.abs(difference) : 0;

    const handleActualCostChange = (index: number, cost: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], actualCost: cost };
        setItems(newItems);
    };

    const handleReceiptRefChange = (index: number, ref: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], receiptRef: ref };
        setItems(newItems);
    };

    const handleReceiptUrlChange = (index: number, url: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], receiptImageUrl: url };
        setItems(newItems);
    };

    const isValid = () => {
        return items.every(item =>
            (item.actualCost !== undefined && item.actualCost >= 0)
        );
    };

    const handleSubmit = async () => {
        if (!isValid()) return;

        setLoading(true);
        try {
            const liquidationData: LiquidationDetails = {
                dateFiled: new Date().toISOString(),
                filedBy: currentUserId,
                totalActualAmount: actualTotal,
                refundAmount,
                reimbursementAmount,
                status: 'PENDING',
                attachmentLink: attachmentLink // Save the main attachment link
            };

            await onSubmit(liquidationData, items);
        } catch (error) {
            console.error('Error filing liquidation:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Receipt className="text-green-400" size={28} />
                            File Liquidation
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            PRF #{requisition.id} - Submit actual costs and receipts
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                            <div className="text-sm text-blue-300 mb-1">PRF Amount</div>
                            <div className="text-2xl font-bold text-blue-400">₱{prfTotal?.toLocaleString()}</div>
                        </div>
                        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                            <div className="text-sm text-purple-300 mb-1">Actual Amount</div>
                            <div className="text-2xl font-bold text-purple-400">₱{actualTotal?.toLocaleString()}</div>
                        </div>
                        <div className={`${difference >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-orange-900/20 border-orange-500/30'} border rounded-lg p-4`}>
                            <div className={`text-sm ${difference >= 0 ? 'text-green-300' : 'text-orange-300'} mb-1`}>
                                {difference >= 0 ? 'Refund' : 'Reimbursement'}
                            </div>
                            <div className={`text-2xl font-bold ${difference >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                                ₱{Math.abs(difference)?.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Main Attachment Link Input */}
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Google Drive Link (Receipts & Documents)
                        </label>
                        <div className="flex items-center gap-2">
                            <Upload className="text-slate-500" size={20} />
                            <input
                                type="url"
                                value={attachmentLink}
                                onChange={(e) => setAttachmentLink(e.target.value)}
                                placeholder="Paste the Google Drive folder link containing all receipts here..."
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Please upload all receipts to a Google Drive folder and share the link here. This allows auditors to review all documents in one place.
                        </p>
                    </div>

                    {/* Items Table */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">Itemized Costs & Receipts</h3>
                        <div className="border border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 border-b border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">ITEM</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">QTY</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">BUDGETED</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">ACTUAL COST</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">RECEIPT #</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">RECEIPT LINK (Optional)</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {items.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-700/30">
                                            <td className="px-4 py-3 font-medium text-slate-200">{item.name}</td>
                                            <td className="px-4 py-3 text-slate-400">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-3 text-slate-400">₱{item.price?.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.actualCost || ''}
                                                    onChange={(e) => handleActualCostChange(index, parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-28 px-2 py-1 bg-slate-900/50 border border-slate-600 rounded text-right focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.receiptRef || ''}
                                                    onChange={(e) => handleReceiptRefChange(index, e.target.value)}
                                                    placeholder="OR-12345"
                                                    className="w-32 px-2 py-1 bg-slate-900/50 border border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="url"
                                                    value={item.receiptImageUrl || ''}
                                                    onChange={(e) => handleReceiptUrlChange(index, e.target.value)}
                                                    placeholder="Specific Link (Opt)"
                                                    className="w-48 px-2 py-1 bg-slate-900/50 border border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-white text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-200">
                                                ₱{((item.actualCost || 0) * item.quantity)?.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900/50 border-t-2 border-slate-700">
                                    <tr>
                                        <td colSpan={6} className="px-4 py-3 text-right font-bold text-slate-300">
                                            Total Actual Amount
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-green-400 text-lg">
                                            ₱{actualTotal?.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                            <Upload size={18} />
                            Important Instructions
                        </h4>
                        <ul className="text-sm text-yellow-200 space-y-1 list-disc list-inside">
                            <li>Enter the actual cost paid for each item</li>
                            <li>Provide receipt/invoice numbers for verification</li>
                            <li>Upload receipts to Google Drive and paste the shareable link above</li>
                            <li>Ensure all receipts are clear and readable</li>
                            <li>If actual cost is less than budgeted, you'll receive a refund</li>
                            <li>If actual cost exceeds budget, you'll be reimbursed the difference</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid() || loading}
                        className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${isValid() && !loading
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        <DollarSign size={20} />
                        {loading ? 'Submitting...' : 'Submit Liquidation'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiquidationFilingModal;
