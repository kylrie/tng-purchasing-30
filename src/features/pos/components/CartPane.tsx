import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import type { POSOrderItem } from '../types/pos.types';

interface CartPaneProps {
    cartItems: POSOrderItem[];
    subtotal: number;
    total: number;
    onUpdateQuantity: (index: number, qty: number) => void;
    onRemoveItem: (index: number) => void;
    onClearCart: () => void;
    onCheckout: () => void;
}

const CartPane: React.FC<CartPaneProps> = ({
    cartItems,
    subtotal,
    total,
    onUpdateQuantity,
    onRemoveItem,
    onClearCart,
    onCheckout
}) => {
    return (
        <div className="w-full md:w-[400px] flex flex-col h-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.03)] dark:shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-20 border-l border-slate-200/50 dark:border-slate-800/50">
            {/* Header */}
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <ShoppingCart size={22} strokeWidth={2.5} />
                    </div>
                    Current Order
                </h2>
                {cartItems.length > 0 && (
                    <button
                        onClick={onClearCart}
                        className="text-sm font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all duration-200"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3.5 scroll-smooth">
                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-5 opacity-80">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800/80 rounded-full flex items-center justify-center mb-2">
                            <ShoppingCart size={40} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Your cart is empty</p>
                            <p className="text-sm text-slate-500 dark:text-slate-500">Scan or tap products to add them.</p>
                        </div>
                    </div>
                ) : (
                    cartItems.map((item, index) => (
                        <div key={`${item.menuItemId}-${index}`} className="flex flex-col gap-3 p-4 bg-white dark:bg-[#151B2B] rounded-[1.25rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300 group">
                            <div className="flex justify-between items-start">
                                <div className="font-semibold text-slate-900 dark:text-slate-100 pr-3 leading-snug text-base flex-1">
                                    {item.productName}
                                </div>
                                <div className="font-black text-slate-900 dark:text-white whitespace-nowrap text-lg">
                                    ₱{item.subtotal.toFixed(2)}
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-1">
                                <div className="flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-1">
                                    <button
                                        onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm active:scale-95"
                                    >
                                        <Minus size={16} strokeWidth={2.5} />
                                    </button>
                                    <span className="w-10 text-center font-bold text-slate-900 dark:text-white select-none">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm active:scale-95"
                                    >
                                        <Plus size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => onRemoveItem(index)}
                                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors duration-200 opacity-60 group-hover:opacity-100"
                                    aria-label="Remove item"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Totals & Checkout Button */}
            <div className="p-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 pb-safe shrink-0 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.4)] relative z-10">
                <div className="space-y-3 mb-5 px-1">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
                        <span>Subtotal</span>
                        <span>₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-black text-slate-900 dark:text-white pt-3 border-t border-slate-200/80 dark:border-slate-700/80 mt-3 relative">
                        <span className="tracking-tight">Total</span>
                        <span className="text-indigo-600 dark:text-indigo-400 tracking-tight">₱{total.toFixed(2)}</span>
                    </div>
                </div>

                <button
                    onClick={onCheckout}
                    disabled={cartItems.length === 0}
                    className="group relative w-full flex items-center justify-center p-4 bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-bold rounded-2xl transition-all duration-300 disabled:shadow-none hover:shadow-[0_8px_25px_-8px_rgba(79,70,229,0.6)] active:scale-[0.98] overflow-hidden"
                >
                    {/* Glossy overlay effect for button */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <span className="relative z-10 text-lg flex items-center gap-2">
                        Proceed to Payment
                        <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </span>
                </button>
            </div>
        </div>
    );
};

export default CartPane;
