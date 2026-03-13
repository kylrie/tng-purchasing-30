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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-[480px] bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/40 dark:border-slate-700/50 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">

                {/* Visual Header Decoration */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

                {/* Header */}
                <div className="relative flex justify-between items-center p-6 pb-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight text-glow">Checkout</h2>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-full transition-all duration-200 dark:hover:bg-slate-800/80 dark:hover:text-slate-300 active:scale-90"
                        aria-label="Close modal"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="relative p-6 pt-2 overflow-y-auto scroll-smooth">
                    {/* Amount to pay */}
                    <div className="text-center mb-8 py-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-slate-100/50 dark:border-slate-800/50">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] font-bold mb-2">Amount Due</p>
                        <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter drop-shadow-sm">
                            ₱{total.toFixed(2)}
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-3 mb-8">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Select Payment Method</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'CASH', icon: Banknote, label: 'Cash' },
                                { id: 'CARD', icon: CreditCard, label: 'Card' },
                                { id: 'E_WALLET', icon: Wallet, label: 'E-Wallet' }
                            ].map((method) => {
                                const Icon = method.icon;
                                const isActive = paymentMethod === method.id;
                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                                        className={`group flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 active:scale-95 ${isActive
                                            ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.25)]'
                                            : 'border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-800/30 text-slate-500 hover:border-indigo-300 dark:hover:border-indigo-600/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        <Icon
                                            size={28}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={`mb-2.5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                                        />
                                        <span className={`text-sm tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>{method.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cash specific inputs */}
                    {paymentMethod === 'CASH' && (
                        <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Amount Tendered</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <span className="text-slate-400 group-focus-within:text-indigo-500 transition-colors font-bold text-xl drop-shadow-sm">₱</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={amountTendered}
                                        onChange={(e) => setAmountTendered(e.target.value)}
                                        className="w-full pl-12 pr-5 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-2xl font-black text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Quick amounts */}
                            <div className="grid grid-cols-4 gap-2.5">
                                {[
                                    { label: 'Exact', value: -1 },
                                    { label: `₱${Math.ceil(total / 100) * 100}`, value: Math.ceil(total / 100) * 100 },
                                    { label: '₱500', value: 500 },
                                    { label: '₱1000', value: 1000 }
                                ].map((quick, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setQuickAmount(quick.value)}
                                        className="py-3 px-1 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/80 dark:hover:bg-indigo-500/20 border border-slate-200/80 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm transition-all duration-200 active:scale-95"
                                    >
                                        {quick.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-6 pt-4 mt-auto">
                    <button
                        onClick={handleConfirm}
                        className="group relative w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-2xl transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] hover:shadow-[0_12px_28px_-6px_rgba(79,70,229,0.6)] active:scale-[0.98] overflow-hidden"
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Confirm {paymentMethod === 'CASH' ? 'Payment' : paymentMethod === 'CARD' ? 'Card Terminal' : 'E-Wallet'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
