import React, { useState, useMemo } from 'react';
import { DollarSign, Receipt, Link as LinkIcon, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Requisition, RequisitionItem } from '../types';

interface LiquidationItemRow {
    itemId: string;
    name: string;
    quantity: number;
    estimatedCost: number; // Original price from PRF
    actualCost: number;
    receiptRef: string;
}

interface LiquidationFormProps {
    requisition: Requisition;
    onSubmit: (payload: {
        items: LiquidationItemRow[];
        totalBudget: number;
        totalActual: number;
        variance: number;
        receiptsLink: string;
        remarks: string;
    }) => void;
    isLoading?: boolean;
    readOnly?: boolean; // For viewing already-filed liquidation
}

// Helper: Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

const LiquidationForm: React.FC<LiquidationFormProps> = ({
    requisition,
    onSubmit,
    isLoading = false,
    readOnly = false,
}) => {
    // Initialize items from PRF
    const [items, setItems] = useState<LiquidationItemRow[]>(() => {
        // If already filed, use saved data
        if (requisition.liquidationDetails?.items) {
            return requisition.liquidationDetails.items;
        }
        // Otherwise, initialize from PRF items
        return requisition.items.map((item: RequisitionItem) => ({
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity || 1,
            estimatedCost: item.price || 0,
            actualCost: item.price || 0, // Default to estimated
            receiptRef: '',
        }));
    });

    const [receiptsLink, setReceiptsLink] = useState(requisition.liquidationDetails?.receiptsLink || '');
    const [remarks, setRemarks] = useState(requisition.liquidationDetails?.remarks || '');

    // Calculate totals
    const { totalBudget, totalActual, variance } = useMemo(() => {
        const budget = items.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
        const actual = items.reduce((sum, item) => sum + (item.quantity * item.actualCost), 0);
        return {
            totalBudget: budget,
            totalActual: actual,
            variance: budget - actual, // positive = surplus (to return), negative = deficit (to reimburse)
        };
    }, [items]);

    const handleActualCostChange = (index: number, value: number) => {
        const updated = [...items];
        updated[index].actualCost = value;
        setItems(updated);
    };

    const handleReceiptRefChange = (index: number, value: string) => {
        const updated = [...items];
        updated[index].receiptRef = value;
        setItems(updated);
    };

    const handleSubmit = () => {
        onSubmit({
            items,
            totalBudget,
            totalActual,
            variance,
            receiptsLink,
            remarks,
        });
    };

    return (
        <div className="space-y-6">
            {/* Header: Budget Released */}
            <div className="bg-emerald-900/30 rounded-lg p-4 border border-emerald-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center">
                            <DollarSign size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-emerald-400 uppercase tracking-wider">Budget Released</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(totalBudget)}</p>
                        </div>
                    </div>
                    {requisition.chequeNumber && (
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Cheque No.</p>
                            <p className="text-sm font-medium text-purple-400">{requisition.chequeNumber}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Expense Breakdown Table */}
            <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Receipt size={16} /> Expense Breakdown
                </h3>
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-x-auto">
                    <table className="w-full text-xs min-w-[400px]">
                        <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                            <tr>
                                <th className="px-2 py-2 text-left w-[30%]">Item</th>
                                <th className="px-1 py-2 text-center w-[8%]">Qty</th>
                                <th className="px-1 py-2 text-right w-[15%]">Est.</th>
                                <th className="px-1 py-2 text-right w-[18%]">Actual</th>
                                <th className="px-1 py-2 text-left w-[14%]">Ref</th>
                                <th className="px-2 py-2 text-right w-[15%]">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {items.map((item, index) => {
                                const totalItemActual = item.quantity * item.actualCost;
                                return (
                                    <tr key={item.itemId} className="hover:bg-slate-800/30">
                                        <td className="px-2 py-2 text-slate-200 truncate max-w-[100px]" title={item.name}>{item.name}</td>
                                        <td className="px-1 py-2 text-center text-slate-400">{item.quantity}</td>
                                        <td className="px-1 py-2 text-right text-slate-500">
                                            ₱{item.estimatedCost.toLocaleString()}
                                        </td>
                                        <td className="px-1 py-2 text-right">
                                            {readOnly ? (
                                                <span className="text-white">₱{item.actualCost.toLocaleString()}</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.actualCost}
                                                    onChange={(e) => handleActualCostChange(index, parseFloat(e.target.value) || 0)}
                                                    className="w-16 px-1 py-1 bg-slate-900 border border-slate-600 rounded text-right text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                                                />
                                            )}
                                        </td>
                                        <td className="px-1 py-2">
                                            {readOnly ? (
                                                <span className="text-slate-300 text-xs">{item.receiptRef || '-'}</span>
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder="OR#"
                                                    value={item.receiptRef}
                                                    onChange={(e) => handleReceiptRefChange(index, e.target.value)}
                                                    className="w-16 px-1 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                                                />
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-right font-medium text-white">
                                            ₱{totalItemActual.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Inputs */}
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                        <LinkIcon size={12} /> Google Drive Link (Receipts)
                    </label>
                    {readOnly ? (
                        receiptsLink ? (
                            <a
                                href={receiptsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline text-sm"
                            >
                                {receiptsLink}
                            </a>
                        ) : (
                            <span className="text-slate-500">No link provided</span>
                        )
                    ) : (
                        <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={receiptsLink}
                            onChange={(e) => setReceiptsLink(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                        />
                    )}
                </div>
                <div>
                    <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                        <FileText size={12} /> Remarks
                    </label>
                    {readOnly ? (
                        <p className="text-slate-300 text-sm">{remarks || 'No remarks'}</p>
                    ) : (
                        <textarea
                            placeholder="Additional notes..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm resize-none"
                        />
                    )}
                </div>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-800/80 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Summary</h4>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Budget (Advance)</span>
                        <span className="text-white font-medium">{formatCurrency(totalBudget)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Actual Expenses</span>
                        <span className="text-white font-medium">{formatCurrency(totalActual)}</span>
                    </div>
                    <div className="border-t border-slate-600 my-2" />
                    <div className="flex justify-between items-center">
                        {variance >= 0 ? (
                            <>
                                <span className="text-emerald-400 flex items-center gap-1 text-sm">
                                    <CheckCircle size={14} /> Amount to Return
                                </span>
                                <span className="text-emerald-400 font-bold text-lg">{formatCurrency(variance)}</span>
                            </>
                        ) : (
                            <>
                                <span className="text-orange-400 flex items-center gap-1 text-sm">
                                    <AlertTriangle size={14} /> Amount to Reimburse
                                </span>
                                <span className="text-orange-400 font-bold text-lg">{formatCurrency(Math.abs(variance))}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            {!readOnly && (
                <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin">⏳</span> Submitting...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={18} /> Submit Liquidation
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default LiquidationForm;
