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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-700 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white">Shift & Reports</h2>
                        <p className="text-sm text-slate-400">BIR Mandatory Reporting (End of Day)</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadReport}
                            disabled={isLoading}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2 p-4 mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <AlertCircle size={18} />
                            <p>{error}</p>
                        </div>
                    )}

                    {isLoading && !report ? (
                        <div className="flex items-center justify-center min-h-[300px]">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : report ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-6">
                                    <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Sales Summary</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-300">Gross Sales</span>
                                            <span className="text-lg font-medium text-white">{formatCurrency(report.grossSales)}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-slate-300">Net Sales</span>
                                            <span className="text-2xl font-bold text-emerald-400">{formatCurrency(report.netSales)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-6">
                                    <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">VAT Breakdown</h3>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">VATable Sales</span>
                                            <span className="text-white font-medium">{formatCurrency(report.vatableSales)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">VAT Amount (12%)</span>
                                            <span className="text-white font-medium">{formatCurrency(report.vatAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">VAT Exempt Sales</span>
                                            <span className="text-white font-medium">{formatCurrency(report.vatExemptSales)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Zero-Rated Sales</span>
                                            <span className="text-white font-medium">{formatCurrency(report.zeroRatedSales)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-6">
                                    <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Tender Breakdown</h3>
                                    
                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Cash</span>
                                            <span className="text-white font-medium">{formatCurrency(report.cashTotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Card</span>
                                            <span className="text-white font-medium">{formatCurrency(report.cardTotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">E-Wallet</span>
                                            <span className="text-white font-medium">{formatCurrency(report.eWalletTotal)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                                        <span className="text-sm text-slate-400">Total Transactions</span>
                                        <span className="text-lg font-bold text-white">{report.totalTransactions}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handlePrint('X-READING')}
                                        disabled={isPrinting}
                                        className="flex flex-col items-center justify-center p-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl transition-all disabled:opacity-50"
                                    >
                                        <FileText className="w-8 h-8 mb-2" />
                                        <span className="font-semibold">Print X-Reading</span>
                                        <span className="text-xs text-indigo-400/70 mt-1">Mid-day Snapshot</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => handlePrint('Z-READING')}
                                        disabled={isPrinting}
                                        className="flex flex-col items-center justify-center p-4 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-2xl transition-all disabled:opacity-50"
                                    >
                                        <Printer className="w-8 h-8 mb-2" />
                                        <span className="font-semibold">Print Z-Reading</span>
                                        <span className="text-xs text-slate-500 mt-1">End of Day Close</span>
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
