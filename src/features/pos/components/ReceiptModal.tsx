import React, { useRef } from 'react';
import { X, CheckCircle2, Printer, ChevronRight } from 'lucide-react';
import type { POSOrder } from '../types/pos.types';

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: POSOrder | null;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({
    isOpen,
    onClose,
    order
}) => {
    const receiptRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !order) return null;

    const handlePrint = async () => {
        try {
            const savedPrinter = localStorage.getItem('pos_printer_type') as import('../services/pos-printer.service').PrinterConnectionType || 'simulator';
            const savedIp = localStorage.getItem('pos_printer_ip') || '192.168.1.100';
            
            const config = { type: savedPrinter, ipAddress: savedIp };
            const { POSPrinterService } = await import('../services/pos-printer.service');
            
            if (savedPrinter === 'bluetooth') {
                await POSPrinterService.connectBluetooth();
            }
            
            const text = POSPrinterService.formatOrderReceipt(order);
            const payload = POSPrinterService.generateReceiptPayload(text);
            await POSPrinterService.print(config, payload);
            
            // Optionally close the modal after printing, or show a toast
            // toast.success('Printed successfully');
        } catch (err: any) {
            console.error('Print failed:', err);
            alert('Print failed: ' + (err.message || 'Unknown error'));
        }
    };

    const manualDiscountReasons = Array.from(new Set(
        order?.items
            .filter(item => !item.isDiscounted && (item.discountRate || 0) > 0 && item.discountReason)
            .map(item => item.discountReason?.trim())
            .filter(Boolean) || []
    ));

    const itemDiscountLabel = manualDiscountReasons.length > 0 
        ? manualDiscountReasons.join(', ') + ' Discount'
        : 'Item Discount';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-[480px] bg-white rounded-2xl border-2 border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b-2 border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 size={22} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-lg font-black text-slate-900">Transaction Complete</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto flex justify-center bg-slate-50">
                    {/* The Printable Receipt Content — white "paper" preview of the printed receipt */}
                    <div className="relative w-full max-w-sm">
                        {/* Receipt paper */}
                        <div className="bg-[#fcfcfc] text-black p-6 rounded-lg border-2 border-slate-200 shadow-sm text-sm relative">
                            <div ref={receiptRef} className="relative z-10 font-mono">
                                <div className="text-center font-bold text-2xl mb-1 uppercase tracking-widest text-[#1a1a1a]">Point of Sale</div>
                                <div className="text-center text-xs mb-6 text-[#666] tracking-widest uppercase">Store Location</div>

                                <div className="border-b-[1.5px] border-dashed border-[#ccc] pb-4 mb-4 space-y-1.5 text-xs text-[#444]">
                                    <div className="flex justify-between">
                                        <span>Order:</span>
                                        <span className="font-bold text-black">{order.orderNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Date:</span>
                                        <span className="font-medium text-black">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt as any).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Cashier:</span>
                                        <span className="font-bold text-black">{order.cashierName}</span>
                                    </div>
                                    {order.tableId && order.tableName && (
                                        <div className="flex justify-between">
                                            <span>Table:</span>
                                            <span className="font-bold text-black">{order.tableName}</span>
                                        </div>
                                    )}
                                </div>

                                <table className="w-full text-left mb-4 text-xs text-[#222]">
                                    <thead>
                                        <tr className="border-b-[1.5px] border-dashed border-[#ccc]">
                                            <th className="pb-2 font-bold uppercase tracking-wider text-[#666]">Qty</th>
                                            <th className="pb-2 font-bold uppercase tracking-wider text-[#666]">Item</th>
                                            <th className="text-right pb-2 font-bold uppercase tracking-wider text-[#666]">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm font-medium">
                                        {order.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="align-top py-2.5 text-[#666]">{item.quantity}</td>
                                                <td className="align-top py-2.5 pr-2 max-w-[150px] truncate">{item.productName}</td>
                                                <td className="align-top py-2.5 text-right font-bold">₱{item.subtotal.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="border-t-[1.5px] border-dashed border-[#ccc] pt-4 space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-[#666]">
                                        <span className="uppercase tracking-widest">Gross Subtotal</span>
                                        <span>₱{(order.subtotal + (order.discountAmount || 0)).toFixed(2)}</span>
                                    </div>
                                    {(order.scPwdDiscountAmount || 0) > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">SC/PWD Discount</span>
                                            <span>- ₱{order.scPwdDiscountAmount!.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(order.manualItemDiscountAmount || 0) > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">{itemDiscountLabel}</span>
                                            <span>- ₱{order.manualItemDiscountAmount!.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {((order.discountAmount || 0) - (order.scPwdDiscountAmount || 0) - (order.manualItemDiscountAmount || 0)) > 0.01 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">Custom Discount</span>
                                            <span>- ₱{((order.discountAmount || 0) - (order.scPwdDiscountAmount || 0) - (order.manualItemDiscountAmount || 0)).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xs font-bold text-[#666]">
                                        <span className="uppercase tracking-widest">Net Subtotal</span>
                                        <span>₱{order.subtotal.toFixed(2)}</span>
                                    </div>
                                    {(order.vatableSales || 0) > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">Vatable Sales</span>
                                            <span>₱{order.vatableSales!.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(order.vatExemptSales || 0) > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">VAT-Exempt Sales</span>
                                            <span>₱{order.vatExemptSales!.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(order.taxAmount || 0) > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">VAT Amount (12%)</span>
                                            <span>₱{order.taxAmount!.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(order.serviceChargeAmount || 0) > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">Service Charge</span>
                                            <span>₱{order.serviceChargeAmount!.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-black text-xl items-center py-2 border-t-[1px] border-dashed border-[#ccc] mt-2 pt-2">
                                        <span className="uppercase tracking-widest">Total</span>
                                        <span>₱{order.totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="border-t-[1.5px] border-dashed border-[#ccc] mt-4 pt-4 space-y-2 text-xs text-[#444]">
                                    <div className="flex justify-between">
                                        <span className="uppercase tracking-widest font-bold text-[#666]">Method</span>
                                        <span className="font-bold text-black">{order.paymentMethod}</span>
                                    </div>
                                    {order.amountTendered !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="uppercase tracking-widest font-bold text-[#666]">Tendered</span>
                                            <span className="font-bold text-black">₱{order.amountTendered.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {order.changeAmount !== undefined && (
                                        <div className="flex justify-between font-bold text-sm mt-2 text-black bg-[#f0f0f0] p-2 rounded relative -mx-2 px-2">
                                            <span className="uppercase tracking-widest">Change</span>
                                            <span>₱{order.changeAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-center mt-10 mb-2 text-xs text-[#888] font-bold uppercase tracking-[0.2em]">
                                    Thank you for your business!
                                </div>
                                {/* Fake barcode at bottom for aesthetic */}
                                <div className="h-6 w-3/4 mx-auto mt-4 mix-blend-multiply opacity-50 bg-[repeating-linear-gradient(to_right,black,black_2px,transparent_2px,transparent_4px,black_4px,black_5px,transparent_5px,transparent_8px,black_8px,black_12px,transparent_12px,transparent_14px)]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="px-6 py-4 border-t-2 border-slate-200 flex gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-3.5 px-4 bg-white hover:border-slate-400 border-2 border-slate-200 text-slate-700 font-black tracking-wide uppercase text-xs rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Printer size={16} strokeWidth={2.5} />
                        Print
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-[2] py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black tracking-wide uppercase text-xs rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95"
                    >
                        New Order
                        <ChevronRight size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
