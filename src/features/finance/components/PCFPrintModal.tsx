import React, { useMemo } from 'react';
import { Printer } from 'lucide-react';
import type { Business } from '../../../shared/types';
import type { PCFLiquidation, PCFExpenseItem } from '../services/pcf.service';

interface PCFPrintModalProps {
    liquidation: PCFLiquidation;
    onClose: () => void;
    business?: Business;
}

// A4 dimensions - Items per page
const ITEMS_FIRST_PAGE = 8;
const ITEMS_PER_PAGE = 15;

const PCFPrintModal: React.FC<PCFPrintModalProps> = ({ liquidation, onClose, business }) => {

    const handlePrint = () => {
        const printContent = document.getElementById('printable-content');
        if (!printContent) return;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            alert('Please allow popups to print');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>PCF Replenishment - ${liquidation.replenishmentPrfId || liquidation.id}</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { 
                        font-family: Georgia, 'Times New Roman', serif; 
                        color: #1e293b;
                        margin: 0;
                        padding: 20px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    * { box-sizing: border-box; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #1e293b; padding: 6px 8px; text-align: left; font-size: 11px; }
                    th { text-align: center; font-weight: bold; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-bold { font-weight: bold; }
                    .text-red-700 { color: #b91c1c; }
                    .border-b { border-bottom: 1px solid #1e293b; }
                    .mb-0 { margin-bottom: 0; }
                    .mb-1 { margin-bottom: 4px; }
                    .mb-3 { margin-bottom: 12px; }
                    .mb-4 { margin-bottom: 16px; }
                    .mt-2 { margin-top: 8px; }
                    .mt-4 { margin-top: 16px; }
// eslint-disable-next-line no-useless-escape
                    .p-1\.5 { padding: 6px; }
                    .p-2 { padding: 8px; }
                    .p-3 { padding: 12px; }
                    .text-xs { font-size: 10px; }
                    .text-sm { font-size: 12px; }
                    .text-lg { font-size: 16px; }
                    .text-xl { font-size: 18px; }
                    .uppercase { text-transform: uppercase; }
                    .italic { font-style: italic; }
                    .underline { text-decoration: underline; }
                    .grid { display: grid; }
                    .flex { display: flex; }
                    .inline-block { display: inline-block; }
                    .border { border: 1px solid #1e293b; }
                    .border-x { border-left: 1px solid #1e293b; border-right: 1px solid #1e293b; }
                    .border-b { border-bottom: 1px solid #1e293b; }
                    .border-r { border-right: 1px solid #1e293b; }
                    .print-page { page-break-after: always; }
                    .print-page:last-child { page-break-after: auto; }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();

        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
        // FIX: Removed duplicate setTimeout print call that caused print dialog to appear twice
    };

    const totalAmount = liquidation.totalAmount;
    const netOfVat = totalAmount - liquidation.totalVat;
    const amountDue = totalAmount - liquidation.totalEwt;

    // Paginate expenses
    const pages = useMemo(() => {
        const allExpenses = liquidation.expenses;
        const result: PCFExpenseItem[][] = [];

        if (allExpenses.length <= ITEMS_FIRST_PAGE) {
            result.push(allExpenses);
        } else {
            result.push(allExpenses.slice(0, ITEMS_FIRST_PAGE));

            let remaining = allExpenses.slice(ITEMS_FIRST_PAGE);
            while (remaining.length > 0) {
                result.push(remaining.slice(0, ITEMS_PER_PAGE));
                remaining = remaining.slice(ITEMS_PER_PAGE);
            }
        }

        return result;
    }, [liquidation.expenses]);

    const totalPages = pages.length;

    const renderItemsTable = (expenses: PCFExpenseItem[], isFirstPage: boolean) => {
        const minRows = isFirstPage ? 10 : ITEMS_PER_PAGE;
        const emptyRows = Math.max(0, minRows - expenses.length);

        return (
            <table className="w-full text-xs border-collapse border border-slate-900">
                <thead className="text-center font-bold">
                    <tr>
                        <th className="border border-slate-900 px-2 py-2 w-32">ITEM CODE</th>
                        <th className="border border-slate-900 px-2 py-2">DESCRIPTION</th>
                        <th className="border border-slate-900 px-2 py-2 w-28">BU</th>
                        <th className="border border-slate-900 px-2 py-2 w-14">QTY</th>
                        <th className="border border-slate-900 px-2 py-2 w-14">UNIT</th>
                        <th className="border border-slate-900 px-2 py-2 w-20">PRICE</th>
                        <th className="border border-slate-900 px-2 py-2 w-24">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    {expenses.map((expense, index) => (
                        <tr key={index}>
                            <td className="border border-slate-900 px-2 py-1 text-center text-[10px]">{(expense.coaCode || expense.classification || '').substring(0, 12)}</td>
                            <td className="border border-slate-900 px-2 py-1 text-[10px]">{expense.coaName || expense.classification || 'N/A'}: {expense.itemDescription || expense.payeeVendor}</td>
                            <td className="border border-slate-900 px-2 py-1 text-[9px] text-center">{expense.buName || business?.name || '-'}</td>
                            <td className="border border-slate-900 px-2 py-1 text-center">1</td>
                            <td className="border border-slate-900 px-2 py-1 text-center">lot</td>
                            <td className="border border-slate-900 px-2 py-1 text-right">₱{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="border border-slate-900 px-2 py-1 text-right font-bold">₱{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ))}
                    {/* Fill empty rows */}
                    {Array.from({ length: emptyRows }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td className="border border-slate-900 px-2 py-3">&nbsp;</td>
                            <td className="border border-slate-900 px-2 py-3">&nbsp;</td>
                            <td className="border border-slate-900 px-2 py-3">&nbsp;</td>
                            <td className="border border-slate-900 px-2 py-3">&nbsp;</td>
                            <td className="border border-slate-900 px-2 py-3">&nbsp;</td>
                            <td className="border border-slate-900 px-2 py-3">&nbsp;</td>
                            <td className="border border-slate-900 px-2 py-3">&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const renderHeader = () => (
        <>
            {/* Company Header */}
            <div className="text-center mb-4">
                <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900 mb-1">{business?.name || 'COMPANY NAME'}</h1>
                <p className="text-[10px] font-bold mb-0.5">TIN: {business?.tin || 'N/A'}</p>
                <p className="text-[10px] max-w-lg mx-auto leading-tight">
                    {business?.address || 'Company Address'}
                </p>
            </div>

            {/* Form Title */}
            <div className="text-center mb-4">
                <h2 className="text-lg font-bold uppercase border-b-2 border-slate-900 inline-block pb-1">PCF REPLENISHMENT</h2>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 mb-4 text-[10px]">
                {/* Left Column */}
                <div className="space-y-0.5">
                    <div className="grid grid-cols-[90px_1fr] gap-1 items-end">
                        <span className="font-bold">Order to:</span>
                        <span className="border-b border-slate-900 uppercase font-bold">PCF REPLENISHMENT</span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr] gap-1 items-end">
                        <span className="font-bold">Attention:</span>
                        <span className="border-b border-slate-900">Finance Dept</span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr] gap-1 items-start">
                        <span className="font-bold mt-0.5">Delivery Addr:</span>
                        <div className="border-b border-slate-900">
                            <div className="font-bold uppercase text-[9px]">{business?.name || 'COMPANY NAME'}</div>
                            <div className="italic text-[8px] leading-tight pb-0.5">
                                {business?.address || 'Company Address'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-0.5">
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">Order No.:</span>
                        <span className="border-b border-slate-900 font-bold text-red-700">{liquidation.replenishmentPrfId || liquidation.id}</span>
                    </div>
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">Date:</span>
                        <span className="border-b border-slate-900 text-[9px]">{new Date(liquidation.dateApproved || liquidation.dateCreated).toLocaleDateString()}</span>
                    </div>
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">TIN:</span>
                        <span className="border-b border-slate-900">N/A</span>
                    </div>
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">Terms:</span>
                        <span className="border-b border-slate-900">Immediate</span>
                    </div>
                </div>
            </div>

            {/* Remarks Box */}
            <div className="border border-slate-900 p-1.5 mb-3 text-[10px] flex gap-2">
                <span className="font-bold">Remarks:</span>
                <span>Auto-generated from PCF Liquidation {liquidation.id}. {liquidation.approvedByName ? `Approved by ${liquidation.approvedByName}.` : ''}</span>
            </div>
        </>
    );

    const renderFooterTotals = () => (
        <div className="flex border-x border-b border-slate-900 mb-4">
            {/* Reminders */}
            <div className="w-2/3 p-2 border-r border-slate-900">
                <div className="font-bold underline mb-1 text-[10px]">REMINDERS:</div>
                <ul className="list-disc pl-3 text-[9px] space-y-0.5">
                    <li>All deliveries must be accompanied by a faxed copy of our PO.</li>
                    <li>Original Invoice and Delivery Receipt must be submitted upon delivery.</li>
                    <li>No PO, No Payment.</li>
                </ul>
            </div>

            {/* Totals */}
            <div className="w-1/3 text-[10px]">
                <div className="grid grid-cols-[1fr_80px] border-b border-slate-900">
                    <div className="p-1.5 font-bold text-right pr-2">Total Price</div>
                    <div className="p-1.5 text-right font-bold">₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="grid grid-cols-[1fr_80px] border-b border-slate-900">
                    <div className="p-1.5 font-bold text-right pr-2">Net of VAT</div>
                    <div className="p-1.5 text-right">{netOfVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="grid grid-cols-[1fr_80px] border-b border-slate-900">
                    <div className="p-1.5 font-bold text-right pr-2">Add: VAT (12%)</div>
                    <div className="p-1.5 text-right">{liquidation.totalVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="grid grid-cols-[1fr_80px] border-b border-slate-900 text-red-700">
                    <div className="p-1.5 font-bold text-right pr-2">Less: EWT (1%)</div>
                    <div className="p-1.5 text-right">({liquidation.totalEwt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>
                </div>
                <div className="grid grid-cols-[1fr_80px] bg-slate-100 print:bg-transparent">
                    <div className="p-1.5 font-bold text-right pr-2 self-center">Amount Due</div>
                    <div className="p-1.5 text-right font-bold text-base">₱{amountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            </div>
        </div>
    );

    const renderSignatures = () => (
        <div className="border border-slate-900 flex text-[10px]">
            <div className="flex-1 p-3 border-r border-slate-900">
                <div className="font-bold mb-6">Prepared By:</div>
                <div className="text-center">
                    <div className="font-bold uppercase border-b border-slate-900 inline-block min-w-[120px] mb-1">
                        {liquidation.userName}
                    </div>
                    <div className="italic text-[9px]">PCF Custodian</div>
                </div>
            </div>
            <div className="flex-1 p-3 border-r border-slate-900">
                <div className="font-bold mb-6">Checked By:</div>
                <div className="text-center">
                    <div className="font-bold uppercase border-b border-slate-900 inline-block min-w-[120px] mb-1">
                        FINANCE OFFICER
                    </div>
                </div>
            </div>
            <div className="flex-1 p-3">
                <div className="font-bold mb-6">Approved By:</div>
                <div className="text-center">
                    <div className="font-bold uppercase border-b border-slate-900 inline-block min-w-[120px] mb-1">
                        {liquidation.approvedByName || 'CFO'}
                    </div>
                </div>
            </div>
        </div>
    );

    // Calculate BU breakdown from item-level buId, not user's main business
    const buBreakdown = useMemo(() => {
        const breakdown: { [key: string]: { name: string; amount: number; vat: number; ewt: number } } = {};

        liquidation.expenses.forEach(exp => {
            const buId = exp.buId || liquidation.businessId;
            const buName = exp.buName || business?.name || 'Main Business';

            if (!breakdown[buId]) {
                breakdown[buId] = { name: buName, amount: 0, vat: 0, ewt: 0 };
            }
            breakdown[buId].amount += exp.amount;
            breakdown[buId].vat += exp.vat;
            breakdown[buId].ewt += exp.ewt;
        });

        return Object.entries(breakdown).map(([id, data]) => ({
            id,
            name: data.name,
            amount: data.amount,
            vat: data.vat,
            ewt: data.ewt,
            netAmount: data.amount - data.ewt
        }));
    }, [liquidation.expenses, liquidation.businessId, business?.name]);

    const renderBuBreakdown = () => {
        if (buBreakdown.length <= 1) return null; // Only show if multiple BUs

        return (
            <div className="mt-4 border border-slate-900">
                <div className="bg-slate-100 p-2 font-bold text-[11px] border-b border-slate-900 text-center">
                    CORP SHARING SUMMARY (By Business Unit)
                </div>
                <table className="w-full text-[10px]">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="border-b border-slate-900 p-2 text-left">Business Unit</th>
                            <th className="border-b border-slate-900 p-2 text-right">Amount</th>
                            <th className="border-b border-slate-900 p-2 text-right">VAT</th>
                            <th className="border-b border-slate-900 p-2 text-right">EWT</th>
                            <th className="border-b border-slate-900 p-2 text-right font-bold">Net Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {buBreakdown.map((bu, idx) => (
                            <tr key={bu.id}>
                                <td className={`p-2 text-left ${idx < buBreakdown.length - 1 ? 'border-b border-slate-300' : ''}`}>
                                    {bu.name}
                                </td>
                                <td className={`p-2 text-right ${idx < buBreakdown.length - 1 ? 'border-b border-slate-300' : ''}`}>
                                    ₱{bu.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className={`p-2 text-right ${idx < buBreakdown.length - 1 ? 'border-b border-slate-300' : ''}`}>
                                    ₱{bu.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className={`p-2 text-right text-red-700 ${idx < buBreakdown.length - 1 ? 'border-b border-slate-300' : ''}`}>
                                    (₱{bu.ewt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                </td>
                                <td className={`p-2 text-right font-bold ${idx < buBreakdown.length - 1 ? 'border-b border-slate-300' : ''}`}>
                                    ₱{bu.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print-hidden print:hidden">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Print Preview (PCF Replenishment)</h2>
                        <p className="text-xs text-slate-500">A4 Size • {totalPages} Page{totalPages > 1 ? 's' : ''} • {liquidation.expenses.length} Items</p>
                    </div>
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

                {/* Printable Content - Pages */}
                <div id="printable-content" className="font-serif text-slate-900">
                    {pages.map((pageExpenses, pageIndex) => (
                        <div
                            key={pageIndex}
                            className="print-page p-6 print:p-0"
                        >
                            <div className="max-w-3xl mx-auto print:max-w-none">
                                {/* First page has full header */}
                                {pageIndex === 0 && renderHeader()}

                                {/* Continuation header for subsequent pages */}
                                {pageIndex > 0 && (
                                    <div className="mb-4 pb-2 border-b border-slate-300 flex justify-between items-center">
                                        <div>
                                            <span className="font-bold text-sm">{liquidation.replenishmentPrfId || liquidation.id}</span>
                                            <span className="text-xs text-slate-500 ml-2">- Continued</span>
                                        </div>
                                        <span className="text-xs text-slate-500">Page {pageIndex + 1} of {totalPages}</span>
                                    </div>
                                )}

                                {/* Items Table */}
                                <div className="mb-0">
                                    {renderItemsTable(pageExpenses, pageIndex === 0)}
                                </div>

                                {/* Footer Totals & Signatures only on last page */}
                                {pageIndex === totalPages - 1 && (
                                    <>
                                        {renderFooterTotals()}
                                        {renderSignatures()}
                                        {renderBuBreakdown()}

                                        {totalPages > 1 && (
                                            <div className="mt-2 text-center text-[9px] text-slate-400">
                                                Page {pageIndex + 1} of {totalPages}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Page number for non-last pages */}
                                {pageIndex < totalPages - 1 && (
                                    <div className="mt-4 text-center text-[9px] text-slate-400">
                                        Page {pageIndex + 1} of {totalPages} - Continued on next page
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PCFPrintModal;
