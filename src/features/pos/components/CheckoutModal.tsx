import React, { useState } from 'react';
import { X, CreditCard, Banknote, Wallet, ArrowRight } from 'lucide-react';
import type { PaymentMethod } from '../types/pos.types';

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    onConfirmPayment: (paymentMethod: PaymentMethod, amountTendered: number) => void;
}

// QR-Operations design language (light). Payment logic is UNCHANGED — presentation only.
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
            setAmountTendered(total.toFixed(2));
        } else {
            setAmountTendered(amount.toString());
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-[500px] bg-white rounded-2xl border-2 border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b-2 border-slate-200">
                    <h2 className="text-xl font-black text-slate-900">Checkout</h2>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="Close modal"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Total due */}
                    <div className="text-center mb-6 py-6 bg-slate-50 rounded-2xl border-2 border-slate-200">
                        <p className="text-[11px] text-slate-400 uppercase tracking-widest font-black mb-2">Total Due</p>
                        <div className="text-5xl font-black text-slate-900 tabular-nums flex items-center justify-center">
                            <span className="text-2xl text-slate-400 mr-1 font-bold">₱</span>
                            {total.toFixed(2)}
                        </div>
                    </div>

                    {/* Payment methods */}
                    <div className="space-y-3 mb-6">
                        <label className="block text-[11px] uppercase tracking-wide font-black text-slate-400">Select Method</label>
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
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-colors ${isActive
                                            ? 'bg-slate-900 border-slate-900 text-white'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}
                                    >
                                        <Icon size={28} strokeWidth={2} className="mb-2" />
                                        <span className="text-[11px] tracking-wide uppercase font-black">{method.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cash specific inputs */}
                    <div className={`transition-all duration-300 overflow-hidden ${paymentMethod === 'CASH' ? 'opacity-100 max-h-[400px] mb-1' : 'opacity-0 max-h-0 m-0'}`}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] uppercase tracking-wide font-black text-slate-400 mb-2">Amount Tendered</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-slate-400 font-bold text-2xl">₱</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={amountTendered}
                                        onChange={(e) => setAmountTendered(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl text-4xl font-black text-slate-900 placeholder-slate-300 focus:outline-none focus:border-slate-400 transition-colors text-center tabular-nums"
                                        placeholder="0.00"
                                        autoFocus={paymentMethod === 'CASH'}
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
                                        className="py-3.5 px-2 bg-white hover:border-slate-400 border-2 border-slate-200 rounded-xl font-black tracking-wide text-slate-700 text-xs transition-colors active:scale-95 tabular-nums"
                                    >
                                        {quick.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer action */}
                <div className="px-6 py-4 border-t-2 border-slate-200 mt-auto">
                    <button
                        onClick={handleConfirm}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm tracking-wide uppercase rounded-xl transition-colors active:scale-[0.99]"
                    >
                        Confirm {paymentMethod === 'CASH' ? 'Payment' : paymentMethod === 'CARD' ? 'Card Terminal' : 'E-Wallet'}
                        <ArrowRight size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
