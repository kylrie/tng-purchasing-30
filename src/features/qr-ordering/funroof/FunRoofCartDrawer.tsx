import React, { useEffect, useState } from 'react';
import { X, Minus, Plus, Trash2, Sparkles, Martini, Loader2, AlertCircle } from 'lucide-react';
import { FUN_ROOF_THEME as T, FUN_ROOF_COLORS, FUN_ROOF_CTA_GRADIENT } from './funRoofTheme';
import { peso } from './funRoofFormat';
import { formatTableLabel } from '../utils/tableUtils';

/** A single local pick (lives in FunRoofMenuView state — never sent anywhere). */
export interface FunRoofPick {
    lineId: string;
    id: string;
    name: string;
    unitPrice: number;
    qty: number;
}

interface Props {
    open: boolean;
    lines: FunRoofPick[];
    tableNumber?: string;
    onClose: () => void;
    onChangeQty: (lineId: string, nextQty: number) => void;
    onRemove: (lineId: string) => void;
    onClear: () => void;
    /** When provided, enables the real "Proceed to checkout" CTA (createQrOrder). */
    onCheckout?: () => void;
    /** True while the order is being submitted — disables the CTA + shows a spinner. */
    submitting?: boolean;
    /** Diner-friendly error from a failed submit; shown above the CTA. */
    submitError?: string;
}

const LEAVE_MS = 250;

/**
 * The Fun Roof — "My picks" drawer (dark neon theme).
 *
 * A purely LOCAL shortlist the guest can build while browsing and show to a
 * server. It intentionally does NOT submit an order, take payment, or touch the
 * POS — online ordering is a deliberate future boundary (mirrors the dormant
 * checkout in the Inflatable Island module). The footer states that plainly.
 */
const FunRoofCartDrawer: React.FC<Props> = ({ open, lines, tableNumber, onClose, onChangeQty, onRemove, onClear, onCheckout, submitting = false, submitError = '' }) => {
    const [mounted, setMounted] = useState(false);
    const [entered, setEntered] = useState(false);

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

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [open, onClose]);

    if (!mounted) return null;

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const isEmpty = lines.length === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label="My picks">
            <button
                type="button"
                aria-label="Close picks"
                onClick={onClose}
                className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
            />
            <div
                className={`relative w-full sm:w-[420px] sm:max-w-[92vw] max-h-[86vh] sm:max-h-none sm:h-full flex flex-col rounded-t-[1.75rem] sm:rounded-t-none sm:rounded-l-[1.75rem] overflow-hidden transition-transform duration-300 ease-out ${entered ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'}`}
                style={{ background: T.surfaceSolid, border: `1px solid ${T.border}`, boxShadow: '0 -8px 60px rgba(0,0,0,0.6)' }}
            >
                <div className="sm:hidden pt-3 flex justify-center shrink-0">
                    <span className="w-10 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
                </div>

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl shrink-0" style={{ background: T.primarySoft, border: `1px solid ${T.border}` }}>
                            <Sparkles size={18} style={{ color: FUN_ROOF_COLORS.magenta }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold leading-tight" style={{ color: T.text }}>My picks</p>
                            <p className="text-[11px] font-semibold tracking-wide" style={{ color: FUN_ROOF_COLORS.lime }}>
                                {formatTableLabel(tableNumber)}{count > 0 ? `${tableNumber ? ' · ' : ''}${count} item${count > 1 ? 's' : ''}` : `${tableNumber ? ' · ' : ''}Nothing yet`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {!isEmpty && (
                            <button type="button" onClick={onClear} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors" style={{ color: T.textFaint }}>
                                Clear
                            </button>
                        )}
                        <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-full transition-colors" style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.border}`, color: T.text }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Items / empty */}
                <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-5 py-4 scrollbar-hide">
                    {isEmpty ? (
                        <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}` }}>
                                <Martini style={{ color: T.textFaint }} size={26} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold mb-1.5" style={{ color: T.text }}>No picks yet</h3>
                            <p className="text-xs leading-relaxed mb-6 max-w-[15rem]" style={{ color: T.textMuted }}>
                                Tap a dish or drink to add it to your shortlist.
                            </p>
                            <button type="button" onClick={onClose} className="px-6 py-2.5 font-semibold text-sm rounded-full transition-all active:scale-95" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.borderStrong}`, color: T.text }}>
                                Browse menu
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {lines.map(line => (
                                <li key={line.lineId} className="relative p-4 rounded-[1.25rem]" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}` }}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold leading-snug" style={{ color: T.text }}>{line.name}</p>
                                            <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{peso(line.unitPrice)} each</p>
                                        </div>
                                        <div className="text-right shrink-0 font-bold text-base tracking-tight" style={{ color: FUN_ROOF_COLORS.lime }}>{peso(line.unitPrice * line.qty)}</div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}` }}>
                                            <button type="button" onClick={() => onChangeQty(line.lineId, line.qty - 1)} disabled={line.qty <= 1} aria-label={`Decrease ${line.name}`} className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30 transition-colors" style={{ color: T.text }}>
                                                <Minus size={15} strokeWidth={2.5} />
                                            </button>
                                            <span className="w-7 text-center text-sm font-bold tabular-nums" style={{ color: T.text }}>{line.qty}</span>
                                            <button type="button" onClick={() => onChangeQty(line.lineId, line.qty + 1)} aria-label={`Increase ${line.name}`} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ color: T.text }}>
                                                <Plus size={15} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                        <button type="button" onClick={() => onRemove(line.lineId)} aria-label={`Remove ${line.name}`} className="p-2 rounded-lg transition-colors" style={{ color: T.textFaint }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer — totals + real checkout (createQrOrder → Xendit), same flow as Inflatable */}
                {!isEmpty && (
                    <div className="relative z-10 shrink-0 px-5 sm:px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" style={{ borderTop: `1px solid ${T.border}` }}>
                        <div className="flex items-center justify-between text-sm mb-1.5" style={{ color: T.textMuted }}>
                            <span>Subtotal</span>
                            <span className="tabular-nums">{peso(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-semibold" style={{ color: T.text }}>Total</span>
                            <span className="text-2xl font-black tracking-tight tabular-nums" style={{ color: FUN_ROOF_COLORS.lime }}>{peso(subtotal)}</span>
                        </div>
                        {submitError && (
                            <p role="alert" className="mb-3 flex items-start gap-2 text-xs font-medium rounded-xl px-3 py-2" style={{ color: '#ffd0e0', background: 'rgba(245,32,155,0.12)', border: '1px solid rgba(245,32,155,0.3)' }}>
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
                                className="w-full py-4 rounded-[1.25rem] text-white font-extrabold text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                                style={{ background: FUN_ROOF_CTA_GRADIENT, boxShadow: '0 12px 30px -8px rgba(245,32,155,0.55)' }}
                            >
                                {submitting ? (<><Loader2 size={18} className="animate-spin" /> Placing order…</>) : submitError ? 'Try again' : 'Proceed to checkout'}
                            </button>
                        ) : (
                            <button type="button" disabled title="Scan a table QR to order" className="w-full py-4 rounded-[1.25rem] font-semibold text-sm cursor-not-allowed" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, color: T.textFaint }}>
                                Scan a table QR to order
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FunRoofCartDrawer;
