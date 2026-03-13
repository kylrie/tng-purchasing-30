import React, { useRef } from 'react';
import { X, CheckCircle, Printer } from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle size={24} />
                        <h2 className="text-xl font-bold">Payment Successful</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-300">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-800/50">
                    {/* The Printable Receipt Content */}
                    <div ref={receiptRef} className="bg-white p-6 shadow-sm border border-slate-200 text-slate-800 max-w-sm mx-auto font-mono text-sm shadow">
                        <div className="text-center font-bold text-xl mb-1">Point of Sale</div>
                        <div className="text-center text-sm mb-4">Store Location</div>

                        <div className="border-b">
                            <div className="flex">
                                <span>Order:</span>
                                <span>{order.orderNumber}</span>
                            </div>
                            <div className="flex">
                                <span>Date:</span>
                                <span>{order.createdAt.toDate().toLocaleString()}</span>
                            </div>
                            <div className="flex">
                                <span>Cashier:</span>
                                <span>{order.cashierName}</span>
                            </div>
                        </div>

                        <table className="w-full text-left mb-2">
                            <thead>
                                <tr className="border-b">
                                    <th>Qty</th>
                                    <th>Item</th>
                                    <th className="text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="align-top py-1">{item.quantity}</td>
                                        <td className="align-top py-1 pr-2">{item.productName}</td>
                                        <td className="align-top py-1 text-right">₱{item.subtotal.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-t space-y-1">
                            <div className="flex">
                                <span>Subtotal</span>
                                <span>₱{order.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex font-bold text-lg mt-2">
                                <span>Total</span>
                                <span>₱{order.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="border-t mt-2 pt-2 space-y-1">
                            <div className="flex">
                                <span>Method</span>
                                <span>{order.paymentMethod}</span>
                            </div>
                            {order.amountTendered !== undefined && (
                                <div className="flex">
                                    <span>Tendered</span>
                                    <span>₱{order.amountTendered.toFixed(2)}</span>
                                </div>
                            )}
                            {order.changeAmount !== undefined && (
                                <div className="flex font-bold">
                                    <span>Change</span>
                                    <span>₱{order.changeAmount.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <div className="text-center mt-8 text-xs text-slate-500">
                            Thank you for your business!
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Printer size={20} />
                        Print Receipt
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
                    >
                        New Sale
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
