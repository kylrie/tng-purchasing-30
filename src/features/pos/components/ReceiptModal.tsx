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
        // Simple print functionality
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-[480px] bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/40 dark:border-slate-700/50 flex flex-col max-h-[90vh] overflow-hidden zoom-in-95 duration-300">

                {/* Header */}
                <div className="relative flex justify-between items-center p-6 border-b border-slate-200/50 dark:border-slate-800/50 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <CheckCircle2 size={24} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Payment Successful</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-full transition-all duration-200 dark:hover:bg-slate-800/80 dark:hover:text-slate-300 active:scale-90"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-slate-50/50 dark:bg-black/20 scroll-smooth flex justify-center">
                    {/* The Printable Receipt Content */}
                    <div className="relative w-full max-w-sm">
                        {/* Receipt rendering wrapper for visual effect */}
                        <div className="bg-white p-6 shadow-[0_8px_30px_-5px_rgba(0,0,0,0.1)] dark:shadow-none border border-slate-200 dark:border-slate-300 text-slate-800 font-mono text-sm relative z-10 
                                      after:content-[''] after:absolute after:bottom-[-6px] after:left-0 after:right-0 after:h-[6px] 
                                      after:bg-[linear-gradient(135deg,transparent_25%,white_25%,white_50%,transparent_50%,transparent_75%,white_75%,white_100%)] after:bg-[length:12px_12px]
                                      before:content-[''] before:absolute before:top-[-6px] before:left-0 before:right-0 before:h-[6px] 
                                      before:bg-[linear-gradient(135deg,transparent_25%,white_25%,white_50%,transparent_50%,transparent_75%,white_75%,white_100%)] before:bg-[length:12px_12px] before:rotate-180">

                            <div ref={receiptRef}>
                                <div className="text-center font-bold text-xl mb-1 uppercase tracking-widest">Point of Sale</div>
                                <div className="text-center text-xs mb-5 text-slate-500">Store Location</div>

                                <div className="border-b border-dashed border-slate-300 pb-3 mb-3 space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Order:</span>
                                        <span className="font-semibold">{order.orderNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Date:</span>
                                        <span>{order.createdAt.toDate().toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Cashier:</span>
                                        <span>{order.cashierName}</span>
                                    </div>
                                </div>

                                <table className="w-full text-left mb-3 text-xs">
                                    <thead>
                                        <tr className="border-b border-dashed border-slate-300">
                                            <th className="pb-2 font-semibold">Qty</th>
                                            <th className="pb-2 font-semibold">Item</th>
                                            <th className="text-right pb-2 font-semibold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {order.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="align-top py-2 text-slate-500">{item.quantity}</td>
                                                <td className="align-top py-2 pr-2 font-medium">{item.productName}</td>
                                                <td className="align-top py-2 text-right">₱{item.subtotal.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="border-t border-dashed border-slate-300 pt-3 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Subtotal</span>
                                        <span>₱{order.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg items-center">
                                        <span>Total</span>
                                        <span>₱{order.totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-slate-300 mt-4 pt-4 space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Method</span>
                                        <span className="font-semibold">{order.paymentMethod}</span>
                                    </div>
                                    {order.amountTendered !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Tendered</span>
                                            <span>₱{order.amountTendered.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {order.changeAmount !== undefined && (
                                        <div className="flex justify-between font-bold text-sm mt-1">
                                            <span>Change</span>
                                            <span>₱{order.changeAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-center mt-8 text-xs text-slate-400 font-medium">
                                    Thank you for your business!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-slate-200/50 dark:border-slate-800/50 flex gap-3 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-xl relative z-20">
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Printer size={18} strokeWidth={2.5} />
                        Print
                    </button>
                    <button
                        onClick={onClose}
                        className="group flex-[2] py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] hover:shadow-[0_12px_28px_-6px_rgba(79,70,229,0.6)] active:scale-95 overflow-hidden relative"
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative z-10 flex items-center gap-2">
                            New Sale
                            <ChevronRight size={18} strokeWidth={3} className="transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
