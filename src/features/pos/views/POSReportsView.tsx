import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { POSReportsService, type ShiftReport } from '../services/pos-reports.service';
import { POSPrinterService, type PrinterConnectionType } from '../services/pos-printer.service';
import { Printer, RefreshCw, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../../shared/utils/currency';
import { format } from 'date-fns';

export const POSReportsView: React.FC = () => {
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
        loadReport();
    }, [currentUser?.businessId]);

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
            text += `Cashier: ${currentUser?.name || 'System'}\n`;
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

    if (isLoading && !report) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shift & Reports</h1>
                    <p className="text-slate-600 dark:text-slate-400">BIR Mandatory Reporting (End of Day)</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadReport}
                        className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => handlePrint('X-READING')}
                        disabled={isPrinting || !report}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 dark:text-indigo-300 rounded-lg font-medium transition-colors"
                    >
                        {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        Print X-Reading
                    </button>
                    <button
                        onClick={() => handlePrint('Z-READING')}
                        disabled={isPrinting || !report}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded-lg font-medium transition-colors"
                    >
                        {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        Print Z-Reading
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
            )}

            {report && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Today's Summary</h2>
                        <p className="text-sm text-slate-500">
                            {format(report.shiftStart, 'MMM dd, yyyy 00:00')} - {format(new Date(), 'HH:mm')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                        <div className="p-6 space-y-4">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Sales Overview</h3>
                            
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Gross Sales</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.grossSales)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Net Sales</span>
                                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(report.netSales)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Total Transactions</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{report.totalTransactions}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Service Charge Collected</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.serviceChargeTotal)}</span>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">BIR Breakdown</h3>
                            
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">VATable Sales</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.vatableSales)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">VAT Amount (12%)</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.vatAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">VAT Exempt Sales</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.vatExemptSales)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Zero-Rated Sales</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.zeroRatedSales)}</span>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Discounts</h3>
                            
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">SC/PWD Discounts</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(report.scPwdDiscountTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Manual / FOC Discounts</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(report.manualDiscountTotal)}</span>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Tender Types</h3>
                            
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Cash</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.cashTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">Credit / Debit Card</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.cardTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-400">E-Wallet (GCash/PayMaya)</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(report.eWalletTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
