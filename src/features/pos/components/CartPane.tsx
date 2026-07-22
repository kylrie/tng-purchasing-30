import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Printer, ArrowRight } from 'lucide-react';
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

// QR-Operations design language (light, high-contrast). POS pricing/discount/table
// logic is UNCHANGED — only presentation.
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
        totalVatAmount: taxAmount,
        totalVatableSales: vatableSales,
        totalVatExemptSales: vatExemptSales,
        serviceChargeAmount,
        totalScPwdDiscount: scPwdDiscountAmount,
        totalManualDiscount: manualItemDiscountAmount,
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
        <div className="w-full md:w-[400px] flex flex-col h-full bg-white border-l-2 border-slate-200 z-20 relative shrink-0">
            {/* Header */}
            <div className="p-4 border-b-2 border-slate-200 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2.5 min-w-0">
                    <span className="p-2 bg-slate-900 rounded-lg text-white shrink-0">
                        <ShoppingCart size={18} strokeWidth={2.5} />
                    </span>
                    <span className="truncate">{tableMode ? `Bill · ${tableName}` : 'Current Order'}</span>
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                    {tableMode && (
                        <button
                            onClick={onBackToFloor}
                            className="text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors border-2 border-slate-200"
                        >
                            Floor
                        </button>
                    )}
                    {cartItems.length > 0 && (
                        <button
                            onClick={handleClearCart}
                            className="text-xs font-black text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors uppercase tracking-wide border-2 border-red-100"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-20 h-20 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center">
                            <ShoppingCart size={30} className="text-slate-300" strokeWidth={1.75} />
                        </div>
                        <div>
                            <p className="text-base font-black text-slate-700">Cart is empty</p>
                            <p className="text-xs text-slate-500 max-w-[220px] leading-relaxed mx-auto mt-1">Tap items on the left to start an order.</p>
                        </div>
                    </div>
                ) : (
                    cartItems.map((item, index) => (
                        <div key={`${item.menuItemId}-${index}`} className="flex flex-col gap-3 p-3 bg-white rounded-xl border-2 border-slate-200">
                            <div className="flex justify-between items-start">
                                <div className="font-bold text-slate-900 pr-3 leading-snug text-sm flex-1">
                                    {item.productName}
                                    {item.isDiscounted && (
                                        <span className="ml-2 text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                                            SC/PWD
                                        </span>
                                    )}
                                    {!item.isDiscounted && (item.discountRate || 0) > 0 && (
                                        <span className="ml-2 text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex-col inline-flex">
                                            <span>{item.discountRate}% DISC</span>
                                            {item.discountReason && <span className="text-[8px] opacity-80">{item.discountReason}</span>}
                                        </span>
                                    )}
                                </div>
                                <div className="font-black text-slate-900 whitespace-nowrap text-base tabular-nums text-right">
                                    <div className={item.isDiscounted || (item.discountRate || 0) > 0 ? "text-slate-400 line-through text-xs font-bold" : ""}>
                                        ₱{(item.unitPrice * item.quantity).toFixed(2)}
                                    </div>
                                    {(item.isDiscounted || (item.discountRate || 0) > 0) && (
                                        <div className="text-emerald-700">
                                            ₱{item.subtotal.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center bg-slate-100 rounded-lg border-2 border-slate-200 p-0.5">
                                    <button
                                        onClick={() => {
                                            const decrease = () => updateQuantity(index, item.quantity - 1);
                                            if (item.isSentToKitchen && onRequireManagerAuth) {
                                                onRequireManagerAuth(decrease);
                                            } else {
                                                decrease();
                                            }
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-colors active:scale-95"
                                    >
                                        <Minus size={14} strokeWidth={3} />
                                    </button>
                                    <span className="w-9 text-center font-black text-slate-900 text-sm select-none tabular-nums">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => updateQuantity(index, item.quantity + 1)}
                                        className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-colors active:scale-95"
                                    >
                                        <Plus size={14} strokeWidth={3} />
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleDiscount(index)}
                                        className={`px-2.5 rounded-lg transition-colors text-xs font-black uppercase tracking-wide border-2 ${
                                            item.isDiscounted
                                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                        }`}
                                        aria-label="Toggle SC/PWD"
                                    >
                                        SC/PWD
                                    </button>
                                    <div className={`flex flex-col gap-1 rounded-lg transition-colors border-2 px-2 py-1 ${
                                        (item.discountRate || 0) > 0
                                            ? 'bg-amber-100 border-amber-200 text-amber-700'
                                            : 'bg-white border-slate-200 text-slate-500 focus-within:border-slate-400'
                                    }`}>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={item.discountRate || ''}
                                                onChange={(e) => setItemDiscountRate(index, parseFloat(e.target.value) || 0, item.discountReason || '', item.discountType)}
                                                placeholder="0"
                                                className={`bg-transparent text-right text-xs font-black focus:outline-none placeholder-slate-400 ${item.discountType === 'amount' ? 'w-10' : 'w-8'}`}
                                                min="0"
                                                max={item.discountType === 'amount' ? undefined : "100"}
                                                disabled={item.isDiscounted}
                                            />
                                            <button
                                                onClick={() => setItemDiscountRate(index, item.discountRate || 0, item.discountReason || '', item.discountType === 'amount' ? 'percentage' : 'amount')}
                                                disabled={item.isDiscounted}
                                                className="text-[10px] font-black uppercase tracking-wide hover:text-slate-900 transition-colors"
                                            >
                                                {item.discountType === 'amount' ? '₱ DISC' : '% DISC'}
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={item.discountReason || ''}
                                            onChange={(e) => setItemDiscountRate(index, item.discountRate || 0, e.target.value, item.discountType)}
                                            placeholder="Reason"
                                            className="w-16 bg-transparent text-xs focus:outline-none placeholder-slate-400 border-t border-slate-200 mt-1 pt-1"
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
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors h-fit"
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
            <div className="p-4 bg-white border-t-2 border-slate-200 pb-safe shrink-0">
                <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-slate-500 font-semibold text-sm items-center">
                        <span>Subtotal</span>
                        <span className="text-slate-900 tabular-nums">₱{grossSubtotal.toFixed(2)}</span>
                    </div>
                    {/* Manual Discount Input */}
                    {setGlobalDiscountRate && (
                        <div className="flex justify-between text-slate-500 font-semibold text-sm items-center">
                            <span>Manual Discount (%)</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={globalDiscountRate || ''}
                                onChange={(e) => setGlobalDiscountRate(Number(e.target.value))}
                                className="w-16 bg-white border-2 border-slate-200 rounded-lg text-slate-900 font-bold text-right px-2 py-1 focus:outline-none focus:border-slate-400 transition-colors tabular-nums"
                                placeholder="0"
                            />
                        </div>
                    )}
                    {globalDiscountAmount > 0 && (
                        <div className="flex justify-between text-emerald-700 font-semibold text-sm">
                            <span>Custom Discount</span>
                            <span className="tabular-nums">- ₱{globalDiscountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {manualItemDiscountAmount > 0 && (
                        <div className="flex justify-between text-emerald-700 font-semibold text-sm">
                            <span className="uppercase">{itemDiscountLabel}</span>
                            <span className="tabular-nums">- ₱{manualItemDiscountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {scPwdDiscountAmount > 0 && (
                        <div className="flex justify-between text-amber-600 font-semibold text-sm">
                            <span>SC/PWD Discount</span>
                            <span className="tabular-nums">- ₱{scPwdDiscountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {vatableSales > 0 && (
                        <div className="flex justify-between text-slate-500 font-medium text-xs">
                            <span>Vatable Sales</span>
                            <span className="text-slate-600 tabular-nums">₱{vatableSales.toFixed(2)}</span>
                        </div>
                    )}
                    {vatExemptSales > 0 && (
                        <div className="flex justify-between text-slate-500 font-medium text-xs">
                            <span>VAT-Exempt Sales</span>
                            <span className="text-slate-600 tabular-nums">₱{vatExemptSales.toFixed(2)}</span>
                        </div>
                    )}
                    {taxAmount > 0 && (
                        <div className="flex justify-between text-slate-500 font-medium text-xs">
                            <span>VAT Amount (12%)</span>
                            <span className="text-slate-600 tabular-nums">₱{taxAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {serviceChargeAmount > 0 && (
                        <div className="flex justify-between text-slate-500 font-semibold text-sm">
                            <span>Service Charge</span>
                            <span className="text-slate-900 tabular-nums">₱{serviceChargeAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-slate-100">
                        <span className="text-sm text-slate-500 font-black uppercase tracking-wide">Total</span>
                        <div className="text-3xl font-black text-slate-900 tabular-nums">
                            <span className="text-slate-400 text-lg mr-0.5">₱</span>{total.toFixed(2)}
                        </div>
                    </div>
                </div>

                {tableMode ? (
                    <div className="flex flex-col gap-2.5">
                        <div className="flex gap-2.5">
                            <button
                                onClick={onSendToKitchen}
                                disabled={cartItems.length === 0}
                                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors font-black uppercase tracking-wide text-sm"
                            >
                                Send
                            </button>
                            <button
                                onClick={onPrintRunningBill}
                                disabled={cartItems.length === 0}
                                className="flex-1 py-3 bg-white border-2 border-slate-200 hover:border-slate-400 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors font-black uppercase tracking-wide text-sm flex items-center justify-center gap-2"
                            >
                                <Printer size={16} strokeWidth={2.25} /> Print Bill
                            </button>
                        </div>
                        <button
                            onClick={onCheckout}
                            disabled={cartItems.length === 0}
                            className="w-full flex items-center justify-center py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-xl transition-colors active:scale-[0.99]"
                        >
                            <span className="text-sm uppercase tracking-wide">Settle Bill</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onCheckout}
                        disabled={cartItems.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-2xl transition-colors active:scale-[0.99]"
                    >
                        <span className="text-sm uppercase tracking-wide">{cartItems.length === 0 ? "Select items" : "Proceed to payment"}</span>
                        {cartItems.length > 0 && <ArrowRight size={18} strokeWidth={3} />}
                    </button>
                )}
            </div>
        </div>
    );
};

export default React.memo(CartPane);
