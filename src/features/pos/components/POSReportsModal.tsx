import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { POSReportsService, type ShiftReport } from '../services/pos-reports.service';
import { POSPrinterService, type PrinterConnectionType } from '../services/pos-printer.service';
import { Printer, RefreshCw, FileText, AlertCircle, Loader2, X } from 'lucide-react';
import { formatCurrency } from '../../../shared/utils/currency';
import { format } from 'date-fns';

interface POSReportsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeCashierName?: string;
}

export const POSReportsModal: React.FC<POSReportsModalProps> = ({ isOpen, onClose, activeCashierName }) => {
    const { currentUser } = useAuth();
    const [report, setReport] = useState<ShiftReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadReport = async () => {
        if (!currentUser?.businessId) return;
        setIsLoading(true);
        setError(null);
        try {
            const { start, end } = POSReportsService.getTodayRange();
            const data = await POSReportsService.generateShiftReport(currentUser.businessId, start, end);
            setReport(data);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error(err);
            setError('Failed to load shift report.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadReport();
        }
    }, [isOpen, currentUser?.businessId]);

    if (!isOpen) return null;

    const handlePrint = async (type: 'X-READING' | 'Z-READING') => {
        if (!report) return;
        setIsPrinting(true);
        setError(null);
        try {
            const savedPrinter = localStorage.getItem('pos_printer_type') as PrinterConnectionType || 'simulator';
            const savedIp = localStorage.getItem('pos_printer_ip') || '';

            if (savedPrinter === 'bluetooth') {
                await POSPrinterService.connectBluetooth();
            }

            let text = `=== ${type} ===\n`;
            text += `Date: ${format(new Date(), 'MM/dd/yyyy HH:mm')}\n`;
            text += `Terminal: POS-01\n`;
            text += `Cashier: ${activeCashierName || currentUser?.name || 'System'}\n`;
            text += `--------------------------------\n`;
            text += `Gross Sales:        ${formatCurrency(report.grossSales)}\n`;
            text += `Net Sales:          ${formatCurrency(report.netSales)}\n`;
            text += `--------------------------------\n`;
            text += `VATable Sales:      ${formatCurrency(report.vatableSales)}\n`;
            text += `VAT Amount (12%):   ${formatCurrency(report.vatAmount)}\n`;
            text += `VAT Exempt Sales:   ${formatCurrency(report.vatExemptSales)}\n`;
            text += `Zero-Rated Sales:   ${formatCurrency(report.zeroRatedSales)}\n`;
            text += `--------------------------------\n`;
            text += `Service Charge:     ${formatCurrency(report.serviceChargeTotal)}\n`;
            text += `SC/PWD Discount:    ${formatCurrency(report.scPwdDiscountTotal)}\n`;
            text += `Manual Discount:    ${formatCurrency(report.manualDiscountTotal)}\n`;
            text += `--------------------------------\n`;
            text += `Cash Total:         ${formatCurrency(report.cashTotal)}\n`;
            text += `Card Total:         ${formatCurrency(report.cardTotal)}\n`;
            text += `E-Wallet Total:     ${formatCurrency(report.eWalletTotal)}\n`;
            text += `--------------------------------\n`;
            text += `Total Transactions: ${report.totalTransactions}\n`;
            text += `\n\n\n`;

            const payload = POSPrinterService.generateReceiptPayload(text);
            await POSPrinterService.print({ type: savedPrinter, ipAddress: savedIp }, payload);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to print report.');
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border-2 border-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-200 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Shift &amp; Reports</h2>
                        <p className="text-sm text-slate-500 font-semibold">BIR Mandatory Reporting (End of Day)</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadReport}
                            disabled={isLoading}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-slate-200 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto bg-slate-50">
                    {error && (
                        <div className="flex items-center gap-2 p-3 mb-5 text-sm font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-xl">
                            <AlertCircle size={18} />
                            <p>{error}</p>
                        </div>
                    )}

                    {isLoading && !report ? (
                        <div className="flex items-center justify-center min-h-[300px]">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
                        </div>
                    ) : report ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-5">
                                <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
                                    <h3 className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-wide">Sales Summary</h3>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-500 font-semibold">Gross Sales</span>
                                            <span className="text-lg font-black text-slate-900 tabular-nums">{formatCurrency(report.grossSales)}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-500 font-semibold">Net Sales</span>
                                            <span className="text-2xl font-black text-emerald-600 tabular-nums">{formatCurrency(report.netSales)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
                                    <h3 className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-wide">VAT Breakdown</h3>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-semibold">VATable Sales</span>
                                            <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(report.vatableSales)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-semibold">VAT Amount (12%)</span>
                                            <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(report.vatAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-semibold">VAT Exempt Sales</span>
                                            <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(report.vatExemptSales)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-semibold">Zero-Rated Sales</span>
                                            <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(report.zeroRatedSales)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
                                    <h3 className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-wide">Tender Breakdown</h3>

                                    <div className="space-y-3 mb-5">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-semibold">Cash</span>
                                            <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(report.cashTotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-semibold">Card</span>
                                            <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(report.cardTotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-semibold">E-Wallet</span>
                                            <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(report.eWalletTotal)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t-2 border-slate-100 flex justify-between items-center">
                                        <span className="text-sm text-slate-500 font-semibold">Total Transactions</span>
                                        <span className="text-lg font-black text-slate-900 tabular-nums">{report.totalTransactions}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handlePrint('X-READING')}
                                        disabled={isPrinting}
                                        className="flex flex-col items-center justify-center p-4 bg-white hover:border-slate-400 text-slate-900 border-2 border-slate-200 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        <FileText className="w-8 h-8 mb-2" />
                                        <span className="font-black">Print X-Reading</span>
                                        <span className="text-xs text-slate-500 font-semibold mt-1">Mid-day Snapshot</span>
                                    </button>

                                    <button
                                        onClick={() => handlePrint('Z-READING')}
                                        disabled={isPrinting}
                                        className="flex flex-col items-center justify-center p-4 bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        <Printer className="w-8 h-8 mb-2" />
                                        <span className="font-black">Print Z-Reading</span>
                                        <span className="text-xs text-slate-300 font-semibold mt-1">End of Day Close</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
export default POSReportsModal;
