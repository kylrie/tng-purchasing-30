import React, { useEffect, useState } from 'react';
import { X, Minus, Plus, Trash2, ShoppingCart, StickyNote, Loader2, AlertCircle } from 'lucide-react';
import { formatTableLabel } from '../utils/tableUtils';

/**
 * QR Ordering — Cart Drawer (Phase 1 UI · Sprint 2 order submit)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §3 · Visuals: docs/QR_UI_GUIDE.md §2.3
 *
 * Light, beach-friendly theme. Mobile-first bottom drawer (slide-up); side
 * panel on tablet+ (slide-in from the right). The checkout CTA submits the cart
 * via `onCheckout` (parent owns the real createQrOrder call vs. mock fallback);
 * `submitting`/`submitError` drive the loading + error affordances.
 */

/** A single cart line (prototype cart lives in CustomerMenuView state). */
export interface CartLine {
    lineId: string;   // unique per add
    id: string;       // menu item id
    name: string;
    unitPrice: number;
    qty: number;
    note: string;
}

interface CartDrawerProps {
    open: boolean;
    lines: CartLine[];
    tableNumber: string;
    onClose: () => void;
    onChangeQty: (lineId: string, nextQty: number) => void;
    onRemove: (lineId: string) => void;
    onClear: () => void;
    /** When provided, enables the "Proceed to checkout" CTA. */
    onCheckout?: () => void;
    /** True while the order is being submitted — disables the CTA + shows a spinner. */
    submitting?: boolean;
    /** Diner-friendly error from a failed submit; shown above the CTA with a retry hint. */
    submitError?: string;
}

const LEAVE_MS = 250;

const CartDrawer: React.FC<CartDrawerProps> = ({ open, lines, tableNumber, onClose, onChangeQty, onRemove, onClear, onCheckout, submitting = false, submitError = '' }) => {
    const [mounted, setMounted] = useState(false);
    const [entered, setEntered] = useState(false);

    // Enter / leave transitions.
    useEffect(() => {
        let leaveTimer: number | undefined;
        if (open) {
            setMounted(true);
            const raf = requestAnimationFrame(() => setEntered(true));
            return () => cancelAnimationFrame(raf);
        }
        setEntered(false);
        leaveTimer = window.setTimeout(() => setMounted(false), LEAVE_MS);
        return () => window.clearTimeout(leaveTimer);
    }, [open]);

    // Don't allow dismissing the drawer mid-submit (would hide the spinner/error).
    const handleClose = () => { if (!submitting) onClose(); };

    // Escape to close + lock body scroll while open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose, submitting]);

    if (!mounted) return null;

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const isEmpty = lines.length === 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
        >
            {/* Backdrop */}
            <button
                type="button"
                aria-label="Close cart"
                onClick={handleClose}
                className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Panel: bottom sheet (mobile) → right side drawer (tablet+) */}
            <div
                className={`relative w-full sm:w-[420px] sm:max-w-[92vw] max-h-[86vh] sm:max-h-none sm:h-full flex flex-col bg-[#ffffff] border-t sm:border-t-0 sm:border-l border-black/[0.06] rounded-t-[1.75rem] sm:rounded-t-none sm:rounded-l-[1.75rem] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] overflow-hidden transition-transform duration-300 ease-out ${entered
                    ? 'translate-y-0 sm:translate-x-0'
                    : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
                    }`}
            >
                {/* Mobile drag handle */}
                <div className="sm:hidden pt-3 flex justify-center shrink-0">
                    <span className="w-10 h-1.5 rounded-full bg-black/10" />
                </div>

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-black/[0.06] bg-[#ffffff] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-[#ec4899]/10 rounded-xl border border-[#ec4899]/20 shrink-0">
                            <ShoppingCart size={18} className="text-[#ec4899]" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 leading-tight">Your order</p>
                            <p className="text-[11px] font-semibold text-[#0d6e62] tracking-wide">
                                {formatTableLabel(tableNumber)}{count > 0 ? ` · ${count} item${count > 1 ? 's' : ''}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {!isEmpty && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={submitting}
                            aria-label="Close"
                            className="p-2 rounded-full bg-white border border-black/[0.06] text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-40"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Items / empty state */}
                <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-5 py-4 scrollbar-hide">
                    {isEmpty ? (
                        <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-16 h-16 bg-white border border-black/[0.06] rounded-3xl flex items-center justify-center mb-5 shadow-sm">
                                <ShoppingCart className="text-slate-400" size={26} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-slate-900 mb-1.5">Your cart is empty</h3>
                            <p className="text-slate-500 text-xs leading-relaxed mb-6 max-w-[15rem]">
                                Add dishes from the menu to start your order.
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-full border border-black/[0.08] shadow-sm transition-all duration-200 active:scale-95"
                            >
                                Browse menu
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {lines.map(line => (
                                <li
                                    key={line.lineId}
                                    className="relative p-4 bg-white rounded-[1.25rem] border border-black/[0.05] shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 leading-snug">{line.name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                <span className="text-slate-400">₱</span>{line.unitPrice.toFixed(2)} each
                                            </p>
                                            {line.note && (
                                                <p className="mt-2 text-xs text-amber-800 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                                    <StickyNote size={12} className="mt-0.5 shrink-0 opacity-80" />
                                                    <span className="min-w-0 break-words">{line.note}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-slate-900 text-base tracking-tight">
                                                <span className="text-slate-400 mr-0.5 text-sm font-semibold">₱</span>
                                                {(line.unitPrice * line.qty).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        {/* Qty stepper */}
                                        <div className="flex items-center gap-1 bg-[#f0fdf4] rounded-xl p-1 border border-black/[0.05]">
                                            <button
                                                type="button"
                                                onClick={() => onChangeQty(line.lineId, line.qty - 1)}
                                                disabled={line.qty <= 1}
                                                aria-label={`Decrease ${line.name} quantity`}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            >
                                                <Minus size={15} strokeWidth={2.5} />
                                            </button>
                                            <span className="w-7 text-center text-sm font-bold text-slate-900 tabular-nums">{line.qty}</span>
                                            <button
                                                type="button"
                                                onClick={() => onChangeQty(line.lineId, line.qty + 1)}
                                                aria-label={`Increase ${line.name} quantity`}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-colors"
                                            >
                                                <Plus size={15} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                        {/* Remove */}
                                        <button
                                            type="button"
                                            onClick={() => onRemove(line.lineId)}
                                            aria-label={`Remove ${line.name}`}
                                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer: totals + checkout (disabled) */}
                {!isEmpty && (
                    <div className="relative z-10 shrink-0 px-5 sm:px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-black/[0.06] bg-white">
                        <div className="flex items-center justify-between text-sm text-slate-500 mb-1.5">
                            <span>Subtotal</span>
                            <span className="tabular-nums">₱{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-semibold text-slate-700">Total</span>
                            <span className="text-2xl font-black tracking-tight tabular-nums text-[#0d6e62]">
                                ₱{subtotal.toFixed(2)}
                            </span>
                        </div>
                        {submitError && (
                            <p
                                role="alert"
                                className="mb-3 flex items-start gap-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
                            >
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <span className="min-w-0">{submitError}</span>
                            </p>
                        )}
                        {onCheckout ? (
                            <button
                                type="button"
                                onClick={onCheckout}
                                disabled={submitting}
                                aria-busy={submitting}
                                className="w-full py-4 rounded-[1.25rem] bg-[#0d6e62] hover:bg-[#0a5a50] active:scale-[0.98] text-white font-bold text-base transition-all duration-200 shadow-[0_12px_28px_-8px_rgba(13,110,98,0.5)] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" /> Placing order…
                                    </>
                                ) : submitError ? 'Try again' : 'Proceed to checkout'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                title="Checkout ships in a later phase"
                                className="w-full py-4 rounded-[1.25rem] bg-black/[0.04] border border-black/[0.06] text-slate-400 font-semibold text-sm cursor-not-allowed"
                            >
                                Proceed to checkout
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartDrawer;
