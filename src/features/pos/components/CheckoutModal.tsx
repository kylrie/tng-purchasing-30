import React, { useState } from 'react';
import { X, CreditCard, Banknote, Wallet, Sparkles } from 'lucide-react';
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
            setAmountTendered(total.toFixed(2));
        } else {
            setAmountTendered(amount.toString());
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
            <div className="relative w-full max-w-[500px] bg-[#0a0a0f]/80 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/[0.08] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]">

                {/* Decorative glowing orbs */}
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/20 rounded-full blur-[60px] pointer-events-none"></div>
                <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple-500/20 rounded-full blur-[60px] pointer-events-none"></div>

                {/* Top Inner Light Border */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                {/* Header */}
                <div className="relative flex justify-between items-center p-8 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                            <Sparkles size={20} className="text-indigo-400" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-widest uppercase">Checkout</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-slate-500 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.05] rounded-full transition-all duration-300 active:scale-90"
                        aria-label="Close modal"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="relative p-8 pt-2 overflow-y-auto scroll-smooth z-10">
                    {/* Glowing Amount Display */}
                    <div className="relative text-center mb-10 py-8 bg-black/40 rounded-[2rem] border border-white/[0.05] shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <p className="text-[11px] text-slate-400 uppercase tracking-[0.3em] font-bold mb-3 relative z-10">Total Due</p>
                        <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] relative z-10 flex items-center justify-center">
                            <span className="text-3xl text-indigo-400/50 mr-2 font-bold transform -translate-y-2">₱</span>
                            {total.toFixed(2)}
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="space-y-4 mb-10">
                        <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-slate-400 ml-2">Select Method</label>
                        <div className="grid grid-cols-3 gap-4">
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
                                        className={`group relative flex flex-col items-center justify-center p-5 rounded-[1.5rem] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden ${isActive
                                            ? 'bg-indigo-500/10 border-indigo-500/50 text-white shadow-[0_0_30px_-10px_rgba(99,102,241,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] scale-[1.02]'
                                            : 'bg-white/[0.02] border-white/[0.05] text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] hover:border-white/[0.1] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]'
                                            } border border-solid`}
                                    >
                                        {isActive && (
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent"></div>
                                        )}
                                        <Icon
                                            size={32}
                                            strokeWidth={isActive ? 2 : 1.5}
                                            className={`mb-3 relative z-10 transition-all duration-500 ${isActive ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'group-hover:scale-110'}`}
                                        />
                                        <span className={`text-[10px] tracking-[0.1em] uppercase relative z-10 ${isActive ? 'font-bold text-indigo-100' : 'font-bold'}`}>{method.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cash specific inputs */}
                    <div className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden ${paymentMethod === 'CASH' ? 'opacity-100 max-h-[400px] mb-2' : 'opacity-0 max-h-0 m-0'}`}>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-slate-400 ml-2 mb-3">Amount Tendered</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-10">
                                        <span className="text-slate-500 group-focus-within:text-indigo-400 transition-colors font-bold text-2xl">₱</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={amountTendered}
                                        onChange={(e) => setAmountTendered(e.target.value)}
                                        className="w-full pl-14 pr-6 py-6 bg-black/50 border border-white/[0.1] rounded-[1.5rem] text-4xl font-black text-white placeholder-slate-700 focus:outline-none focus:bg-black/80 focus:border-indigo-500/50 transition-all duration-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] text-center tracking-tighter"
                                        placeholder="0.00"
                                        autoFocus={paymentMethod === 'CASH'}
                                    />
                                    {/* Focus Outline Glow */}
                                    <div className="absolute -inset-0.5 bg-indigo-500/30 rounded-[1.6rem] blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 -z-10"></div>
                                </div>
                            </div>

                            {/* Quick amounts */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Exact', value: -1 },
                                    { label: `₱${Math.ceil(total / 100) * 100}`, value: Math.ceil(total / 100) * 100 },
                                    { label: '₱500', value: 500 },
                                    { label: '₱1000', value: 1000 }
                                ].map((quick, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setQuickAmount(quick.value)}
                                        className="relative py-4 px-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-2xl font-bold tracking-widest text-[#E2E8F0] hover:text-white text-xs transition-all duration-300 active:scale-95 group overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        {quick.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-8 pt-4 mt-auto relative z-10">
                    <button
                        onClick={handleConfirm}
                        className="group relative w-full py-5 bg-white/[0.05] hover:bg-indigo-600 border border-white/[0.1] hover:border-indigo-400 text-white font-bold text-sm tracking-[0.2em] uppercase rounded-[1.5rem] transition-all duration-500 active:scale-[0.98] overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.6)]"
                    >
                        {/* Sweeping light effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            Confirm {paymentMethod === 'CASH' ? 'Payment' : paymentMethod === 'CARD' ? 'Card Terminal' : 'E-Wallet'}
                            <svg className="w-5 h-5 transition-transform duration-500 ease-out group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
