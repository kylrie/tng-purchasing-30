import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    ChevronLeft, ReceiptText, Wallet, Smartphone, QrCode, CreditCard,
    ShieldCheck, Loader2, Check, AlertCircle, RefreshCw,
} from 'lucide-react';
import { MOCK_ORDER, mockOrderTotal } from '../data/mockOrder';
import { isConfigValid } from '../../../config/firebase';
import { fetchQrOrder } from '../services/getOrder.service';
import {
    createXenditSession, isPaymentsDisabledError, isSafePaymentLink,
    redirectToPaymentLink, toUserFacingSessionError,
} from '../services/createSession.service';
import { formatTableLabel } from '../utils/tableUtils';
import { readBusinessParam } from '../utils/adminBusinessParam';
import { resolveQrTransactionTheme } from '../theme/qrTransactionTheme';

/**
 * QR Ordering — Checkout (Phase 3 · createXenditSession wiring)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §4 · Visuals: docs/QR_UI_GUIDE.md
 *
 * Two modes, decided by the route param + Firebase config:
 *  - DEMO (`/checkout/demo`, or Firebase not configured): the original MOCK-ONLY
 *    prototype — the "Pay with Xendit" CTA runs a timed confirming animation then
 *    routes to the mock order-status screen. No Firebase, no Xendit, no backend.
 *  - REAL (`/checkout/{orderId}`): calls the createXenditSession callable and
 *    redirects the phone to the Xendit hosted-checkout `paymentLinkUrl`. The
 *    client never sees the Xendit secret (the link is minted server-side) and
 *    NEVER marks the order paid — payment truth comes only from the webhook.
 *
 * BRANDING: shared engine, per-venue skin. The business is resolved from
 * AUTHORITATIVE order data (order.businessUnitId), with the ?bu URL param as an
 * instant-paint hint, so the correct brand survives refresh / new tab / cold open
 * / paste (see theme/qrTransactionTheme.ts). Logic below is unchanged.
 */

const CONFIRM_MS = 1900; // demo-only confirm animation

interface PaymentMethod {
    id: string;
    name: string;
    blurb: string;
    Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    tint: string;
    color: string;
}

const METHODS: PaymentMethod[] = [
    { id: 'gcash', name: 'GCash', blurb: 'e-wallet', Icon: Wallet, tint: '#eaf2ff', color: '#1a73e8' },
    { id: 'maya', name: 'Maya', blurb: 'e-wallet', Icon: Smartphone, tint: '#eafaf0', color: '#12b76a' },
    { id: 'qrph', name: 'QRPH', blurb: 'scan to pay', Icon: QrCode, tint: '#f0fdf4', color: '#0d6e62' },
    { id: 'card', name: 'Card', blurb: 'credit / debit', Icon: CreditCard, tint: '#f1f5f9', color: '#334155' },
];

/** Normalized summary both the mock and the real read render from. */
interface CheckoutSummary {
    tableNumber: string;
    total: number;
    lines: { name: string; qty: number; unitPrice: number; note?: string }[];
    /** Venue id — drives the brand theme (authoritative when from a real order). */
    businessUnitId?: string;
}

/** Identity + summary handed over by CustomerMenuView after createQrOrder. */
interface CheckoutHandoff {
    orderId?: string;
    orderNumber?: string;
    totalAmount?: number;
    tableNumber?: string;
    qrToken?: string;
    businessUnitId?: string;
    lines?: { name: string; qty: number; unitPrice: number; note?: string }[];
}

type LoadState = 'loading' | 'ready' | 'error';

const CheckoutView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // The route's `:sessionId?` slot carries the created orderId in real checkout.
    const { sessionId: orderId } = useParams<{ sessionId?: string }>();

    const handoff = (location.state ?? null) as CheckoutHandoff | null;

    // Demo (mock) vs. real is decided from the route + config, mirroring OrderStatusView.
    const isDemo = !orderId || orderId.trim().toLowerCase() === 'demo' || !isConfigValid;

    // ── Summary source ────────────────────────────────────────────────────
    const demoSummary = useMemo<CheckoutSummary>(() => ({
        tableNumber: MOCK_ORDER.tableNumber,
        total: mockOrderTotal(MOCK_ORDER),
        lines: MOCK_ORDER.lines.map(l => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice, note: l.note })),
    }), []);

    const handoffSummary = useMemo<CheckoutSummary | null>(() => {
        if (isDemo || !handoff || typeof handoff.totalAmount !== 'number') return null;
        return {
            tableNumber: handoff.tableNumber ?? '',
            total: handoff.totalAmount,
            lines: Array.isArray(handoff.lines) ? handoff.lines : [],
            businessUnitId: handoff.businessUnitId,
        };
    }, [isDemo, handoff]);

    const [summary, setSummary] = useState<CheckoutSummary | null>(isDemo ? demoSummary : handoffSummary);
    const [loadState, setLoadState] = useState<LoadState>(isDemo || handoffSummary ? 'ready' : 'loading');
    const [reloadKey, setReloadKey] = useState(0);

    // Real checkout without a handoff (direct load / refresh) → fetch the order.
    useEffect(() => {
        if (isDemo || handoffSummary) return;
        let cancelled = false;
        setLoadState('loading');
        fetchQrOrder((orderId ?? '').trim())
            .then(order => {
                if (cancelled) return;
                setSummary({
                    tableNumber: order.tableNumber ?? '',
                    total: order.totalAmount,
                    lines: order.items.map(it => ({ name: it.productName, qty: it.quantity, unitPrice: it.unitPrice, note: it.notes })),
                    businessUnitId: order.businessUnitId,
                });
                setLoadState('ready');
            })
            .catch(() => { if (!cancelled) setLoadState('error'); });
        return () => { cancelled = true; };
    }, [isDemo, handoffSummary, orderId, reloadKey]);

    const [selected, setSelected] = useState<string>('gcash');
    const [confirming, setConfirming] = useState(false);   // demo redirect OR real session-creation in flight
    const [payError, setPayError] = useState<string>('');
    const [disabled, setDisabled] = useState(false);       // online payments switched off (no retry)
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const total = summary?.total ?? 0;

    // ── Theme (business-specific presentation) ─────────────────────────────
    const buHint = useMemo(() => readBusinessParam(location.search), [location.search]);
    const theme = useMemo(
        () => resolveQrTransactionTheme((summary?.businessUnitId?.trim()) || buHint),
        [summary?.businessUnitId, buHint],
    );

    const handlePay = async () => {
        if (confirming) return;
        setPayError('');
        setDisabled(false);

        if (isDemo) {
            // MOCK: no Xendit call — simulate the confirm delay then hand off to
            // the mock order-status screen. (Unchanged prototype behaviour.)
            setConfirming(true);
            timer.current = window.setTimeout(() => navigate('/order-status/demo'), CONFIRM_MS);
            return;
        }

        // REAL: create the session and redirect to the hosted checkout.
        setConfirming(true);
        try {
            const session = await createXenditSession((orderId ?? '').trim());
            if (!isSafePaymentLink(session.paymentLinkUrl)) {
                throw { code: 'functions/internal' };
            }
            // Leave the app for Xendit. We do NOT set any paid state — the order
            // flips to PAID only via the webhook; on return the status screen
            // reads the real (webhook) truth.
            redirectToPaymentLink(session.paymentLinkUrl);
            // Keep `confirming` true while the browser navigates away.
        } catch (err) {
            setConfirming(false);
            setDisabled(isPaymentsDisabledError(err));
            setPayError(toUserFacingSessionError(err));
        }
    };

    const goBack = () => navigate(isDemo ? `/order/${summary?.tableNumber ?? ''}` : `/order/${handoff?.qrToken ?? summary?.tableNumber ?? ''}`);

    // ── Real-order summary loading / error gates ──────────────────────────
    if (!isDemo && loadState === 'loading') {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center" role="status" aria-live="polite" style={{ background: theme.pageBackground }}>
                <Loader2 size={30} className="animate-spin" style={{ color: theme.cta }} />
                <p className="mt-4 text-base font-bold" style={{ color: theme.text }}>Loading your order…</p>
            </div>
        );
    }
    if (!isDemo && loadState === 'error') {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center" style={{ background: theme.pageBackground }}>
                <AlertCircle size={30} style={{ color: theme.tone.red.includes('rose') ? '#fb7185' : '#ef4444' }} />
                <p className="mt-4 text-base font-bold" style={{ color: theme.text }}>We couldn’t load your order</p>
                <p className="mt-1 text-sm max-w-[18rem]" style={{ color: theme.textMuted }}>Please check your connection and try again.</p>
                <button
                    type="button"
                    onClick={() => setReloadKey(k => k + 1)}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold"
                    style={{ background: theme.cta, color: theme.onCta }}
                >
                    <RefreshCw size={18} /> Try again
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-dvh relative overflow-x-hidden" style={{ background: theme.pageBackground, color: theme.text }}>
            {/* Soft top glow (matches the menu header) */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-64 -z-0"
                style={{ background: theme.topGlow }}
            />

            <div className="relative z-10 max-w-md mx-auto w-full px-5">
                {/* Header */}
                <header className="flex items-center gap-3 pt-6 pb-2">
                    <button
                        type="button"
                        onClick={goBack}
                        aria-label="Back to menu"
                        className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0 border"
                        style={{ background: theme.surface, borderColor: theme.surfaceBorder, boxShadow: theme.surfaceShadow }}
                    >
                        <ChevronLeft size={24} strokeWidth={2.25} style={{ color: theme.cta }} />
                    </button>
                    <div className="min-w-0 flex items-center gap-3">
                        {theme.logoSrc && <img src={theme.logoSrc} alt={theme.brandName} className="h-9 w-auto object-contain shrink-0" />}
                        <div className="min-w-0">
                            <h1 className="text-2xl font-extrabold tracking-tight leading-none" style={{ color: theme.isDark ? theme.text : theme.cta }}>Checkout</h1>
                            <p className="text-sm font-semibold mt-1" style={{ color: theme.primary }}>{formatTableLabel(summary?.tableNumber)}</p>
                        </div>
                    </div>
                </header>

                {/* Order summary */}
                <section className="mt-4 rounded-[20px] p-5 border" style={{ background: theme.surface, borderColor: theme.surfaceBorder, boxShadow: theme.surfaceShadow }}>
                    <div className="flex items-center gap-2 mb-4">
                        <ReceiptText size={18} style={{ color: theme.primary }} />
                        <h2 className="text-[15px] font-extrabold tracking-wide uppercase" style={{ color: theme.text }}>Order summary</h2>
                    </div>

                    <ul className="space-y-3.5">
                        {(summary?.lines ?? []).map((line, i) => (
                            <li key={i} className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[15px] leading-snug" style={{ color: theme.text }}>
                                        <span className="font-bold" style={{ color: theme.cta }}>{line.qty}×</span> {line.name}
                                    </p>
                                    {line.note && (
                                        <p className="text-[13px] mt-0.5 leading-snug" style={{ color: theme.textMuted }}>{line.note}</p>
                                    )}
                                </div>
                                <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: theme.text }}>
                                    <span className="text-xs mr-0.5" style={{ color: theme.textFaint }}>₱</span>{(line.unitPrice * line.qty).toFixed(2)}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-5 pt-4 border-t border-dashed space-y-2" style={{ borderColor: theme.surfaceBorder }}>
                        <div className="flex items-center justify-between text-sm" style={{ color: theme.textMuted }}>
                            <span>Subtotal</span>
                            <span className="tabular-nums">₱{total.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-base font-bold" style={{ color: theme.text }}>Total</span>
                            <span className="text-2xl font-extrabold tracking-tight tabular-nums" style={{ color: theme.isDark ? theme.priceAccent : theme.cta }}>
                                ₱{total.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Payment method */}
                <section className="mt-6">
                    <h2 className="text-[15px] font-extrabold tracking-wide uppercase mb-3" style={{ color: theme.text }}>Payment method</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {METHODS.map(m => {
                            const isSel = selected === m.id;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setSelected(m.id)}
                                    aria-pressed={isSel}
                                    className="relative flex flex-col gap-3 p-4 rounded-[18px] text-left transition-all duration-200 active:scale-[0.97] border"
                                    style={{
                                        background: theme.surface,
                                        borderColor: isSel ? 'transparent' : theme.surfaceBorder,
                                        boxShadow: isSel ? `inset 0 0 0 2px ${theme.primary}, 0 10px 26px -8px ${theme.primaryGlow}` : theme.surfaceShadow,
                                    }}
                                >
                                    <span
                                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: m.tint, color: m.color }}
                                    >
                                        <m.Icon size={22} strokeWidth={2} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[16px] font-bold leading-tight" style={{ color: theme.text }}>{m.name}</span>
                                        <span className="block text-[13px]" style={{ color: theme.textMuted }}>{m.blurb}</span>
                                    </span>
                                    <span
                                        className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                                        style={isSel ? { backgroundColor: theme.primary, color: theme.onPrimary } : { border: `2px solid ${theme.stepPendingBorder}` }}
                                        aria-hidden
                                    >
                                        {isSel && <Check size={15} strokeWidth={3} />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-[12px]" style={{ color: theme.textFaint }}>You’ll choose your exact payment method on the secure Xendit page.</p>
                </section>

                {/* spacer so content clears the sticky CTA */}
                <div className="h-44" />
            </div>

            {/* Sticky bottom payment CTA */}
            <div className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-sm border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ background: theme.stickyBarBg, borderColor: theme.surfaceBorder }}>
                <div className="max-w-md mx-auto">
                    {payError && (
                        <div role="alert" className={`mb-2.5 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] ${theme.tone.red}`}>
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span className="leading-snug">{payError}</span>
                        </div>
                    )}
                    <p className="flex items-center justify-center gap-1.5 text-[13px] mb-2.5" style={{ color: theme.textMuted }}>
                        <ShieldCheck size={15} className="shrink-0" style={{ color: theme.isDark ? theme.priceAccent : theme.cta }} />
                        Payment will be securely processed by Xendit
                    </p>
                    {disabled ? (
                        <button
                            type="button"
                            onClick={goBack}
                            className="w-full flex items-center justify-center gap-2.5 rounded-[20px] px-5 py-4 font-bold text-[16px] border-2 active:scale-[0.98] transition-transform duration-200"
                            style={{ color: theme.isDark ? theme.text : theme.cta, borderColor: theme.surfaceBorder }}
                        >
                            Back to menu
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handlePay}
                            disabled={confirming}
                            aria-busy={confirming}
                            className="w-full flex items-center justify-center gap-2.5 rounded-[20px] px-5 py-4 font-bold text-[16px] active:scale-[0.98] transition-transform duration-200 disabled:active:scale-100 disabled:opacity-90"
                            style={{ background: theme.ctaGradient ?? theme.cta, color: theme.onCta, boxShadow: theme.ctaShadow }}
                        >
                            {confirming ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    {payError ? 'Retrying…' : 'Connecting to Xendit…'}
                                </>
                            ) : payError ? (
                                <>
                                    <RefreshCw size={18} />
                                    Try again
                                </>
                            ) : (
                                <>
                                    Pay with Xendit
                                    <span style={{ color: theme.onCta, opacity: 0.7 }}>·</span>
                                    <span className="tabular-nums">₱{total.toFixed(2)}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Connecting overlay (demo confirm OR real redirect handoff) */}
            {confirming && (
                <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-8" role="status" aria-live="polite" style={{ background: theme.isDark ? 'rgba(11,7,19,0.7)' : 'rgba(255,255,255,0.7)' }}>
                    <div className="flex flex-col items-center text-center rounded-[24px] px-8 py-8 border" style={{ background: theme.surface, borderColor: theme.surfaceBorder, boxShadow: theme.modalShadow }}>
                        <span className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: theme.ctaSoft }}>
                            <Loader2 size={28} className="animate-spin" style={{ color: theme.cta }} />
                        </span>
                        <p className="text-base font-bold" style={{ color: theme.text }}>Connecting to Xendit</p>
                        <p className="text-sm mt-1 max-w-[15rem]" style={{ color: theme.textMuted }}>Taking you to secure payment. Please don’t close this page.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutView;
