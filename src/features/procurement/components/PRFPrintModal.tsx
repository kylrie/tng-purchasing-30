import React, { useMemo } from 'react';
import { Printer } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';
import type { RequisitionItem } from '../types';

interface PRFPrintModalProps {
    req: Requisition;
    onClose: () => void;
    business?: Business;
    requester?: User;
    preparedBy?: User;
}

// A4 dimensions in mm: 210 x 297
// Items per page: First page has header so fewer items, subsequent pages have more
const ITEMS_FIRST_PAGE = 8;
const ITEMS_PER_PAGE = 15;

const PRFPrintModal: React.FC<PRFPrintModalProps> = ({ req, onClose, business, preparedBy }) => {

    const handlePrint = () => {
        window.print();
    };

    const supplier = req.prfDetails?.supplier;
    const totalAmount = req.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Use PRF-level VAT/EWT settings (captured during PRF creation)
    const applyVat = req.applyVat ?? false;
    const vatPercentage = req.vatPercentage ?? 12;
    const applyEwt = req.applyEwt ?? false;
    const ewtPercentage = req.ewtPercentage ?? 2;

    // Calculate VAT and EWT based on PRF settings
    const calculatedVat = applyVat ? (totalAmount / (1 + vatPercentage / 100)) * (vatPercentage / 100) : 0;
    const netOfVat = totalAmount - calculatedVat;
    const withholdingTax = applyEwt ? (netOfVat * (ewtPercentage / 100)) : 0;

    // Use saved netAmount if available, otherwise calculate
    const amountDue = req.netAmount ?? (totalAmount - withholdingTax);

    // Paginate items
    const pages = useMemo(() => {
        const allItems = req.items;
        const result: RequisitionItem[][] = [];

        if (allItems.length <= ITEMS_FIRST_PAGE) {
            // All items fit on first page
            result.push(allItems);
        } else {
            // First page
            result.push(allItems.slice(0, ITEMS_FIRST_PAGE));

            // Subsequent pages
            let remaining = allItems.slice(ITEMS_FIRST_PAGE);
            while (remaining.length > 0) {
                result.push(remaining.slice(0, ITEMS_PER_PAGE));
                remaining = remaining.slice(ITEMS_PER_PAGE);
            }
        }

        return result;
    }, [req.items]);

    const totalPages = pages.length;

    const renderItemsTable = (items: RequisitionItem[], isFirstPage: boolean) => {
        const minRows = isFirstPage ? 10 : ITEMS_PER_PAGE;
        const emptyRows = Math.max(0, minRows - items.length);

        return (
            <table className="w-full text-xs border-collapse border border-slate-900">
                <thead className="text-center font-bold">
                    <tr>
                        <th className="border border-slate-900 px-2 py-2 w-32">ITEM CODE</th>
                        <th className="border border-slate-900 px-2 py-2">DESCRIPTION</th>
                        <th className="border border-slate-900 px-2 py-2 w-14">QTY</th>
                        <th className="border border-slate-900 px-2 py-2 w-14">UNIT</th>
                        <th className="border border-slate-900 px-2 py-2 w-20">PRICE</th>
                        <th className="border border-slate-900 px-2 py-2 w-24">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td className="border border-slate-900 px-2 py-1 text-center text-[10px]">{item.name.substring(0, 12)}</td>
                            <td className="border border-slate-900 px-2 py-1 text-[10px]">{item.name}</td>
                            <td className="border border-slate-900 px-2 py-1 text-center">{item.quantity}</td>
                            <td className="border border-slate-900 px-2 py-1 text-center">{item.uom}</td>
                            <td className="border border-slate-900 px-2 py-1 text-right">₱{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="border border-slate-900 px-2 py-1 text-right font-bold">₱{(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900 mb-1">{business?.name || 'THE FUN GUYS CORP.'}</h1>
                <p className="text-[10px] font-bold mb-0.5">TIN: {business?.tin || '618-365-031'}</p>
                <p className="text-[10px] max-w-lg mx-auto leading-tight">
                    {business?.address || 'Matheus Building, 5382 General Luna St. Poblacion, City of Makati, Fourth District, National Capital Region (NCR), 1210'}
                </p>
            </div>

            {/* Form Title */}
            <div className="text-center mb-4">
                <h2 className="text-lg font-bold uppercase border-b-2 border-slate-900 inline-block pb-1">PURCHASE REQUEST FORM</h2>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 mb-4 text-[10px]">
                {/* Left Column */}
                <div className="space-y-0.5">
                    <div className="grid grid-cols-[90px_1fr] gap-1 items-end">
                        <span className="font-bold">Order to:</span>
                        <span className="border-b border-slate-900 uppercase font-bold">{supplier?.name || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr] gap-1 items-end">
                        <span className="font-bold">Attention:</span>
                        <span className="border-b border-slate-900">Sales Dept</span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr] gap-1 items-start">
                        <span className="font-bold mt-0.5">Delivery Addr:</span>
                        <div className="border-b border-slate-900">
                            <div className="font-bold uppercase text-[9px]">{business?.name || 'THE FUN GUYS CORP.'}</div>
                            <div className="italic text-[8px] leading-tight pb-0.5">
                                {business?.address || 'Matheus Building, 5382 General Luna St. Poblacion, City of Makati'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-0.5">
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">Order No.:</span>
                        <span className="border-b border-slate-900 font-bold text-red-700">{req.id}</span>
                    </div>
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">Date:</span>
                        <span className="border-b border-slate-900 text-[9px]">{req.prfDetails?.datePrepared ? new Date(req.prfDetails.datePrepared)?.toLocaleDateString() : new Date(req.dateCreated)?.toLocaleDateString()}</span>
                    </div>
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">TIN:</span>
                        <span className="border-b border-slate-900">{supplier?.tin || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">Terms:</span>
                        <span className="border-b border-slate-900">{supplier?.terms || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-[70px_1fr] gap-1 items-end">
                        <span className="font-bold text-right pr-1">Project:</span>
                        <span className="border-b border-slate-900">{req.projectName || 'N/A'}</span>
                    </div>
                </div>
            </div>

            {/* Remarks Box */}
            <div className="border border-slate-900 p-1.5 mb-3 text-[10px] flex gap-2">
                <span className="font-bold">Remarks:</span>
                <span>{req.remarks || '-'}</span>
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
                {supplier?.bankDetails?.accountNumber && (
                    <div className="mt-2 border-t border-slate-300 pt-1">
                        <div className="font-bold underline mb-0.5 text-[9px]">BANK DETAILS:</div>
                        <div className="text-[8px]">
                            <span className="font-bold">Bank:</span> {supplier.bankDetails.bankName} <br />
                            <span className="font-bold">Account Name:</span> {supplier.bankDetails.accountName} <br />
                            <span className="font-bold">Account No.:</span> {supplier.bankDetails.accountNumber}
                            {supplier.bankDetails.branch && <><br /><span className="font-bold">Branch:</span> {supplier.bankDetails.branch}</>}
                        </div>
                    </div>
                )}
            </div>

            {/* Totals */}
            <div className="w-1/3 text-[10px]">
                <div className="grid grid-cols-[1fr_80px] border-b border-slate-900">
                    <div className="p-1.5 font-bold text-right pr-2">Total Price</div>
                    <div className="p-1.5 text-right font-bold">₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                {applyVat && (
                    <>
                        <div className="grid grid-cols-[1fr_80px] border-b border-slate-900">
                            <div className="p-1.5 font-bold text-right pr-2">Net of VAT</div>
                            <div className="p-1.5 text-right">{netOfVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="grid grid-cols-[1fr_80px] border-b border-slate-900">
                            <div className="p-1.5 font-bold text-right pr-2">Add: VAT ({vatPercentage}%)</div>
                            <div className="p-1.5 text-right">{calculatedVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        {applyEwt && (
                            <div className="grid grid-cols-[1fr_80px] border-b border-slate-900 text-red-700">
                                <div className="p-1.5 font-bold text-right pr-2">Less: EWT ({ewtPercentage}%)</div>
                                <div className="p-1.5 text-right">({withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>
                            </div>
                        )}
                    </>
                )}
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
                        {preparedBy?.name || req.prfDetails?.preparedByName || '-'}
                    </div>
                    <div className="italic text-[9px]">Purchasing Officer</div>
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
                        OPERATIONS MANAGER
                    </div>
                </div>
            </div>
        </div>
    );

    // Render expense/cost allocation section
    const renderExpenseSharing = () => {
        if (!req.costAllocation || req.costAllocation.length === 0) return null;

        return (
            <div className="border border-slate-900 mb-4 text-[10px]">
                <div className="bg-slate-100 print:bg-transparent px-2 py-1 font-bold border-b border-slate-900">
                    CORPORATE EXPENSE SHARING
                </div>
                <div className="p-2">
                    <table className="w-full text-[9px]">
                        <thead>
                            <tr className="border-b border-slate-400">
                                <th className="text-left py-1 px-2">Business Unit</th>
                                <th className="text-right py-1 px-2 w-16">Share %</th>
                                <th className="text-right py-1 px-2 w-24">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {req.costAllocation.map((alloc, idx) => (
                                <tr key={idx} className="border-b border-slate-200">
                                    <td className="py-1 px-2">{alloc.buName}</td>
                                    <td className="text-right py-1 px-2">{alloc.percentage}%</td>
                                    <td className="text-right py-1 px-2 font-medium">
                                        ₱{alloc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block">
            {/* Print Styles - Enhanced for multi-page PDF */}
            <style>
                {`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 10mm;
                        }
                        body {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        /* Critical: Remove overflow constraints for print */
                        .print-container {
                            max-height: none !important;
                            overflow: visible !important;
                            height: auto !important;
                        }
                        .print-page {
                            page-break-after: always;
                            page-break-inside: avoid;
                            width: 190mm;
                            min-height: 277mm;
                            box-sizing: border-box;
                        }
                        .print-page:last-child {
                            page-break-after: auto;
                        }
                        .print-hidden {
                            display: none !important;
                        }
                        /* Ensure images and tables don't break awkwardly */
                        table, img, figure {
                            page-break-inside: avoid;
                        }
                    }
                `}
            </style>

            <div className="print-container bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:h-auto">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print-hidden print:hidden">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Print Preview (PRF)</h2>
                        <p className="text-xs text-slate-500">A4 Size • {totalPages} Page{totalPages > 1 ? 's' : ''} • {req.items.length} Items</p>
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
                    {pages.map((pageItems, pageIndex) => (
                        <div
                            key={pageIndex}
                            className="print-page p-6 print:p-0"
                            style={{ minHeight: pageIndex === 0 ? 'auto' : undefined }}
                        >
                            <div className="max-w-3xl mx-auto print:max-w-none">
                                {/* First page has full header */}
                                {pageIndex === 0 && renderHeader()}

                                {/* Continuation header for subsequent pages */}
                                {pageIndex > 0 && (
                                    <div className="mb-4 pb-2 border-b border-slate-300 flex justify-between items-center">
                                        <div>
                                            <span className="font-bold text-sm">{req.id}</span>
                                            <span className="text-xs text-slate-500 ml-2">- Continued</span>
                                        </div>
                                        <span className="text-xs text-slate-500">Page {pageIndex + 1} of {totalPages}</span>
                                    </div>
                                )}

                                {/* Items Table */}
                                <div className="mb-0">
                                    {renderItemsTable(pageItems, pageIndex === 0)}
                                </div>

                                {/* Footer Totals & Signatures only on last page */}
                                {pageIndex === totalPages - 1 && (
                                    <>
                                        {renderFooterTotals()}
                                        {renderExpenseSharing()}
                                        {renderSignatures()}

                                        {/* Page indicator */}
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

export default PRFPrintModal;
