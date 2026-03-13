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
        <div className="w-96 flex flex-col h-full bg-white dark:bg-slate-800 shadow-xl z-10">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShoppingCart size={20} className="text-indigo-500" />
                    Current Order
                </h2>
                {cartItems.length > 0 && (
                    <button
                        onClick={onClearCart}
                        className="text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
                        <ShoppingCart size={48} className="opacity-20" />
                        <p>No items in cart</p>
                    </div>
                ) : (
                    cartItems.map((item, index) => (
                        <div key={`${item.menuItemId}-${index}`} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-slate-900 dark:text-white pr-2">
                                    {item.productName}
                                </div>
                                <div className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                    ₱{item.subtotal.toFixed(2)}
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <button
                                        onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <span className="w-6 text-center font-medium text-slate-900 dark:text-white">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => onRemoveItem(index)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Totals & Checkout Button */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 pb-safe">
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Subtotal</span>
                        <span>₱{subtotal.toFixed(2)}</span>
                    </div>
                    {/* Only show tax if applicable
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Tax</span>
                        <span>₱{taxAmount.toFixed(2)}</span>
                    </div>
                    */}
                    <div className="flex justify-between text-xl font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span>Total</span>
                        <span className="text-indigo-600 dark:text-indigo-400">₱{total.toFixed(2)}</span>
                    </div>
                </div>

                <button
                    onClick={onCheckout}
                    disabled={cartItems.length === 0}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
                >
                    Checkout (₱{total.toFixed(2)})
                </button>
            </div>
        </div>
    );
};

export default CartPane;
