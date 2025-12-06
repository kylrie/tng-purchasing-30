import React from 'react';
import { X, Printer } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';

interface BURFPrintModalProps {
    req: Requisition;
    onClose: () => void;
    business?: Business;
    requester?: User;
}

const BURFPrintModal: React.FC<BURFPrintModalProps> = ({ req, onClose, business, requester }) => {

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print:hidden">
                    <h2 className="text-lg font-bold text-slate-800">Print Preview</h2>
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

                {/* Printable Content - Enforce text color */}
                <div id="printable-content" className="p-8 print:p-0 text-slate-900">
                    <div className="max-w-3xl mx-auto print:max-w-none">

                        {/* Form Header */}
                        <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide mb-1">Business Unit Request Form</h1>
                            <p className="text-slate-600 font-medium">Procurement Department</p>
                        </div>

                        {/* Header Details */}
                        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
                            <div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                                    <span className="font-semibold text-slate-700">Business Unit:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{business?.name || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="font-semibold text-slate-700">Requester:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{requester?.name || 'N/A'}</span>
                                </div>
                            </div>
                            <div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                                    <span className="font-semibold text-slate-700">Control No:</span>
                                    <span className="text-slate-900 font-mono font-bold border-b border-slate-200 pb-1">{req.id}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                                    <span className="font-semibold text-slate-700">Date:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="font-semibold text-slate-700">Status:</span>
                                    <span className="text-slate-900 border-b border-slate-200 pb-1">{req.status.replace(/_/g, ' ')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Requested Items</h3>
                            <table className="w-full text-sm border-collapse border border-slate-300">
                                <thead className="bg-slate-100 print:bg-slate-100">
                                    <tr>
                                        <th className="border border-slate-300 px-3 py-2 text-left text-slate-800 w-12">#</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left text-slate-800">Item Description</th>
                                        <th className="border border-slate-300 px-3 py-2 text-center text-slate-800 w-24">Qty</th>
                                        <th className="border border-slate-300 px-3 py-2 text-center text-slate-800 w-24">UOM</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left text-slate-800">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {req.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{index + 1}</td>
                                            <td className="border border-slate-300 px-3 py-2 font-medium text-slate-900">{item.name}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{item.quantity}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{item.uom}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-slate-700 italic">{item.remarks || '-'}</td>
                                        </tr>
                                    ))}
                                    {/* Fill empty rows if needed for layout */}
                                    {req.items.length < 5 && Array.from({ length: 5 - req.items.length }).map((_, i) => (
                                        <tr key={`empty-${i}`}>
                                            <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                                            <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                                            <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                                            <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                                            <td className="border border-slate-300 px-3 py-4">&nbsp;</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Description/Purpose */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Purpose / Justification</h3>
                            <div className="border border-slate-300 rounded p-4 min-h-[80px] text-sm text-slate-900">
                                {req.description}
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-3 gap-8 mt-12 break-inside-avoid">
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-8">Requested By</div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">{requester?.name || 'Employee'}</div>
                                <div className="text-xs text-slate-500">Requester</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-8">Reviewed By</div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">Manager Name</div>
                                <div className="text-xs text-slate-500">Business Unit Manager</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-8">Approved By</div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">CIC Name</div>
                                <div className="text-xs text-slate-500">Inventory Controller</div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
                            <span>Generated via TES (TNG ERP System)</span>
                            <span>Printed: {new Date()?.toLocaleString()}</span>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default BURFPrintModal;
