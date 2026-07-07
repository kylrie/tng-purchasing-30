import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import { usePOSStore } from '../store/posStore';

interface CartPaneProps {
    onCheckout?: () => void;
    tableMode?: boolean;
    tableName?: string;
    onSendToKitchen?: () => void;
    onBackToFloor?: () => void;
    onRequireManagerAuth?: (action: () => void) => void;
    onPrintRunningBill?: () => void;
}

const CartPane: React.FC<CartPaneProps> = ({
    onCheckout,
    tableMode,
    tableName,
    onSendToKitchen,
    onBackToFloor,
    onRequireManagerAuth,
    onPrintRunningBill
}) => {
    const {
        cartItems,
        grossSubtotal,
        taxAmount,
        vatableSales,
        vatExemptSales,
        serviceChargeAmount,
        scPwdDiscountAmount,
        manualItemDiscountAmount,
        total,
        updateQuantity,
        removeFromCart,
        toggleDiscount,
        setItemDiscountRate,
        globalDiscountRate,
        setGlobalDiscountRate,
        globalDiscountAmount,
        clearCart
    } = usePOSStore();

    const handleClearCart = () => {
        if (cartItems.some(i => i.isSentToKitchen) && onRequireManagerAuth) {
            onRequireManagerAuth(clearCart);
        } else {
            clearCart();
        }
    };
    const manualDiscountReasons = Array.from(new Set(
        cartItems
            .filter(item => !item.isDiscounted && (item.discountRate || 0) > 0 && item.discountReason)
            .map(item => item.discountReason?.trim())
            .filter(Boolean)
    ));

    const itemDiscountLabel = manualDiscountReasons.length > 0 
        ? manualDiscountReasons.join(', ') + ' Discount'
        : 'Item Discount';

    return (
        <div className="w-full md:w-[400px] flex flex-col h-full bg-[#0a0a0f]/80 backdrop-blur-3xl z-20 border-l border-white/[0.05] relative shadow-[-30px_0_60px_rgba(0,0,0,0.5)]">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.05] flex justify-between items-center bg-transparent shrink-0">
                <h2 className="text-xl font-bold text-white flex items-center gap-3 tracking-wide">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                        <ShoppingCart size={20} strokeWidth={2.5} className="relative z-10" />
                    </div>
                    {tableMode ? `Bill - ${tableName}` : 'Current Order'}
                </h2>
                <div className="flex items-center gap-2">
                    {tableMode && (
                        <button
                            onClick={onBackToFloor}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 rounded-lg transition-all tracking-wider border border-indigo-500/20"
                        >
                            Floor
                        </button>
                    )}
                    {cartItems.length > 0 && (
                        <button
                            onClick={handleClearCart}
                            className="text-xs font-bold text-red-500/80 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all duration-300 uppercase tracking-widest border border-red-500/10"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth scrollbar-hide relative z-10">
                {/* Internal subtle glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-5 opacity-60">
                        <div className="w-24 h-24 bg-white/[0.02] border border-white/[0.05] rounded-full flex items-center justify-center mb-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transform -rotate-12">
                            <ShoppingCart size={32} className="text-slate-500" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-300 mb-2 tracking-tight">Cart is Empty</p>
                            <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed mx-auto">Select extraordinary items from the catalogue to begin.</p>
                        </div>
                    </div>
                ) : (
                    cartItems.map((item, index) => (
                        <div key={`${item.menuItemId}-${index}`} className="flex flex-col gap-3 p-4 bg-white/[0.02] rounded-[1.25rem] border border-white/[0.05] shadow-sm hover:bg-white/[0.04] hover:-translate-x-1 transition-all duration-500 group relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="flex justify-between items-start relative z-10">
                                <div className="font-semibold text-slate-300 pr-3 leading-snug text-sm flex-1 group-hover:text-white transition-colors duration-300">
                                    {item.productName}
                                    {item.isDiscounted && (
                                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                                            SC/PWD
                                        </span>
                                    )}
                                    {!item.isDiscounted && (item.discountRate || 0) > 0 && (
                                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded flex-col inline-flex">
                                            <span>{item.discountRate}% DISC</span>
                                            {item.discountReason && <span className="text-[8px] opacity-80">{item.discountReason}</span>}
                                        </span>
                                    )}
                                </div>
                                <div className="font-bold text-white whitespace-nowrap text-base tracking-tight text-right">
                                    <div className={item.isDiscounted || (item.discountRate || 0) > 0 ? "text-slate-400 line-through text-xs" : ""}>
                                        ₱{(item.unitPrice * item.quantity).toFixed(2)}
                                    </div>
                                    {(item.isDiscounted || (item.discountRate || 0) > 0) && (
                                        <div className="text-amber-400">
                                            ₱{item.subtotal.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-1 relative z-10">
                                <div className="flex items-center bg-black/40 rounded-xl border border-white/[0.05] p-1 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                                    <button
                                        onClick={() => {
                                            const decrease = () => updateQuantity(index, item.quantity - 1);
                                            if (item.isSentToKitchen && onRequireManagerAuth) {
                                                onRequireManagerAuth(decrease);
                                            } else {
                                                decrease();
                                            }
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all duration-300 active:scale-95"
                                    >
                                        <Minus size={14} strokeWidth={2.5} />
                                    </button>
                                    <span className="w-10 text-center font-bold text-white text-sm select-none">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => updateQuantity(index, item.quantity + 1)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all duration-300 active:scale-95"
                                    >
                                        <Plus size={14} strokeWidth={2.5} />
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleDiscount(index)}
                                        className={`p-2.5 rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider border ${
                                            item.isDiscounted 
                                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                        aria-label="Toggle SC/PWD"
                                    >
                                        SC/PWD
                                    </button>
                                    <div className={`flex flex-col gap-1 rounded-xl transition-all duration-300 border px-2 py-1.5 ${
                                        (item.discountRate || 0) > 0
                                            ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                                            : 'bg-white/5 border-white/10 text-slate-400 focus-within:bg-white/10'
                                    }`}>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={item.discountRate || ''}
                                                onChange={(e) => setItemDiscountRate(index, parseFloat(e.target.value) || 0, item.discountReason || '', item.discountType)}
                                                placeholder="0"
                                                className={`bg-transparent text-right text-xs font-bold focus:outline-none placeholder-slate-600 ${item.discountType === 'amount' ? 'w-10' : 'w-8'}`}
                                                min="0"
                                                max={item.discountType === 'amount' ? undefined : "100"}
                                                disabled={item.isDiscounted}
                                            />
                                            <button 
                                                onClick={() => setItemDiscountRate(index, item.discountRate || 0, item.discountReason || '', item.discountType === 'amount' ? 'percentage' : 'amount')}
                                                disabled={item.isDiscounted}
                                                className="text-[10px] font-bold uppercase tracking-wider hover:text-white transition-colors"
                                            >
                                                {item.discountType === 'amount' ? '₱ DISC' : '% DISC'}
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={item.discountReason || ''}
                                            onChange={(e) => setItemDiscountRate(index, item.discountRate || 0, e.target.value, item.discountType)}
                                            placeholder="Reason"
                                            className="w-16 bg-transparent text-xs focus:outline-none placeholder-slate-600 border-t border-white/10 mt-1 pt-1"
                                            disabled={item.isDiscounted}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const remove = () => removeFromCart(index);
                                            if (item.isSentToKitchen && onRequireManagerAuth) {
                                                onRequireManagerAuth(remove);
                                            } else {
                                                remove();
                                            }
                                        }}
                                        className="p-2.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 opacity-60 group-hover:opacity-100 h-fit"
                                        aria-label="Remove item"
                                    >
                                        <Trash2 size={16} strokeWidth={2} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Totals & Checkout Button */}
            <div className="relative p-6 bg-[#0a0a0f]/95 backdrop-blur-2xl border-t border-white/[0.05] pb-safe shrink-0 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.5)] z-20">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="space-y-2 mb-6 px-1">
                    <div className="flex justify-between text-slate-500 font-medium text-sm items-center">
                        <span>Subtotal</span>
                        <span className="text-slate-300">₱{grossSubtotal.toFixed(2)}</span>
                    </div>
                    {/* Manual Discount Input */}
                    {setGlobalDiscountRate && (
                        <div className="flex justify-between text-slate-500 font-medium text-sm items-center mt-2">
                            <span>Manual Discount (%)</span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={globalDiscountRate || ''}
                                    onChange={(e) => setGlobalDiscountRate(Number(e.target.value))}
                                    className="w-16 bg-white/[0.05] border border-white/[0.1] rounded text-white text-right px-2 py-1 focus:outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    )}
                    {globalDiscountAmount > 0 && (
                        <div className="flex justify-between text-emerald-400/80 font-medium text-sm">
                            <span>Custom Discount</span>
                            <span>- ₱{globalDiscountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {manualItemDiscountAmount > 0 && (
                        <div className="flex justify-between text-emerald-400/80 font-medium text-sm">
                            <span className="uppercase">{itemDiscountLabel}</span>
                            <span>- ₱{manualItemDiscountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {scPwdDiscountAmount > 0 && (
                        <div className="flex justify-between text-amber-400/80 font-medium text-sm">
                            <span>SC/PWD Discount</span>
                            <span>- ₱{scPwdDiscountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {vatableSales > 0 && (
                        <div className="flex justify-between text-slate-500 font-medium text-xs">
                            <span>Vatable Sales</span>
                            <span className="text-slate-400">₱{vatableSales.toFixed(2)}</span>
                        </div>
                    )}
                    {vatExemptSales > 0 && (
                        <div className="flex justify-between text-slate-500 font-medium text-xs">
                            <span>VAT-Exempt Sales</span>
                            <span className="text-slate-400">₱{vatExemptSales.toFixed(2)}</span>
                        </div>
                    )}
                    {taxAmount > 0 && (
                        <div className="flex justify-between text-slate-500 font-medium text-xs">
                            <span>VAT Amount (12%)</span>
                            <span className="text-slate-400">₱{taxAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {serviceChargeAmount > 0 && (
                        <div className="flex justify-between text-slate-500 font-medium text-sm">
                            <span>Service Charge</span>
                            <span className="text-slate-300">₱{serviceChargeAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-end text-3xl font-black text-white pt-4 border-t border-white/[0.02] mt-4 relative">
                        <span className="tracking-tighter text-lg text-slate-400 font-bold mb-1 uppercase tracking-[0.1em]">Total</span>
                        <div className="tracking-tighter flex items-start">
                            <span className="text-indigo-400/70 text-lg mr-1 mt-1 font-bold">₱</span>
                            <span className="bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400 drop-shadow-lg">{total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {tableMode ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <button
                                onClick={onSendToKitchen}
                                disabled={cartItems.length === 0}
                                className="flex-1 p-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-500/30 rounded-xl transition-all font-bold uppercase tracking-wider text-sm"
                            >
                                Send
                            </button>
                            <button
                                onClick={onPrintRunningBill}
                                disabled={cartItems.length === 0}
                                className="flex-1 p-3 bg-slate-600/20 hover:bg-slate-600/30 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-500/30 rounded-xl transition-all font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                Print Bill
                            </button>
                        </div>
                        <button
                            onClick={onCheckout}
                            disabled={cartItems.length === 0}
                            className="w-full relative flex items-center justify-center p-3 disabled:bg-white/[0.02] bg-white/[0.05] disabled:border-white/[0.02] border border-white/[0.1] text-white disabled:text-slate-600 font-bold rounded-xl transition-all duration-500 hover:shadow-[0_0_30px_-10px_rgba(34,197,94,0.5)] overflow-hidden active:scale-[0.98] group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[length:200%_auto] group-hover:animate-[cartGlow_3s_linear_infinite]"></div>
                            <span className="relative z-10 text-sm uppercase tracking-widest flex items-center gap-2">
                                Settle Bill
                            </span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onCheckout}
                        disabled={cartItems.length === 0}
                        className="group relative w-full flex items-center justify-center p-4 disabled:bg-white/[0.02] bg-white/[0.05] disabled:border-white/[0.02] border border-white/[0.1] text-white disabled:text-slate-600 font-bold rounded-2xl transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] overflow-hidden active:scale-[0.98]"
                    >
                        {/* Glowing background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[length:200%_auto] group-hover:animate-[cartGlow_3s_linear_infinite]"></div>

                        {/* Top glass reflection */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100"></div>

                        <span className="relative z-10 text-sm uppercase tracking-widest flex items-center gap-3">
                            {cartItems.length === 0 ? "Select Items" : "Initialize Payment"}
                            {cartItems.length > 0 && (
                                <svg className="w-4 h-4 transition-transform duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            )}
                        </span>
                    </button>
                )}
            </div>

            {/* Global animation for the cart glow effect */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes cartGlow {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}} />
        </div>
    );
};

export default React.memo(CartPane);
