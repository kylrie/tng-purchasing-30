import React, { useState } from 'react';
import { X, CreditCard, Banknote, Wallet } from 'lucide-react';
import type { PaymentMethod } from '../types/pos.types';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    onConfirmPayment: (paymentMethod: PaymentMethod, amountTendered: number) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
    isOpen,
    onClose,
    total,
    onConfirmPayment
}) => {
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
    const [amountTendered, setAmountTendered] = useState<string>('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        const tendered = parseFloat(amountTendered) || 0;
        if (paymentMethod === 'CASH' && tendered < total) {
            alert('Amount tendered must be at least the total amount.');
            return;
        }

        onConfirmPayment(paymentMethod, paymentMethod === 'CASH' ? tendered : total);

        // Reset state for next time
        setPaymentMethod('CASH');
        setAmountTendered('');
    };

    const setQuickAmount = (amount: number) => {
        if (amount === -1) { // Exact amount
            setAmountTendered(total.toString());
        } else {
            setAmountTendered(amount.toString());
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Checkout</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-300">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Amount to pay */}
                    <div className="text-center mb-8">
                        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Amount Due</p>
                        <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400">
                            ₱{total.toFixed(2)}
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        <button
                            onClick={() => setPaymentMethod('CASH')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${paymentMethod === 'CASH'
                                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Banknote size={28} className="mb-2" />
                            <span className="font-semibold">Cash</span>
                        </button>
                        <button
                            onClick={() => setPaymentMethod('CARD')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${paymentMethod === 'CARD'
                                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <CreditCard size={28} className="mb-2" />
                            <span className="font-semibold">Card</span>
                        </button>
                        <button
                            onClick={() => setPaymentMethod('E_WALLET')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${paymentMethod === 'E_WALLET'
                                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Wallet size={28} className="mb-2" />
                            <span className="font-semibold">E-Wallet</span>
                        </button>
                    </div>

                    {/* Cash specific inputs */}
                    {paymentMethod === 'CASH' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Amount Tendered</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-slate-500 font-semibold text-lg">₱</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={amountTendered}
                                        onChange={(e) => setAmountTendered(e.target.value)}
                                        className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border box-border border-slate-200 dark:border-slate-700 rounded-xl text-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Quick amounts */}
                            <div className="grid grid-cols-4 gap-2">
                                <button onClick={() => setQuickAmount(-1)} className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 text-sm">Exact</button>
                                <button onClick={() => setQuickAmount(Math.ceil(total / 100) * 100)} className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 text-sm">₱{Math.ceil(total / 100) * 100}</button>
                                <button onClick={() => setQuickAmount(500)} className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 text-sm">₱500</button>
                                <button onClick={() => setQuickAmount(1000)} className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 text-sm">₱1000</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
                    >
                        Confirm Payment
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
