import React from 'react';
import { X, Printer } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';

interface LiquidationPrintModalProps {
    req: Requisition;
    onClose: () => void;
    business?: Business;
    requester?: User;
}

const LiquidationPrintModal: React.FC<LiquidationPrintModalProps> = ({ req, onClose, business, requester }) => {

    const handlePrint = () => {
        window.print();
    };

    const liquidation = req.liquidationDetails;
    if (!liquidation) return null; // Safety guard

    const cashAdvance = req.totalAmount || 0;
    const totalActual = liquidation.totalActualAmount || 0;
    const difference = cashAdvance - totalActual;
    const isRefund = difference > 0;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block text-slate-900">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print:hidden">
                    <h2 className="text-lg font-bold text-slate-800">Liquidation Report Preview</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors"
                        >
                            <Printer size={18} /> Print
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Printable Content - Only this div and its children will be visible when printing */}
                <div id="printable-content" className="p-8 print:p-0 [&_*]:text-slate-900">
                    <div className="max-w-3xl mx-auto print:max-w-none">

                        {/* Title */}
                        <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide mb-1">Liquidation Report</h1>
                            <p className="text-slate-600 font-medium">Finance Department</p>
                        </div>

                        {/* Header Details */}
                        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
                            <div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                                    <span className="font-semibold text-slate-700">Business Unit:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{business?.name || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                                    <span className="font-semibold text-slate-700">Requester:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{requester?.name || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="font-semibold text-slate-700">Project:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{req.description || 'N/A'}</span>
                                </div>
                            </div>
                            <div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                                    <span className="font-semibold text-slate-700">Control No:</span>
                                    <span className="text-slate-900 font-mono font-bold border-b border-slate-200 pb-1">{req.id}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                                    <span className="font-semibold text-slate-700">Date Filed:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{new Date(liquidation.dateFiled).toLocaleDateString()}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="font-semibold text-slate-700">Status:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{req.status.replace(/_/g, ' ')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Expense Breakdown Table */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Expense Breakdown</h3>
                            <table className="w-full text-sm border-collapse border border-slate-300">
                                <thead className="bg-slate-100 print:bg-slate-100">
                                    <tr>
                                        <th className="border border-slate-300 px-3 py-2 text-left text-slate-800 font-bold">Item Description</th>
                                        <th className="border border-slate-300 px-3 py-2 text-center w-16 text-slate-800 font-bold">Qty</th>
                                        <th className="border border-slate-300 px-3 py-2 text-right w-24 text-slate-800 font-bold">Est. Cost</th>
                                        <th className="border border-slate-300 px-3 py-2 text-right w-24 text-slate-800 font-bold">Actual Cost</th>
                                        <th className="border border-slate-300 px-3 py-2 text-right w-24 text-slate-800 font-bold">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(req.items || []).map((item, index) => (
                                        <tr key={index}>
                                            <td className="border border-slate-300 px-3 py-2 font-medium text-slate-900">{item.name}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{item.quantity || 0}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">₱{(item.price ?? 0).toLocaleString()}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">₱{(item.actualCost ?? 0).toLocaleString()}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-right font-medium text-slate-900">₱{((item.actualCost ?? 0) * (item.quantity || 0)).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold">
                                    <tr>
                                        <td colSpan={4} className="border border-slate-300 px-3 py-2 text-right text-slate-900">Total Actual Expenses</td>
                                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">₱{totalActual.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Summary Table */}
                        <div className="mb-12 w-1/2 ml-auto">
                            <table className="w-full text-sm border border-slate-300">
                                <tbody>
                                    <tr>
                                        <td className="border border-slate-300 px-3 py-2 font-semibold bg-slate-50 text-slate-900">Total Cash Advance</td>
                                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">₱{cashAdvance.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 px-3 py-2 font-semibold bg-slate-50 text-slate-900">Total Actual Expenses</td>
                                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">₱{totalActual.toLocaleString()}</td>
                                    </tr>
                                    <tr className={isRefund ? 'text-green-700' : 'text-red-700'}>
                                        <td className="border border-slate-300 px-3 py-2 font-bold bg-slate-50 text-inherit">
                                            {isRefund ? 'Amount to Return (Refund)' : 'Amount to Reimburse'}
                                        </td>
                                        <td className="border border-slate-300 px-3 py-2 text-right font-bold text-inherit">
                                            ₱{Math.abs(difference).toLocaleString()}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-3 gap-8 mt-12 break-inside-avoid">
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-8">Liquidated By</div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">{requester?.name || 'Employee'}</div>
                                <div className="text-xs text-slate-500">Requester</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-8">Checked By</div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">Finance / Admin</div>
                                <div className="text-xs text-slate-500">Finance Officer</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-8">Audited By</div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">{liquidation.auditedBy ? 'Auditor' : 'Auditor'}</div>
                                <div className="text-xs text-slate-500">Auditor</div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
                            <span>Generated via ProcureFlow System</span>
                            <span>Printed: {new Date().toLocaleString()}</span>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiquidationPrintModal;
