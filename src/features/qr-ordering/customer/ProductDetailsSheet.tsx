import React, { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus, UtensilsCrossed, AlertCircle } from 'lucide-react';
import type { PublicMenuItem } from '../data/mockMenu';

/**
 * QR Ordering — Product Details (Phase 1 UI prototype)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §2 · Visuals: docs/QR_UI_GUIDE.md §2.2
 * MOCK ONLY — no Firebase / Xendit / Functions / backend.
 *
 * Light, beach-friendly theme. Bottom sheet on mobile (slide-up), centered
 * modal on tablet+ (fade + zoom). Reuses the CartDrawer qty-stepper language.
 */

interface ProductDetailsSheetProps {
    /** The item to show. `null` closes the sheet (with a leave animation). */
    item: PublicMenuItem | null;
    onClose: () => void;
    onAdd: (item: PublicMenuItem, qty: number, note: string) => void;
}

const NOTE_MAX = 120;
const LEAVE_MS = 250;

const ProductDetailsSheet: React.FC<ProductDetailsSheetProps> = ({ item, onClose, onAdd }) => {
    // Keep a local copy so content stays rendered during the leave animation
    // after the parent clears `item`.
    const [localItem, setLocalItem] = useState<PublicMenuItem | null>(item);
    const [mounted, setMounted] = useState(false); // in the DOM?
    const [entered, setEntered] = useState(false);  // animated in?
    const [qty, setQty] = useState(1);
    const [note, setNote] = useState('');
    const leaveTimer = useRef<number | undefined>(undefined);

    // Reset controls whenever a fresh item opens.
    useEffect(() => {
        if (item) {
            setLocalItem(item);
            setQty(1);
            setNote('');
        }
    }, [item]);

    // Enter / leave transitions.
    useEffect(() => {
        if (item) {
            window.clearTimeout(leaveTimer.current);
            setMounted(true);
            const raf = requestAnimationFrame(() => setEntered(true));
            return () => cancelAnimationFrame(raf);
        }
        setEntered(false);
        leaveTimer.current = window.setTimeout(() => setMounted(false), LEAVE_MS);
        return () => window.clearTimeout(leaveTimer.current);
    }, [item]);

    // Escape to close + lock body scroll while open.
    useEffect(() => {
        if (!item) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [item, onClose]);

    if (!mounted || !localItem) return null;

    const soldOut = !localItem.isAvailable;
    const lineTotal = localItem.sellingPrice * qty;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={`${localItem.name} details`}
        >
            {/* Backdrop */}
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Sheet / modal */}
            <div
                className={`relative w-full sm:max-w-[500px] max-h-[88vh] sm:max-h-[90vh] flex flex-col bg-white border-t sm:border border-black/[0.06] rounded-t-[1.75rem] sm:rounded-[1.75rem] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:shadow-[0_24px_60px_rgba(0,0,0,0.22)] overflow-hidden transition-all duration-300 ease-out ${entered
                    ? 'translate-y-0 opacity-100 sm:scale-100'
                    : 'translate-y-full opacity-0 sm:translate-y-0 sm:opacity-0 sm:scale-95'
                    }`}
            >
                {/* Mobile drag handle */}
                <div className="sm:hidden pt-3 flex justify-center shrink-0">
                    <span className="w-10 h-1.5 rounded-full bg-black/10" />
                </div>

                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/90 border border-black/[0.06] text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Scrollable content */}
                <div className="relative z-10 flex-1 overflow-y-auto px-5 sm:px-6 pt-3 pb-4 scrollbar-hide">
                    {/* Hero image (photo when available, clean neutral placeholder — spec §2.8) */}
                    <div className="relative h-48 sm:h-56 rounded-2xl overflow-hidden border border-black/[0.05] bg-[#f0fdf4] flex items-center justify-center mb-5">
                        {localItem.imageUrl ? (
                            <img
                                src={localItem.imageUrl}
                                alt={localItem.name}
                                className={`w-full h-full object-cover ${soldOut ? 'grayscale opacity-60' : ''}`}
                            />
                        ) : (
                            <UtensilsCrossed size={44} className={`text-[#a9d2cb] ${soldOut ? 'opacity-60' : ''}`} strokeWidth={1.5} />
                        )}
                        {soldOut && (
                            <span className="absolute inset-x-0 bottom-3 mx-auto w-fit px-3.5 py-1.5 bg-white/95 text-slate-700 text-xs font-bold uppercase tracking-wide rounded-full shadow border border-black/[0.05]">
                                Sold out
                            </span>
                        )}
                    </div>

                    {/* Category + name + price */}
                    <p className="text-xs font-semibold text-[#ec4899] mb-1.5">
                        {localItem.category}
                    </p>
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-bold text-[#0d6e62] leading-tight pr-2">{localItem.name}</h2>
                        <div className="font-extrabold text-[#0d6e62] text-xl tracking-tight shrink-0">
                            <span className="text-[#0d6e62]/70 mr-0.5 text-base font-semibold">₱</span>
                            {localItem.sellingPrice.toFixed(2)}
                        </div>
                    </div>

                    {/* Description */}
                    {localItem.description && (
                        <p className="text-sm text-slate-600 leading-relaxed mt-3">{localItem.description}</p>
                    )}

                    {/* Notes + quantity — hidden when sold out (read-only) */}
                    {!soldOut && (
                        <>
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label htmlFor="qr-item-note" className="text-xs font-medium text-slate-600">
                                        Special instructions <span className="text-slate-400">(optional)</span>
                                    </label>
                                    <span className={`text-[10px] tabular-nums ${note.length >= NOTE_MAX ? 'text-red-500' : 'text-slate-400'}`}>
                                        {note.length}/{NOTE_MAX}
                                    </span>
                                </div>
                                <textarea
                                    id="qr-item-note"
                                    value={note}
                                    maxLength={NOTE_MAX}
                                    onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                                    rows={2}
                                    placeholder="e.g. no onions, extra spicy…"
                                    className="w-full resize-none px-4 py-3 bg-[#f9fafb] border border-black/[0.08] rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ec4899]/50 focus:ring-2 focus:ring-[#ec4899]/15 transition-all text-sm"
                                />
                            </div>

                            <div className="mt-5 flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-600">Quantity</span>
                                <div className="flex items-center gap-1 bg-[#f0fdf4] rounded-xl p-1 border border-black/[0.05]">
                                    <button
                                        type="button"
                                        onClick={() => setQty(q => Math.max(1, q - 1))}
                                        disabled={qty <= 1}
                                        aria-label="Decrease quantity"
                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <Minus size={16} strokeWidth={2.5} />
                                    </button>
                                    <span className="w-8 text-center text-base font-bold text-slate-900 tabular-nums" aria-live="polite">{qty}</span>
                                    <button
                                        type="button"
                                        onClick={() => setQty(q => q + 1)}
                                        aria-label="Increase quantity"
                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-colors"
                                    >
                                        <Plus size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Pinned CTA (spec §2.6) */}
                <div className="relative z-10 shrink-0 px-5 sm:px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-black/[0.06] bg-white">
                    {soldOut ? (
                        <button
                            type="button"
                            disabled
                            className="w-full py-4 rounded-[1.25rem] bg-black/[0.04] border border-black/[0.06] text-slate-400 font-semibold text-sm cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <AlertCircle size={15} /> Sold out
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onAdd(localItem, qty, note.trim())}
                            className="w-full py-4 rounded-[1.25rem] bg-[#ec4899] hover:bg-[#db2777] active:scale-[0.98] text-white font-bold tracking-wide transition-all duration-200 shadow-sm"
                        >
                            <span className="flex items-center justify-center gap-2">
                                Add to cart
                                <span className="text-white/70">·</span>
                                <span className="tabular-nums">₱{lineTotal.toFixed(2)}</span>
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductDetailsSheet;
