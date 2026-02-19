import React, { useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';
import type { RequisitionItem } from '../types';

interface BURFPrintModalProps {
    req: Requisition;
    onClose: () => void;
    business?: Business;
    requester?: User;
}

// A4 dimensions - Items per page
const ITEMS_FIRST_PAGE = 12;
const ITEMS_PER_PAGE = 20;

const BURFPrintModal: React.FC<BURFPrintModalProps> = ({ req, onClose, business, requester }) => {

    const handlePrint = () => {
        window.print();
    };

    // Paginate items
    const pages = useMemo(() => {
        const allItems = req.items;
        const result: RequisitionItem[][] = [];

        if (allItems.length <= ITEMS_FIRST_PAGE) {
            result.push(allItems);
        } else {
            result.push(allItems.slice(0, ITEMS_FIRST_PAGE));

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
        const minRows = isFirstPage ? 5 : ITEMS_PER_PAGE;
        const emptyRows = Math.max(0, minRows - items.length);

        return (
            <table className="w-full text-sm border-collapse border border-slate-300">
                <thead className="bg-slate-100 print:bg-slate-100">
                    <tr>
                        <th className="border border-slate-300 px-3 py-2 text-left text-slate-800 w-12">#</th>
                        <th className="border border-slate-300 px-3 py-2 text-left text-slate-800">Item Description</th>
                        <th className="border border-slate-300 px-3 py-2 text-center text-slate-800 w-20">Qty</th>
                        <th className="border border-slate-300 px-3 py-2 text-center text-slate-800 w-20">UOM</th>
                        <th className="border border-slate-300 px-3 py-2 text-left text-slate-800">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{index + 1}</td>
                            <td className="border border-slate-300 px-3 py-2 font-medium text-slate-900">{item.name}</td>
                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{item.quantity}</td>
                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-900">{item.uom}</td>
                            <td className="border border-slate-300 px-3 py-2 text-slate-700 italic">{item.remarks || '-'}</td>
                        </tr>
                    ))}
                    {/* Fill empty rows */}
                    {Array.from({ length: emptyRows }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td className="border border-slate-300 px-3 py-3">&nbsp;</td>
                            <td className="border border-slate-300 px-3 py-3">&nbsp;</td>
                            <td className="border border-slate-300 px-3 py-3">&nbsp;</td>
                            <td className="border border-slate-300 px-3 py-3">&nbsp;</td>
                            <td className="border border-slate-300 px-3 py-3">&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const renderHeader = () => (
        <>
            {/* Form Header */}
            <div className="text-center mb-6 border-b-2 border-slate-800 pb-4">
                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide mb-1">Business Unit Request Form</h1>
                <p className="text-slate-600 font-medium">Procurement Department</p>
            </div>

            {/* Header Details */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 mb-6 text-sm">
                <div>
                    <div className="grid grid-cols-[100px_1fr] gap-2 mb-2">
                        <span className="font-semibold text-slate-700">Business Unit:</span>
                        <span className="text-slate-900 border-b border-slate-200 pb-1">{business?.name || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                        <span className="font-semibold text-slate-700">Requester:</span>
                        <span className="text-slate-900 border-b border-slate-200 pb-1">{requester?.name || req.requesterName || 'N/A'}</span>
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
                        <span className="font-semibold text-slate-700">Date Needed:</span>
                        <span className="text-slate-900 border-b border-slate-200 pb-1">{req.dateNeeded ? new Date(req.dateNeeded).toLocaleDateString() : 'N/A'}</span>
                    </div>
                </div>
            </div>
        </>
    );

    const renderFooter = () => (
        <>
            {/* Description/Purpose */}
            <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Purpose / Justification</h3>
                <div className="border border-slate-300 rounded p-3 min-h-[60px] text-sm text-slate-900">
                    {req.description}
                </div>
            </div>

            {/* Remarks if any */}
            {req.remarks && (
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Remarks</h3>
                    <div className="border border-slate-300 rounded p-3 text-sm text-slate-900">
                        {req.remarks}
                    </div>
                </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-8 break-inside-avoid">
                <div className="text-center">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-2">Requested By</div>
                    <div className="h-[70px] flex items-end justify-center"></div>
                    <div className="border-b border-slate-800 mb-2"></div>
                    <div className="font-bold text-sm text-slate-900">{requester?.name || req.requesterName || 'Employee'}</div>
                    <div className="text-xs text-slate-500">Requester</div>
                </div>
                {(() => {
                    // Find approval history entries with signatures
                    const approvalEntries = (req.history || []).filter(
                        (h) => h.action?.toLowerCase().includes('approved')
                    );
                    const firstApproval = approvalEntries[0];
                    const secondApproval = approvalEntries[1];
                    return (
                        <>
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Reviewed By</div>
                                <div className="h-[70px] flex items-end justify-center">
                                    {firstApproval?.signatureUrl && (
                                        <img src={firstApproval.signatureUrl} alt="Signature" className="max-h-[68px] max-w-[180px] object-contain" />
                                    )}
                                </div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">{firstApproval?.actorName || 'Manager Name'}</div>
                                <div className="text-xs text-slate-500">Business Unit Manager</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Approved By</div>
                                <div className="h-[70px] flex items-end justify-center">
                                    {secondApproval?.signatureUrl && (
                                        <img src={secondApproval.signatureUrl} alt="Signature" className="max-h-[68px] max-w-[180px] object-contain" />
                                    )}
                                </div>
                                <div className="border-b border-slate-800 mb-2"></div>
                                <div className="font-bold text-sm text-slate-900">{secondApproval?.actorName || (firstApproval && !secondApproval ? '' : 'CIC Name')}</div>
                                <div className="text-xs text-slate-500">Inventory Controller</div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-3 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
                <span>Generated via Thenextperience ERP System (TES)</span>
                <span>Printed: {new Date()?.toLocaleString()}</span>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block">
            {/* Print Styles */}
            <style>
                {`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 12mm;
                        }
                        body {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .print-page {
                            page-break-after: always;
                            width: 186mm;
                            min-height: 273mm;
                            box-sizing: border-box;
                        }
                        .print-page:last-child {
                            page-break-after: auto;
                        }
                        .print-hidden {
                            display: none !important;
                        }
                    }
                `}
            </style>

            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print-hidden print:hidden">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Print Preview (BURF)</h2>
                        <p className="text-xs text-slate-500">A4 Size • {totalPages} Page{totalPages > 1 ? 's' : ''} • {req.items.length} Items</p>
                    </div>
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

                {/* Printable Content - Pages */}
                <div id="printable-content" className="text-slate-900">
                    {pages.map((pageItems, pageIndex) => (
                        <div
                            key={pageIndex}
                            className="print-page p-8 print:p-0"
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
                                <div className="mb-6">
                                    {pageIndex === 0 && (
                                        <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Requested Items</h3>
                                    )}
                                    {renderItemsTable(pageItems, pageIndex === 0)}
                                </div>

                                {/* Footer only on last page */}
                                {pageIndex === totalPages - 1 && renderFooter()}

                                {/* Page number for non-last pages */}
                                {pageIndex < totalPages - 1 && (
                                    <div className="mt-4 text-center text-[10px] text-slate-400">
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

export default BURFPrintModal;
