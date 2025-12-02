import React from 'react';
import { Printer } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';

interface PRFPrintModalProps {
    req: Requisition;
    onClose: () => void;
    business?: Business;
    requester?: User;
    preparedBy?: User;
}

const PRFPrintModal: React.FC<PRFPrintModalProps> = ({ req, onClose, business, preparedBy }) => {

    const handlePrint = () => {
        window.print();
    };

    const supplier = req.prfDetails?.supplier;
    const totalAmount = req.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Calculate VAT based on supplier's vatable status
    const isVatable = supplier?.isVatable !== false; // Default to true if undefined
    const calculatedVat = isVatable ? (totalAmount / 1.12) * 0.12 : 0;
    const netOfVat = totalAmount - calculatedVat;
    const withholdingTax = isVatable ? (netOfVat * 0.01) : 0; // 1% EWT if vatable
    // If it's goods, typically 1%, services 2%. For now assuming 1% for goods.
    // If user wants custom tax, we might need more logic, but this is standard.

    const amountDue = totalAmount - withholdingTax;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print:hidden">
                    <h2 className="text-lg font-bold text-slate-800">Print Preview (PRF)</h2>
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
                            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900 mb-1">{business?.name || 'THE FUN GUYS CORP.'}</h1>
                            <p className="text-xs font-bold mb-1">TIN: {business?.tin || '618-365-031'}</p>
                            <p className="text-xs max-w-lg mx-auto leading-tight">
                                {business?.address || 'Matheus Building, 5382 General Luna St. Poblacion, City of Makati, Fourth District, National Capital Region (NCR), 1210'}
                            </p>
                        </div>

                        {/* Form Title */}
                        <div className="text-center mb-8">
                            <h2 className="text-xl font-bold uppercase border-b-2 border-slate-900 inline-block pb-1">PURCHASE REQUEST FORM</h2>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-x-12 gap-y-1 mb-6 text-xs">
                            {/* Left Column */}
                            <div className="space-y-1">
                                <div className="grid grid-cols-[100px_1fr] gap-2 items-end">
                                    <span className="font-bold">Order to:</span>
                                    <span className="border-b border-slate-900 uppercase font-bold">{supplier?.name || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 items-end">
                                    <span className="font-bold">Attention:</span>
                                    <span className="border-b border-slate-900">Sales Dept</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                                    <span className="font-bold mt-1">Delivery Addr:</span>
                                    <div className="border-b border-slate-900">
                                        <div className="font-bold uppercase">{business?.name || 'THE FUN GUYS CORP.'}</div>
                                        <div className="italic text-[10px] leading-tight pb-1">
                                            {business?.address || 'Matheus Building, 5382 General Luna St. Poblacion, City of Makati, Fourth District, National Capital Region (NCR), 1210'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-1">
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Order No.:</span>
                                    <span className="border-b border-slate-900 font-bold text-red-700">{req.id}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Date:</span>
                                    <span className="border-b border-slate-900">{req.prfDetails?.datePrepared ? new Date(req.prfDetails.datePrepared)?.toLocaleString() : new Date(req.dateCreated)?.toLocaleString()}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">TIN:</span>
                                    <span className="border-b border-slate-900">{supplier?.tin || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Terms:</span>
                                    <span className="border-b border-slate-900">{supplier?.terms || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] gap-2 items-end">
                                    <span className="font-bold text-right pr-2">Project:</span>
                                    <span className="border-b border-slate-900">{req.projectName || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Remarks Box */}
                        <div className="border border-slate-900 p-2 mb-4 text-xs flex gap-2">
                            <span className="font-bold">Remarks:</span>
                            <span>{req.remarks || 'needed urgently'}</span>
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
                                    {req.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="border border-slate-900 px-2 py-1 text-center">{item.name.substring(0, 12)}</td>
                                            <td className="border border-slate-900 px-2 py-1">{item.name}</td>
                                            <td className="border border-slate-900 px-2 py-1 text-center">{item.quantity}</td>
                                            <td className="border border-slate-900 px-2 py-1 text-center">{item.uom}</td>
                                            <td className="border border-slate-900 px-2 py-1 text-right">₱{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="border border-slate-900 px-2 py-1 text-right font-bold">₱{(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    {/* Fill empty rows to make it look like a form (at least 10 rows total) */}
                                    {Array.from({ length: Math.max(0, 10 - req.items.length) }).map((_, i) => (
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
                                {supplier?.bankDetails?.accountNumber && (
                                    <div className="mt-4 border-t border-slate-300 pt-2">
                                        <div className="font-bold underline mb-1 text-xs">BANK DETAILS:</div>
                                        <div className="text-[10px]">
                                            <span className="font-bold">Bank:</span> {supplier.bankDetails.bankName} <br />
                                            <span className="font-bold">Account Name:</span> {supplier.bankDetails.accountName} <br />
                                            <span className="font-bold">Account No.:</span> {supplier.bankDetails.accountNumber} <br />
                                            {supplier.bankDetails.branch && <><span className="font-bold">Branch:</span> {supplier.bankDetails.branch}</>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Totals */}
                            <div className="w-1/3 text-xs">
                                <div className="grid grid-cols-[1fr_100px] border-b border-slate-900">
                                    <div className="p-2 font-bold text-right pr-4">Total Price</div>
                                    <div className="p-2 text-right font-bold">₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                {isVatable && (
                                    <>
                                        <div className="grid grid-cols-[1fr_100px] border-b border-slate-900">
                                            <div className="p-2 font-bold text-right pr-4">Net of VAT</div>
                                            <div className="p-2 text-right">{netOfVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        </div>
                                        <div className="grid grid-cols-[1fr_100px] border-b border-slate-900">
                                            <div className="p-2 font-bold text-right pr-4">Add: VAT (12%)</div>
                                            <div className="p-2 text-right">{calculatedVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        </div>
                                        <div className="grid grid-cols-[1fr_100px] border-b border-slate-900 text-red-700">
                                            <div className="p-2 font-bold text-right pr-4">Less: EWT (1%)</div>
                                            <div className="p-2 text-right">({withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>
                                        </div>
                                    </>
                                )}
                                {!isVatable && (
                                     <div className="grid grid-cols-[1fr_100px] border-b border-slate-900">
                                        <div className="p-2 font-bold text-right pr-4">Non-Vatable</div>
                                        <div className="p-2 text-right text-slate-500 italic">0.00</div>
                                    </div>
                                )}
                                <div className="grid grid-cols-[1fr_100px] bg-slate-100 print:bg-transparent">
                                    <div className="p-2 font-bold text-right pr-4 self-center">Amount Due</div>
                                    <div className="p-2 text-right font-bold text-lg">₱{amountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="border border-slate-900 flex text-xs">
                            <div className="flex-1 p-4 border-r border-slate-900">
                                <div className="font-bold mb-8">Prepared By:</div>
                                <div className="text-center">
                                    <div className="font-bold uppercase border-b border-slate-900 inline-block min-w-[150px] mb-1">
                                        {preparedBy?.name || req.prfDetails?.preparedBy || 'BOJ MOJICA'}
                                    </div>
                                    <div className="italic">Purchasing Officer</div>
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
                                        OPERATIONS MANAGER
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

export default PRFPrintModal;
