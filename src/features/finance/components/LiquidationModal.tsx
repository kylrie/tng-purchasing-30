import React, { useState } from 'react';
import { X, Check, Paperclip, AlertCircle, Save } from 'lucide-react';
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
    const [attachmentLink, setAttachmentLink] = useState(requisition.attachments?.[0] || '');
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
            attachments: attachmentLink ? [attachmentLink] : [],
            liquidationDetails: {
                dateFiled: new Date().toISOString(),
                filedBy: currentUserId,
                totalActualAmount,
                refundAmount: isRefund ? difference : 0,
                reimbursementAmount: isReimbursement ? Math.abs(difference) : 0,
            }
        };
        onSubmit(updatedRequisition);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">File / Edit Liquidation</h2>
                        <p className="text-sm text-slate-500">Enter actual expenses and attach receipts.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* General Info */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-blue-800 font-medium">Cash Advance Released</p>
                            <p className="text-2xl font-bold text-blue-900">₱{cashAdvance.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-blue-800 font-medium">Requester</p>
                            <p className="text-blue-900 font-semibold">{requisition.requesterId}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div>
                        <h3 className="font-semibold text-slate-800 mb-3">Expense Breakdown</h3>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Item</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Qty</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-600">Estimated Cost</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-600 w-32">Actual Cost</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Receipt Ref</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-600">Total Actual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                                            <td className="px-4 py-3 text-center">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-3 text-right text-slate-500">₱{item.price.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.actualCost}
                                                    onChange={(e) => handleItemChange(idx, 'actualCost', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 text-right border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.receiptRef || ''}
                                                    onChange={(e) => handleItemChange(idx, 'receiptRef', e.target.value)}
                                                    placeholder="OR#123"
                                                    className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-900">
                                                ₱{((item.actualCost || 0) * item.quantity).toLocaleString()}
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Google Drive Link (Receipts)</label>
                                <div className="flex items-center gap-2">
                                    <Paperclip size={18} className="text-slate-400" />
                                    <input
                                        className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        value={attachmentLink}
                                        onChange={e => setAttachmentLink(e.target.value)}
                                        placeholder="https://drive.google.com/..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks / Justification</label>
                                <textarea
                                    className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    rows={3}
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    placeholder="Add notes about any discrepancies..."
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-3">
                            <h4 className="font-semibold text-slate-800">Summary</h4>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Total Cash Advance:</span>
                                <span className="font-medium">₱{cashAdvance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Total Actual Expenses:</span>
                                <span className="font-bold text-slate-900">₱{totalActualAmount.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-slate-300 my-2"></div>
                            {isRefund ? (
                                <div className="flex justify-between text-sm text-green-700 bg-green-50 p-2 rounded">
                                    <span className="font-medium">Amount to Return (Refund):</span>
                                    <span className="font-bold">₱{Math.abs(difference).toLocaleString()}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-sm text-orange-700 bg-orange-50 p-2 rounded">
                                    <span className="font-medium">Amount to Reimburse:</span>
                                    <span className="font-bold">₱{Math.abs(difference).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                    <button onClick={onClose} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                    >
                        <Save size={18} /> Submit Liquidation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiquidationModal;
