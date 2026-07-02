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

    const handlePrint = () => {
        const printContent = receiptRef.current?.innerHTML;
        if (printContent) {
            const printWindow = window.open('', '', 'width=400,height=600');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Receipt ${order.orderNumber}</title>
                            <style>
                                body { font-family: monospace; padding: 20px; font-size: 14px; line-height: 1.5; color: #000; }
                                .text-center { text-align: center; }
                                .text-right { text-align: right; }
                                .text-left { text-align: left; }
                                .flex { display: flex; justify-content: space-between; }
                                .bold { font-weight: bold; }
                                .border-b { border-bottom: 1px dashed #000; margin-bottom: 10px; padding-bottom: 10px; }
                                .border-t { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; }
                                .mt-4 { margin-top: 20px; }
                                .text-sm { font-size: 12px; }
                                .text-xl { font-size: 18px; }
                                table { w-full: 100%; border-collapse: collapse; width: 100%; }
                                th, td { padding: 4px 0; }
                            </style>
                        </head>
                        <body>
                            ${printContent}
                            <script>
                                window.onload = function() { window.print(); window.close(); }
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 selection:bg-indigo-500/30">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#020203]/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-500"
                onClick={onClose}
            ></div>

            {/* Premium Modal Container */}
            <div className="relative w-full max-w-[480px] bg-[#0a0a0f]/80 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/[0.08] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]">

                {/* Decorative glowing orbs */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/10 blur-[50px] pointer-events-none"></div>

                {/* Top Inner Light Border */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                {/* Header */}
                <div className="relative flex justify-between items-center p-8 pb-6 bg-transparent z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <CheckCircle2 size={24} strokeWidth={2.5} className="relative z-10 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-widest uppercase">Transaction Complete</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-slate-500 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.05] rounded-full transition-all duration-300 active:scale-90"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto scroll-smooth flex justify-center relative z-10">
                    {/* The Printable Receipt Content */}
                    <div className="relative w-full max-w-sm animate-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both ease-[cubic-bezier(0.23,1,0.32,1)]">
                        {/* Receipt rendering wrapper for visual effect */}
                        <div className="bg-[#fcfcfc] text-black p-8 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border border-white/20 text-sm relative z-10 
                                      after:content-[''] after:absolute after:bottom-[-8px] after:left-0 after:right-0 after:h-[8px] 
                                      after:bg-[linear-gradient(135deg,transparent_25%,#fcfcfc_25%,#fcfcfc_50%,transparent_50%,transparent_75%,#fcfcfc_75%,#fcfcfc_100%)] after:bg-[length:16px_16px]
                                      before:content-[''] before:absolute before:top-[-8px] before:left-0 before:right-0 before:h-[8px] 
                                      before:bg-[linear-gradient(135deg,transparent_25%,#fcfcfc_25%,#fcfcfc_50%,transparent_50%,transparent_75%,#fcfcfc_75%,#fcfcfc_100%)] before:bg-[length:16px_16px] before:rotate-180">

                            {/* Inner receipt texture overlay */}
                            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/paper.png')] pointer-events-none mix-blend-multiply"></div>

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
                                        <span className="font-medium text-black">{order.createdAt.toDate().toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Cashier:</span>
                                        <span className="font-bold text-black">{order.cashierName}</span>
                                    </div>
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
                                    {(order.discountAmount || 0) > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-[#666]">
                                            <span className="uppercase tracking-widest">Total Discount</span>
                                            <span>- ₱{order.discountAmount!.toFixed(2)}</span>
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
                <div className="p-8 pt-6 border-t border-white/[0.05] flex gap-4 relative z-20 bg-transparent">
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-4 px-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold tracking-widest uppercase text-[11px] rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                    >
                        <Printer size={16} strokeWidth={2.5} />
                        Print
                    </button>
                    <button
                        onClick={onClose}
                        className="group flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 text-white font-bold tracking-[0.2em] uppercase text-xs rounded-2xl transition-all duration-500 flex items-center justify-center gap-2 shadow-[0_8px_30px_-10px_rgba(99,102,241,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-95 overflow-hidden relative"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                        <span className="relative z-10 flex items-center gap-3">
                            New Order
                            <ChevronRight size={18} strokeWidth={3} className="transition-transform duration-500 ease-out group-hover:translate-x-2" />
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
