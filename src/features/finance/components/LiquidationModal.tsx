import React, { useState } from 'react';
import { X, Paperclip, Save } from 'lucide-react';
import type { Requisition, RequisitionItem } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';

interface LiquidationModalProps {
    requisition: Requisition;
    onClose: () => void;
    onSubmit: (updatedRequisition: Requisition) => void;
    currentUserId: string;
}

const LiquidationModal: React.FC<LiquidationModalProps> = ({
    requisition,
    onClose,
    onSubmit,
    currentUserId
}) => {
    const [items, setItems] = useState<RequisitionItem[]>(
        requisition.items.map(item => ({
            ...item,
            actualCost: item.actualCost ?? item.price, // Default to estimated price if not set
            receiptRef: item.receiptRef ?? ''
        }))
    );
    // Use the stored attachment link from liquidationDetails if available, otherwise check attachments array
    const [attachmentLink, setAttachmentLink] = useState(
        requisition.liquidationDetails?.attachmentLink || requisition.attachments?.[0] || ''
    );
    const [remarks, setRemarks] = useState(requisition.remarks || '');

    // Calculate totals
    const totalActualAmount = items.reduce((sum, item) => sum + ((item.actualCost || 0) * item.quantity), 0);
    const cashAdvance = requisition.totalAmount; // This is the amount released
    const difference = cashAdvance - totalActualAmount;
    const isRefund = difference > 0;
    const isReimbursement = difference < 0;

    const handleItemChange = (index: number, field: keyof RequisitionItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = () => {
        const updatedRequisition: Requisition = {
            ...requisition,
            items,
            remarks,
            status: RequisitionStatus.LIQUIDATION_FILED,
            // Save link to both attachments array (legacy) and liquidationDetails (new standard)
            attachments: attachmentLink ? [attachmentLink] : [],
            liquidationDetails: {
                ...requisition.liquidationDetails, // Preserve existing details if any
                dateFiled: new Date().toISOString(),
                filedBy: currentUserId,
                totalActualAmount,
                refundAmount: isRefund ? difference : 0,
                reimbursementAmount: isReimbursement ? Math.abs(difference) : 0,
                attachmentLink: attachmentLink // Explicitly save the link here
            }
        };
        onSubmit(updatedRequisition);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 w-full max-w-4xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white">File / Edit Liquidation</h2>
                        <p className="text-sm text-slate-400">Enter actual expenses and attach receipts.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* General Info */}
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-blue-300 font-medium">Cash Advance Released</p>
                            <p className="text-2xl font-bold text-blue-100">₱{cashAdvance?.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-blue-300 font-medium">Requester</p>
                            <p className="text-blue-100 font-semibold">{requisition.requesterId}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div>
                        <h3 className="font-semibold text-white mb-3">Expense Breakdown</h3>
                        <div className="border border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-slate-300">
                                <thead className="bg-slate-900/50 border-b border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">Item</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-400">Qty</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Estimated Cost</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400 w-32">Actual Cost</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">Receipt Ref</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Total Actual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-700/30">
                                            <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <input 
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-16 px-2 py-1 bg-slate-900/50 border border-slate-600 rounded text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs text-slate-500">{item.uom}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-400">₱{item.price?.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.actualCost}
                                                    onChange={(e) => handleItemChange(idx, 'actualCost', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 text-right bg-slate-900/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.receiptRef || ''}
                                                    onChange={(e) => handleItemChange(idx, 'receiptRef', e.target.value)}
                                                    placeholder="OR#123"
                                                    className="w-full px-2 py-1 bg-slate-900/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-white">
                                                ₱{((item.actualCost || 0) * item.quantity)?.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary & Attachments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Google Drive Link (Receipts)</label>
                                <div className="flex items-center gap-2">
                                    <Paperclip size={18} className="text-slate-400" />
                                    <input
                                        className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                                        value={attachmentLink}
                                        onChange={e => setAttachmentLink(e.target.value)}
                                        placeholder="https://drive.google.com/..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Remarks / Justification</label>
                                <textarea
                                    className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                                    rows={3}
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    placeholder="Add notes about any discrepancies..."
                                />
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-3">
                            <h4 className="font-semibold text-white">Summary</h4>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Total Cash Advance:</span>
                                <span className="font-medium text-slate-200">₱{cashAdvance?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Total Actual Expenses:</span>
                                <span className="font-bold text-white">₱{totalActualAmount?.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-slate-600 my-2"></div>
                            {isRefund ? (
                                <div className="flex justify-between text-sm text-green-400 bg-green-900/30 p-2 rounded border border-green-500/30">
                                    <span className="font-medium">Amount to Return (Refund):</span>
                                    <span className="font-bold">₱{Math.abs(difference)?.toLocaleString()}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-sm text-orange-400 bg-orange-900/30 p-2 rounded border border-orange-500/30">
                                    <span className="font-medium">Amount to Reimburse:</span>
                                    <span className="font-bold">₱{Math.abs(difference)?.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/50 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 text-slate-300 font-medium hover:text-white hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        <Save size={18} /> Submit Liquidation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiquidationModal;
