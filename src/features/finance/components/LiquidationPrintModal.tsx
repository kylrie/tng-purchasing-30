import React from 'react';
import { X, Printer, Link as LinkIcon } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';

interface LiquidationPrintModalProps {
    req: Requisition;
    onClose: () => void;
    business?: Business;
    requester?: User;
}

const LiquidationPrintModal: React.FC<LiquidationPrintModalProps> = ({ req, onClose, business, requester }) => {

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
                <title>Liquidation Report - ${req.id}</title>
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
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                    th { background-color: #f1f5f9; font-weight: bold; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-bold { font-weight: bold; }
                    .mb-2 { margin-bottom: 8px; }
                    .mb-4 { margin-bottom: 16px; }
                    .mb-8 { margin-bottom: 32px; }
                    .mt-12 { margin-top: 48px; }
                    .border-b { border-bottom: 1px solid #e2e8f0; }
                    .border-b-2 { border-bottom: 2px solid #1e293b; }
                    .pb-4 { padding-bottom: 16px; }
                    .grid { display: grid; }
                    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
                    .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
                    .gap-8 { gap: 32px; }
                    .gap-2 { gap: 8px; }
                    .text-sm { font-size: 14px; }
                    .text-xs { font-size: 12px; }
                    .text-2xl { font-size: 24px; }
                    .uppercase { text-transform: uppercase; }
                    .text-green-700 { color: #15803d; }
                    .text-red-700 { color: #b91c1c; }
                    .text-purple-700 { color: #7c3aed; }
                    .bg-slate-50 { background-color: #f8fafc; }
                    .bg-purple-50 { background-color: #faf5ff; }
                    .border-purple-300 { border-color: #d8b4fe; }
                    .rounded { border-radius: 4px; }
                    .p-3, .p-4 { padding: 12px; }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };

        // Fallback for browsers that don't fire onload
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    };

    const liquidation = req.liquidationDetails;
    if (!liquidation) return null; // Safety guard

    const cashAdvance = req.totalAmount || 0;
    const totalActual = liquidation.totalActualAmount || 0;
    const difference = cashAdvance - totalActual;
    const isRefund = difference > 0;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 text-slate-900">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

                {/* Modal Header - Hidden when printing */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between print:hidden print-hidden">
                    <h2 className="text-lg font-bold text-slate-800">Liquidation Report Preview</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors"
                        >
                            <Printer size={18} /> Print / Save PDF
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
                    <div className="max-w-3xl mx-auto print:max-w-none print-page">

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

                        {/* Attachment Link */}
                        {liquidation.attachmentLink && (
                            <div className="mb-8 p-3 border border-slate-200 bg-slate-50 rounded text-sm print:border-slate-800 print:bg-transparent">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-700">Supporting Documents:</span>
                                    <a
                                        href={liquidation.attachmentLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline flex items-center gap-1 print:text-black print:no-underline"
                                    >
                                        <LinkIcon size={14} className="print:hidden" />
                                        {liquidation.attachmentLink}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Expense Breakdown Table - New Format Only */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Expense Breakdown</h3>
                            <table className="w-full text-[9px] border-collapse border border-slate-300">
                                <thead className="bg-slate-100 print:bg-slate-100">
                                    <tr>
                                        <th className="border border-slate-300 px-2 py-1 text-left text-slate-800 font-bold">Date</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left text-slate-800 font-bold">Vendor/Payee</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left text-slate-800 font-bold">TIN</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left text-slate-800 font-bold">OR No.</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left text-slate-800 font-bold">COA</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left text-slate-800 font-bold">Description</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left text-slate-800 font-bold">BU</th>
                                        <th className="border border-slate-300 px-2 py-1 text-right text-slate-800 font-bold w-16">VAT</th>
                                        <th className="border border-slate-300 px-2 py-1 text-right text-slate-800 font-bold w-16">EWT</th>
                                        <th className="border border-slate-300 px-2 py-1 text-right text-slate-800 font-bold w-20">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {((liquidation.items as any[]) || []).map((item: any, index: number) => {
                                        const isShared = item.buName?.toUpperCase().includes('ATHOUSANDCONCEPTS') && item.buName?.toUpperCase().includes('CORP');
                                        return (
                                            <tr key={item.id || index}>
                                                <td className="border border-slate-300 px-2 py-1 text-slate-900">
                                                    {item.date ? new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '-'}
                                                </td>
                                                <td className="border border-slate-300 px-2 py-1 text-slate-900 font-medium">{item.vendorName || '-'}</td>
                                                <td className="border border-slate-300 px-2 py-1 text-slate-900">{item.tin || '-'}</td>
                                                <td className="border border-slate-300 px-2 py-1 text-slate-900">{item.orNo || '-'}</td>
                                                <td className="border border-slate-300 px-2 py-1 text-slate-900">{item.coa || '-'}</td>
                                                <td className="border border-slate-300 px-2 py-1 text-slate-900">{item.description || '-'}</td>
                                                <td className="border border-slate-300 px-2 py-1 text-slate-900">
                                                    {item.buName || '-'}
                                                    {isShared && <span className="ml-1 text-purple-700 font-bold">[SHARE]</span>}
                                                </td>
                                                <td className="border border-slate-300 px-2 py-1 text-right text-slate-900">
                                                    {(item.vat || 0) > 0 ? `₱${item.vat.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="border border-slate-300 px-2 py-1 text-right text-slate-900">
                                                    {(item.ewt || 0) > 0 ? `₱${item.ewt.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="border border-slate-300 px-2 py-1 text-right font-medium text-slate-900">
                                                    ₱{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold">
                                    <tr>
                                        <td colSpan={7} className="border border-slate-300 px-2 py-1 text-right text-slate-900">Totals</td>
                                        <td className="border border-slate-300 px-2 py-1 text-right text-slate-900">
                                            ₱{((liquidation.items as any[]) || []).reduce((sum: number, i: any) => sum + (i.vat || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="border border-slate-300 px-2 py-1 text-right text-slate-900">
                                            ₱{((liquidation.items as any[]) || []).reduce((sum: number, i: any) => sum + (i.ewt || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="border border-slate-300 px-2 py-1 text-right text-slate-900">
                                            ₱{totalActual?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* BU Sharing Breakdown - Shows if any items have SHARE flag */}
                        {(() => {
                            const items = (liquidation.items as any[]) || [];
                            const sharedItems = items.filter((item: any) =>
                                item.buName?.toUpperCase().includes('ATHOUSANDCONCEPTS') && item.buName?.toUpperCase().includes('CORP')
                            );
                            if (sharedItems.length === 0) return null;

                            const totalShared = sharedItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

                            return (
                                <div className="mb-8 border border-purple-300 bg-purple-50 p-4 rounded print:bg-purple-50">
                                    <h3 className="text-sm font-bold text-purple-900 uppercase mb-2">BU Sharing Summary</h3>
                                    <table className="w-full text-xs border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className="py-1 text-purple-800">Total Shared Amount:</td>
                                                <td className="py-1 text-right font-bold text-purple-900">₱{totalShared.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                            <tr>
                                                <td className="py-1 text-purple-800">Number of Shared Items:</td>
                                                <td className="py-1 text-right font-bold text-purple-900">{sharedItems.length}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div className="mt-2 pt-2 border-t border-purple-200">
                                        <p className="text-[10px] text-purple-700">Items marked with [SHARE] will be distributed across all business units.</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Summary Table */}
                        <div className="mb-12 w-1/2 ml-auto">
                            <table className="w-full text-sm border border-slate-300">
                                <tbody>
                                    <tr>
                                        <td className="border border-slate-300 px-3 py-2 font-semibold bg-slate-50 text-slate-900">Total Cash Advance</td>
                                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">₱{cashAdvance?.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 px-3 py-2 font-semibold bg-slate-50 text-slate-900">Total Actual Expenses</td>
                                        <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">₱{totalActual?.toLocaleString()}</td>
                                    </tr>
                                    <tr className={isRefund ? 'text-green-700' : 'text-red-700'}>
                                        <td className="border border-slate-300 px-3 py-2 font-bold bg-slate-50 text-inherit">
                                            {isRefund ? 'Amount to Return (Refund)' : 'Amount to Reimburse'}
                                        </td>
                                        <td className="border border-slate-300 px-3 py-2 text-right font-bold text-inherit">
                                            ₱{Math.abs(difference)?.toLocaleString()}
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
                            <span>Generated via TES (TNG ERP System)</span>
                            <span>Printed: {new Date()?.toLocaleString()}</span>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiquidationPrintModal;
