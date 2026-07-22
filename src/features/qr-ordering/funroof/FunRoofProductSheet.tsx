import React, { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus, Martini, UtensilsCrossed, Gamepad2, Flame } from 'lucide-react';
import type { FunRoofItem } from './funRoofMenu';
import { FUN_ROOF_THEME as T, FUN_ROOF_COLORS, FUN_ROOF_CTA_GRADIENT } from './funRoofTheme';
import { peso } from './funRoofFormat';

/**
 * The Fun Roof — Product Details bottom sheet (dark neon theme).
 *
 * Browse-only: "Add to my picks" appends to a LOCAL picks list (no order is
 * created, no POS/payment is touched). Bottom sheet on mobile, centered modal on
 * tablet+. Mirrors the Inflatable Island sheet's shape/interaction, re-skinned.
 */
interface Props {
    item: FunRoofItem | null;
    onClose: () => void;
    onAdd: (item: FunRoofItem, qty: number) => void;
}

const LEAVE_MS = 250;

const FunRoofProductSheet: React.FC<Props> = ({ item, onClose, onAdd }) => {
    const [localItem, setLocalItem] = useState<FunRoofItem | null>(item);
    const [mounted, setMounted] = useState(false);
    const [entered, setEntered] = useState(false);
    const [qty, setQty] = useState(1);
    const leaveTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (item) { setLocalItem(item); setQty(1); }
    }, [item]);

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

    useEffect(() => {
        if (!item) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [item, onClose]);

    if (!mounted || !localItem) return null;
    const lineTotal = localItem.sellingPrice * qty;
    const FallbackIcon = localItem.group === 'Drinks' ? Martini : localItem.group === 'Play' ? Gamepad2 : UtensilsCrossed;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${localItem.name} details`}>
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
            />
            <div
                className={`relative w-full sm:max-w-[480px] max-h-[88vh] sm:max-h-[90vh] flex flex-col rounded-t-[1.75rem] sm:rounded-[1.75rem] overflow-hidden transition-all duration-300 ease-out ${entered ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-0 sm:opacity-0 sm:scale-95'}`}
                style={{ background: T.surfaceSolid, border: `1px solid ${T.border}`, boxShadow: '0 -8px 60px rgba(0,0,0,0.6)' }}
            >
                <div className="sm:hidden pt-3 flex justify-center shrink-0">
                    <span className="w-10 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 z-20 p-2 rounded-full transition-colors"
                    style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.border}`, color: T.text }}
                >
                    <X size={18} />
                </button>

                <div className="relative z-10 flex-1 overflow-y-auto px-5 sm:px-6 pt-3 pb-4 scrollbar-hide">
                    {/* Hero: photo when present, else a clean neon-tinted fallback tile (never a broken box) */}
                    <div className="relative h-44 sm:h-52 rounded-2xl overflow-hidden flex items-center justify-center mb-5" style={{ background: T.imageTile, border: `1px solid ${T.border}` }}>
                        {localItem.imageUrl ? (
                            <img src={localItem.imageUrl} alt={localItem.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-2" style={{ color: T.textFaint }}>
                                <FallbackIcon size={40} strokeWidth={1.5} style={{ color: FUN_ROOF_COLORS.magenta }} />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">The Fun Roof</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: FUN_ROOF_COLORS.cyan }}>{localItem.category}</span>
                        {localItem.bestSeller && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: FUN_ROOF_COLORS.ink, background: FUN_ROOF_COLORS.lime }}>
                                <Flame size={11} className="fill-current" /> Bestseller
                            </span>
                        )}
                        {!localItem.bestSeller && localItem.tag && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: FUN_ROOF_COLORS.cyan, background: 'rgba(55,211,230,0.12)', border: `1px solid rgba(55,211,230,0.3)` }}>{localItem.tag}</span>
                        )}
                    </div>
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-extrabold leading-tight pr-2" style={{ color: T.text }}>{localItem.name}</h2>
                        <div className="font-extrabold text-xl tracking-tight shrink-0" style={{ color: FUN_ROOF_COLORS.lime }}>{peso(localItem.sellingPrice)}</div>
                    </div>
                    {localItem.serving && (
                        <p className="text-sm mt-1 font-medium" style={{ color: T.textFaint }}>{localItem.serving}</p>
                    )}
                    {localItem.description && (
                        <p className="text-sm leading-relaxed mt-3" style={{ color: T.textMuted }}>{localItem.description}</p>
                    )}

                    <div className="mt-6 flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: T.textMuted }}>Quantity</span>
                        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}` }}>
                            <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity" className="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-30 transition-colors" style={{ color: T.text }}>
                                <Minus size={16} strokeWidth={2.5} />
                            </button>
                            <span className="w-8 text-center text-base font-bold tabular-nums" aria-live="polite" style={{ color: T.text }}>{qty}</span>
                            <button type="button" onClick={() => setQty(q => q + 1)} aria-label="Increase quantity" className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors" style={{ color: T.text }}>
                                <Plus size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 shrink-0 px-5 sm:px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]" style={{ borderTop: `1px solid ${T.border}` }}>
                    <button
                        type="button"
                        onClick={() => onAdd(localItem, qty)}
                        className="w-full py-4 rounded-[1.25rem] text-white font-extrabold tracking-wide transition-all duration-200 active:scale-[0.98]"
                        style={{ background: FUN_ROOF_CTA_GRADIENT, boxShadow: '0 12px 30px -8px rgba(245,32,155,0.55)' }}
                    >
                        <span className="flex items-center justify-center gap-2">
                            Add to my picks <span className="opacity-60">·</span> <span className="tabular-nums">{peso(lineTotal)}</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FunRoofProductSheet;
