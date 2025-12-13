import React from 'react';
import { Printer } from 'lucide-react';
import type { Business } from '../../../shared/types';
import type { PCFLiquidation } from '../services/pcf.service';

interface PCFPrintModalProps {
    liquidation: PCFLiquidation;
    onClose: () => void;
    business?: Business;
}

const PCFPrintModal: React.FC<PCFPrintModalProps> = ({ liquidation, onClose, business }) => {

    const handlePrint = () => {
        window.print();
    };

    const totalAmount = liquidation.totalAmount;
    const netOfVat = totalAmount - liquidation.totalVat;
    const amountDue = totalAmount - liquidation.totalEwt;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print:hidden">
                    <h2 className="text-lg font-bold text-slate-800">Print Preview (PCF Replenishment)</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors"
                        >
                            <Printer size={18} /> Print / Save PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div id="printable-content" className="p-8 print:p-0 font-serif text-slate-900">
                    <div className="max-w-3xl mx-auto print:max-w-none">

                        {/* Company Header */}
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900 mb-1">{business?.name || 'COMPANY NAME'}</h1>
                            <p className="text-xs font-bold mb-1">TIN: {business?.tin || 'N/A'}</p>
                            <p className="text-xs max-w-lg mx-auto leading-tight">
                                {business?.address || 'Company Address'}
                            </p>
                        </div>

                        {/* Form Title */}
                        <div className="text-center mb-8">
                            <h2 className="text-xl font-bold uppercase border-b-2 border-slate-900 inline-block pb-1">PCF REPLENISHMENT</h2>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-x-12 gap-y-1 mb-6 text-xs">
                            {/* Left Column */}
                            <div className="space-y-1">
                                <div className="grid grid-cols-[100px_1fr] gap-2 items-end">
                                    <span className="font-bold">Order to:</span>
                                    <span className="border-b border-slate-900 uppercase font-bold">PCF REPLENISHMENT</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 items-end">
                                    <span className="font-bold">Attention:</span>
                                    <span className="border-b border-slate-900">Sales Dept</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                                    <span className="font-bold mt-1">Delivery Addr:</span>
                                    <div className="border-b border-slate-900">
                                        <div className="font-bold uppercase">{business?.name || 'COMPANY NAME'}</div>
                                        <div className="italic text-[10px] leading-tight pb-1">
                                            {business?.address || 'Company Address'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-1">
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Order No.:</span>
                                    <span className="border-b border-slate-900 font-bold text-red-700">{liquidation.replenishmentPrfId || liquidation.id}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Date:</span>
                                    <span className="border-b border-slate-900">{new Date(liquidation.dateApproved || liquidation.dateCreated).toLocaleString()}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">TIN:</span>
                                    <span className="border-b border-slate-900">N/A</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Terms:</span>
                                    <span className="border-b border-slate-900">Immediate</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Project:</span>
                                    <span className="border-b border-slate-900">N/A</span>
                                </div>
                            </div>
                        </div>

                        {/* Remarks Box */}
                        <div className="border border-slate-900 p-2 mb-4 text-xs flex gap-2">
                            <span className="font-bold">Remarks:</span>
                            <span>Auto-generated from PCF Liquidation {liquidation.id}. {liquidation.approvedByName ? `Approved by ${liquidation.approvedByName}.` : ''}</span>
                        </div>

                        {/* Items Table */}
                        <div className="mb-0">
                            <table className="w-full text-xs border-collapse border border-slate-900">
                                <thead className="text-center font-bold">
                                    <tr>
                                        <th className="border border-slate-900 px-2 py-2 w-32">ITEM CODE</th>
                                        <th className="border border-slate-900 px-2 py-2">DESCRIPTION</th>
                                        <th className="border border-slate-900 px-2 py-2 w-16">QTY</th>
                                        <th className="border border-slate-900 px-2 py-2 w-16">UNIT</th>
                                        <th className="border border-slate-900 px-2 py-2 w-24">PRICE</th>
                                        <th className="border border-slate-900 px-2 py-2 w-24">AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {liquidation.expenses.map((expense, index) => (
                                        <tr key={index}>
                                            <td className="border border-slate-900 px-2 py-1 text-center">{(expense.classification || '').substring(0, 12)}</td>
                                            <td className="border border-slate-900 px-2 py-1">{expense.classification || 'N/A'}: {expense.itemDescription || expense.payeeVendor}</td>
                                            <td className="border border-slate-900 px-2 py-1 text-center">1</td>
                                            <td className="border border-slate-900 px-2 py-1 text-center">lot</td>
                                            <td className="border border-slate-900 px-2 py-1 text-right">₱{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="border border-slate-900 px-2 py-1 text-right font-bold">₱{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    {/* Fill empty rows to make it look like a form (at least 10 rows total) */}
                                    {Array.from({ length: Math.max(0, 10 - liquidation.expenses.length) }).map((_, i) => (
                                        <tr key={`empty-${i}`}>
                                            <td className="border border-slate-900 px-2 py-4">&nbsp;</td>
                                            <td className="border border-slate-900 px-2 py-4">&nbsp;</td>
                                            <td className="border border-slate-900 px-2 py-4">&nbsp;</td>
                                            <td className="border border-slate-900 px-2 py-4">&nbsp;</td>
                                            <td className="border border-slate-900 px-2 py-4">&nbsp;</td>
                                            <td className="border border-slate-900 px-2 py-4">&nbsp;</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Totals & Reminders */}
                        <div className="flex border-x border-b border-slate-900 mb-8">
                            {/* Reminders */}
                            <div className="w-2/3 p-3 border-r border-slate-900">
                                <div className="font-bold underline mb-2 text-xs">REMINDERS:</div>
                                <ul className="list-disc pl-4 text-[10px] space-y-1">
                                    <li>All deliveries must be accompanied by a faxed copy of our PO.</li>
                                    <li>Original Invoice and Delivery Receipt must be submitted upon delivery.</li>
                                    <li>No PO, No Payment.</li>
                                </ul>
                            </div>

                            {/* Totals */}
                            <div className="w-1/3 text-xs">
                                <div className="grid grid-cols-[1fr_100px] border-b border-slate-900">
                                    <div className="p-2 font-bold text-right pr-4">Total Price</div>
                                    <div className="p-2 text-right font-bold">₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div className="grid grid-cols-[1fr_100px] border-b border-slate-900">
                                    <div className="p-2 font-bold text-right pr-4">Net of VAT</div>
                                    <div className="p-2 text-right">{netOfVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div className="grid grid-cols-[1fr_100px] border-b border-slate-900">
                                    <div className="p-2 font-bold text-right pr-4">Add: VAT (12%)</div>
                                    <div className="p-2 text-right">{liquidation.totalVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div className="grid grid-cols-[1fr_100px] border-b border-slate-900 text-red-700">
                                    <div className="p-2 font-bold text-right pr-4">Less: EWT (1%)</div>
                                    <div className="p-2 text-right">({liquidation.totalEwt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>
                                </div>
                                <div className="grid grid-cols-[1fr_100px] bg-slate-100 print:bg-transparent">
                                    <div className="p-2 font-bold text-right pr-4 self-center">Amount Due</div>
                                    <div className="p-2 text-right font-bold text-lg">₱{amountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                            </div>
                        </div>

                        {/* Signatures - FIXED: Prepared By = Custodian, Approved By = Approver */}
                        <div className="border border-slate-900 flex text-xs">
                            <div className="flex-1 p-4 border-r border-slate-900">
                                <div className="font-bold mb-8">Prepared By:</div>
                                <div className="text-center">
                                    <div className="font-bold uppercase border-b border-slate-900 inline-block min-w-[150px] mb-1">
                                        {liquidation.userName}
                                    </div>
                                    <div className="italic">PCF Custodian</div>
                                </div>
                            </div>
                            <div className="flex-1 p-4 border-r border-slate-900">
                                <div className="font-bold mb-8">Checked By:</div>
                                <div className="text-center">
                                    <div className="font-bold uppercase border-b border-slate-900 inline-block min-w-[150px] mb-1">
                                        FINANCE OFFICER
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 p-4">
                                <div className="font-bold mb-8">Approved By:</div>
                                <div className="text-center">
                                    <div className="font-bold uppercase border-b border-slate-900 inline-block min-w-[150px] mb-1">
                                        {liquidation.approvedByName || 'CFO'}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div >
    );
};

export default PCFPrintModal;
