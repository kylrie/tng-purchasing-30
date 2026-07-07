import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { UtensilsCrossed, CheckCircle2, Loader2, Clock, ChefHat, ConciergeBell, ReceiptText, Plus, AlertCircle, RefreshCw, SearchX } from 'lucide-react';
import { MOCK_ORDER, mockOrderTotal } from '../data/mockOrder';
import { formatTableLabel } from '../utils/tableUtils';
import { isConfigValid } from '../../../config/firebase';
import {
    fetchQrOrder, isOrderNotFound, toUserFacingReadError, presentStatus, presentPaymentStatus,
    isXenditReturn, isPaymentPending, type StatusTone,
} from '../services/getOrder.service';
import type { GetQrOrderResult } from '../types/qrOrder.types';

/**
 * QR Ordering — Order Status (Sprint 2 · real qr_order read)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §5 · Visuals: docs/QR_UI_GUIDE.md §2.5
 *
 * Reads the diner's own order by id via the getQrOrder callable (Admin SDK
 * server-side) and shows status / table / items / totals with loading, not-found,
 * and error+retry states. The `/order-status/demo` route (and local dev without
 * Firebase configured) preserves the original mock prototype, including its
 * simulated "Confirming payment…" → "Preparing" progression. Read-only — no
 * payment, no Xendit, no kitchen writes.
 */

// Timeline steps (spec §5 stepper).
const STEPS = [
    { key: 'received', label: 'Order received', sub: 'We’ve got your order' },
    { key: 'payment', label: 'Payment confirmed', sub: 'Paid online' },
    { key: 'preparing', label: 'Preparing your food', sub: 'The kitchen is on it' },
    { key: 'ready', label: 'Ready', sub: 'Ready to be served' },
    { key: 'served', label: 'Served', sub: 'Enjoy your meal!' },
] as const;

const CONFIRM_MS = 3200; // mock "confirming payment" duration (demo only)

// Real return-from-Xendit polling: re-read getQrOrder every POLL_INTERVAL_MS for
// up to POLL_WINDOW_MS while the payment is still pending, so the webhook's PAID
// transition surfaces without a manual refresh. Bounded so we never poll forever.
const POLL_INTERVAL_MS = 2500;
const POLL_WINDOW_MS = 45000;
const POLL_TIMEOUT_MESSAGE = 'Payment may still be processing. Please ask staff if this takes too long.';

/** Identity handed over by CustomerMenuView after a real createQrOrder call.
 *  Used for an instant first paint and the "Order more" return path. */
interface OrderHandoff {
    orderId?: string;
    orderNumber?: string;
    totalAmount?: number;
    tableNumber?: string;
    qrToken?: string;
}

/** Normalized shape both the mock and the real read render from. */
interface StatusVM {
    orderNumber: string;
    tableNumber: string;
    items: { name: string; qty: number; unitPrice: number; subtotal: number; note?: string }[];
    totalAmount: number;
    badge: { label: string; cls: string; Icon: React.ComponentType<{ size?: number; className?: string }>; spin: boolean };
    /** Real payment-lifecycle chip (real read only; absent for the demo mock). */
    paymentStatus?: { label: string; cls: string };
    currentStep: number;
    confirming: boolean;
    /** Real return-flow: the bounded poll elapsed without a settled payment. */
    payTimedOut?: boolean;
    isDemo: boolean;
    estPrepMinutes?: number;
    placedAtLabel?: string;
    paidAtLabel?: string;
    orderMorePath?: string;
}

const TONE_CLS: Record<StatusTone, string> = {
    amber: 'bg-amber-100 text-amber-700 border border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    red: 'bg-red-100 text-red-700 border border-red-200',
    slate: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const TONE_ICON: Record<StatusTone, StatusVM['badge']['Icon']> = {
    amber: Clock,
    blue: ChefHat,
    emerald: CheckCircle2,
    red: AlertCircle,
    slate: Clock,
};

type ReadState = 'loading' | 'ready' | 'notfound' | 'error';

const OrderStatusView: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { orderId } = useParams<{ orderId: string }>();

    const handoff = (location.state ?? null) as OrderHandoff | null;

    // Demo/local mock vs. real read is decided from the route + config.
    const isDemo = !orderId || orderId.trim().toLowerCase() === 'demo' || !isConfigValid;

    // Did the diner just come back from the Xendit hosted checkout? Detected from
    // safe, allow-listed query params only — never trusted to mean "paid".
    const returnedFromPayment = useMemo(() => isXenditReturn(location.search), [location.search]);

    // ── Demo timeline simulation (unchanged prototype behaviour) ──────────
    const [confirming, setConfirming] = useState(isDemo);
    const [demoStep, setDemoStep] = useState(1);
    useEffect(() => {
        if (!isDemo) return;
        const t = window.setTimeout(() => {
            setConfirming(false);
            setDemoStep(2); // → Preparing
        }, CONFIRM_MS);
        return () => window.clearTimeout(t);
    }, [isDemo, orderId]);

    // ── Real read ─────────────────────────────────────────────────────────
    const [readState, setReadState] = useState<ReadState>(isDemo ? 'ready' : 'loading');
    const [order, setOrder] = useState<GetQrOrderResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);

    // ── Return-from-Xendit polling ─────────────────────────────────────────
    const [polling, setPolling] = useState(false);
    const [pollTimedOut, setPollTimedOut] = useState(false);
    const pollDeadlineRef = useRef<number | null>(null);

    useEffect(() => {
        if (isDemo) return;
        let cancelled = false;
        setReadState('loading');
        setErrorMsg('');
        // Fresh order load → reset any prior polling window.
        pollDeadlineRef.current = null;
        setPollTimedOut(false);

        fetchQrOrder((orderId ?? '').trim())
            .then(result => {
                if (cancelled) return;
                setOrder(result);
                setReadState('ready');
            })
            .catch(err => {
                if (cancelled) return;
                if (isOrderNotFound(err)) {
                    setReadState('notfound');
                    return;
                }
                setErrorMsg(toUserFacingReadError(err));
                setReadState('error');
            });
        return () => { cancelled = true; };
    }, [isDemo, orderId, reloadKey]);

    // Full retry (used by the not-found / error states) — shows the loading shell.
    const handleRetry = () => setReloadKey(k => k + 1);

    // Manual, in-place status refresh for the ready state. Anonymous diners can't
    // onSnapshot qr_orders (rules require signed-in staff), so this callable re-read
    // is the "live" mechanism — it keeps the current view and updates in place.
    const handleRefresh = () => {
        if (refreshing) return;
        setRefreshing(true);
        fetchQrOrder((orderId ?? '').trim())
            .then(result => { if (mountedRef.current) setOrder(result); })
            .catch(() => { /* keep the last-known data; the initial read already succeeded */ })
            .finally(() => { if (mountedRef.current) setRefreshing(false); });
    };

    // Poll getQrOrder while the payment is still pending (session in flight or a
    // fresh return from Xendit), for a bounded window. Stops as soon as
    // paymentStatus settles (PAID / FAILED / EXPIRED / REFUNDED) or the window
    // elapses. The webhook remains the only source of "paid" — this just re-reads
    // it. `order?.paymentStatus` in the deps means a settled read tears the poll
    // down; a still-pending read keeps the interval running unchanged.
    useEffect(() => {
        if (isDemo || readState !== 'ready' || !order) return;
        if (!isPaymentPending(order.paymentStatus, returnedFromPayment)) {
            pollDeadlineRef.current = null;
            setPolling(false);
            setPollTimedOut(false); // settled (or never applicable) → clear any timeout notice
            return;
        }
        if (pollDeadlineRef.current === null) pollDeadlineRef.current = Date.now() + POLL_WINDOW_MS;
        setPolling(true);
        setPollTimedOut(false);

        const id = window.setInterval(() => {
            if (pollDeadlineRef.current !== null && Date.now() >= pollDeadlineRef.current) {
                window.clearInterval(id);
                pollDeadlineRef.current = null;
                if (mountedRef.current) { setPolling(false); setPollTimedOut(true); }
                return;
            }
            fetchQrOrder((orderId ?? '').trim())
                .then(fresh => { if (mountedRef.current) setOrder(fresh); })
                .catch(() => { /* transient — keep last-known; retry next tick */ });
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(id);
    }, [isDemo, readState, order?.paymentStatus, returnedFromPayment, orderId]);

    // ── Build the view-model ──────────────────────────────────────────────
    const vm: StatusVM | null = (() => {
        if (isDemo) {
            const o = MOCK_ORDER;
            return {
                orderNumber: handoff?.orderNumber ?? o.orderNumber,
                tableNumber: handoff?.tableNumber ?? o.tableNumber,
                items: o.lines.map(l => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice, subtotal: l.unitPrice * l.qty, note: l.note })),
                totalAmount: typeof handoff?.totalAmount === 'number' ? handoff.totalAmount : mockOrderTotal(o),
                badge: confirming
                    ? { label: 'Confirming payment', cls: TONE_CLS.amber, Icon: Loader2, spin: true }
                    : { label: 'Preparing', cls: TONE_CLS.blue, Icon: ChefHat, spin: false },
                currentStep: demoStep,
                confirming,
                isDemo: true,
                estPrepMinutes: o.estPrepMinutes,
                placedAtLabel: o.placedAtLabel,
                paidAtLabel: o.paidAtLabel,
                orderMorePath: `/order/${handoff?.qrToken ?? o.tableNumber}`,
            };
        }
        if (readState !== 'ready' || !order) return null;
        const p = presentStatus(order.status);
        return {
            orderNumber: order.orderNumber,
            tableNumber: order.tableNumber || handoff?.tableNumber || '—',
            items: order.items.map(it => ({ name: it.productName, qty: it.quantity, unitPrice: it.unitPrice, subtotal: it.subtotal, note: it.notes })),
            totalAmount: order.totalAmount,
            // While confirming a return, show the amber "Confirming payment" chip
            // instead of the plain status badge; otherwise the real status badge.
            badge: polling
                ? { label: 'Confirming payment', cls: TONE_CLS.amber, Icon: Loader2, spin: true }
                : { label: p.label, cls: TONE_CLS[p.tone], Icon: TONE_ICON[p.tone], spin: false },
            paymentStatus: (() => { const pp = presentPaymentStatus(order.paymentStatus); return { label: pp.label, cls: TONE_CLS[pp.tone] }; })(),
            currentStep: p.step,
            confirming: polling,
            payTimedOut: pollTimedOut,
            isDemo: false,
            // Only offer "Order more" when we know the table's QR token (from the
            // submit handoff); a fresh/refreshed load has no way back to the menu.
            orderMorePath: handoff?.qrToken ? `/order/${handoff.qrToken}` : undefined,
        };
    })();

    // ── Non-ready real states ─────────────────────────────────────────────
    if (!isDemo && readState !== 'ready') {
        return (
            <StatusShell orderNumber={handoff?.orderNumber} tableNumber={handoff?.tableNumber}>
                {readState === 'loading' ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center" role="status" aria-live="polite">
                        <Loader2 size={30} className="text-[#ec4899] animate-spin" />
                        <p className="mt-4 text-sm font-semibold text-slate-600">Loading your order…</p>
                    </div>
                ) : readState === 'notfound' ? (
                    <StateCard
                        Icon={SearchX}
                        iconCls="text-slate-400"
                        title="Order not found"
                        body="We couldn’t find this order. Please double-check the link, or ask our staff for help."
                        onRetry={handleRetry}
                    />
                ) : (
                    <StateCard
                        Icon={AlertCircle}
                        iconCls="text-rose-400"
                        title="Couldn’t load your order"
                        body={errorMsg}
                        onRetry={handleRetry}
                    />
                )}
            </StatusShell>
        );
    }

    if (!vm) return null; // unreachable — demo/ready always builds a vm

    return (
        <div className="min-h-dvh flex flex-col bg-[#ffffff] text-slate-900 selection:bg-[#ec4899]/20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-[#ffffff]/90 backdrop-blur-sm border-b border-black/[0.06]">
                <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 max-w-md mx-auto w-full">
                    <div className="p-2 bg-[#ec4899]/10 rounded-xl border border-[#ec4899]/20 shrink-0">
                        <UtensilsCrossed size={18} className="text-[#ec4899]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">Order {vm.orderNumber}</p>
                        <p className="text-[11px] font-semibold text-[#ec4899] tracking-wide">{formatTableLabel(vm.tableNumber)}</p>
                    </div>
                    {!vm.isDemo && (
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            aria-busy={refreshing}
                            aria-label="Refresh order status"
                            className="shrink-0 w-11 h-11 -mr-1 flex items-center justify-center rounded-full text-[#ec4899] hover:bg-[#ec4899]/10 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} aria-hidden />
                        </button>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full max-w-md mx-auto px-4 md:px-6 py-5 space-y-4">
                {/* Order summary + big status card */}
                <section className="relative p-5 rounded-[1.5rem] bg-white border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Order number</p>
                            <p className="text-lg font-bold text-slate-900 tracking-tight">{vm.orderNumber}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {vm.placedAtLabel ? `Placed ${vm.placedAtLabel} · ` : ''}{formatTableLabel(vm.tableNumber)}
                            </p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide ${vm.badge.cls}`}>
                            <vm.badge.Icon size={13} className={vm.badge.spin ? 'animate-spin' : ''} />
                            {vm.badge.label}
                        </span>
                    </div>

                    {/* Payment status (real read only) */}
                    {vm.paymentStatus && (
                        <div className="mt-4 flex items-center gap-2 text-sm bg-[#f9fafb] border border-black/[0.05] rounded-xl px-3.5 py-2.5">
                            <span className="text-slate-500 font-semibold">Payment</span>
                            <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${vm.paymentStatus.cls}`}>
                                {vm.paymentStatus.label}
                            </span>
                        </div>
                    )}

                    {/* Estimated prep time (demo prototype only) */}
                    {vm.estPrepMinutes !== undefined && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-slate-700 bg-[#f9fafb] border border-black/[0.05] rounded-xl px-3.5 py-2.5">
                            <Clock size={15} className="text-[#ec4899] shrink-0" />
                            <span>Estimated prep time</span>
                            <span className="ml-auto font-bold text-slate-900 tabular-nums">≈ {vm.estPrepMinutes} min</span>
                        </div>
                    )}
                </section>

                {/* Confirming-payment banner: demo mock (spec §5.10) AND the real
                    return-from-Xendit poll while payment is not yet PAID. */}
                {vm.confirming && (
                    <section className="flex items-center gap-3 p-4 rounded-[1.25rem] bg-amber-50 border border-amber-200" role="status" aria-live="polite">
                        <Loader2 size={18} className="text-amber-600 animate-spin shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-amber-800">Confirming payment…</p>
                            <p className="text-[11px] text-amber-700/80">This can take a few seconds for e-wallets &amp; QRPH.</p>
                        </div>
                    </section>
                )}

                {/* Real return flow: the bounded poll elapsed without a settled
                    payment. Keep the page + the manual refresh; never assert paid. */}
                {vm.payTimedOut && (
                    <section className="flex items-start gap-3 p-4 rounded-[1.25rem] bg-slate-50 border border-slate-200" role="status" aria-live="polite">
                        <Clock size={18} className="text-slate-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-700">{POLL_TIMEOUT_MESSAGE}</p>
                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#ec4899] disabled:opacity-50"
                            >
                                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Check again
                            </button>
                        </div>
                    </section>
                )}

                {/* Status stepper (spec §5.4–5.5) */}
                <section className="p-5 rounded-[1.5rem] bg-white border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Order progress</p>
                    <ol className="space-y-0">
                        {STEPS.map((step, i) => {
                            const isDone = i < vm.currentStep;
                            const isCurrent = i === vm.currentStep;
                            const isLast = i === STEPS.length - 1;
                            const isConfirmingPayment = vm.confirming && step.key === 'payment';

                            return (
                                <li key={step.key} className="flex gap-3.5">
                                    {/* Icon + connector rail */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                                            {isDone ? (
                                                <CheckCircle2 size={22} className="text-emerald-500" />
                                            ) : isCurrent ? (
                                                <>
                                                    <span className="absolute inset-0 rounded-full bg-[#ec4899]/30 animate-ping" />
                                                    <span className="relative w-3.5 h-3.5 rounded-full bg-[#ec4899] ring-4 ring-[#ec4899]/20" />
                                                </>
                                            ) : (
                                                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                                            )}
                                        </div>
                                        {!isLast && (
                                            <span className={`w-[2px] flex-1 min-h-[26px] my-1 rounded-full ${i < vm.currentStep ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                        )}
                                    </div>

                                    {/* Label */}
                                    <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
                                        <p className={`text-sm font-semibold leading-tight ${isDone ? 'text-slate-700' : isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                                            {isConfirmingPayment ? 'Confirming payment…' : step.label}
                                            {isCurrent && !isConfirmingPayment && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#ec4899] animate-pulse align-middle" />}
                                        </p>
                                        <p className={`text-[11px] mt-0.5 ${isDone ? 'text-slate-500' : isCurrent ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {step.key === 'payment' && isDone && vm.paidAtLabel ? `Paid online · ${vm.paidAtLabel}` : step.sub}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                {/* Items summary (spec §5.9) */}
                <section className="p-5 rounded-[1.5rem] bg-white border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2 mb-3">
                        <ReceiptText size={15} className="text-[#ec4899]" />
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Your order</p>
                    </div>
                    {vm.items.length === 0 ? (
                        <p className="text-sm text-slate-400">No items on this order.</p>
                    ) : (
                        <ul className="space-y-2.5">
                            {vm.items.map((line, i) => (
                                <li key={i} className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm text-slate-800 leading-snug">
                                            <span className="text-[#ec4899] font-bold">{line.qty}×</span> {line.name}
                                        </p>
                                        {line.note && <p className="text-[11px] text-amber-700 mt-0.5">{line.note}</p>}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 tabular-nums shrink-0">
                                        <span className="text-slate-400 mr-0.5 text-xs">₱</span>{line.subtotal.toFixed(2)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.06]">
                        <span className="text-sm font-semibold text-slate-700">Total</span>
                        <span className="text-xl font-black tracking-tight tabular-nums text-slate-900">
                            ₱{vm.totalAmount.toFixed(2)}
                        </span>
                    </div>
                </section>

                {/* Help / contact message (spec §5) */}
                <section className="flex items-start gap-3 p-4 rounded-[1.25rem] bg-white border border-black/[0.05]">
                    <ConciergeBell size={17} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Need help or want to change your order? Please approach our staff and mention
                        <span className="text-slate-800 font-semibold"> {formatTableLabel(vm.tableNumber)}</span> or order
                        <span className="text-slate-800 font-semibold"> {vm.orderNumber}</span>.
                    </p>
                </section>

                {/* Order more (returns to the table's menu) */}
                {vm.orderMorePath && (
                    <button
                        type="button"
                        onClick={() => navigate(vm.orderMorePath!)}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-[1.25rem] bg-[#ec4899] hover:bg-[#db2777] active:scale-[0.99] text-white font-bold tracking-wide transition-all duration-200 shadow-sm"
                    >
                        <Plus size={17} /> Order more
                    </button>
                )}
            </main>
        </div>
    );
};

/** Minimal header + centered-content shell reused by the loading/not-found/error states. */
const StatusShell: React.FC<{ orderNumber?: string; tableNumber?: string; children: React.ReactNode }> = ({ orderNumber, tableNumber, children }) => (
    <div className="min-h-dvh flex flex-col bg-[#ffffff] text-slate-900">
        <header className="sticky top-0 z-30 bg-[#ffffff]/90 backdrop-blur-sm border-b border-black/[0.06]">
            <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 max-w-md mx-auto w-full">
                <div className="p-2 bg-[#ec4899]/10 rounded-xl border border-[#ec4899]/20 shrink-0">
                    <UtensilsCrossed size={18} className="text-[#ec4899]" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{orderNumber ? `Order ${orderNumber}` : 'Order status'}</p>
                    {tableNumber && <p className="text-[11px] font-semibold text-[#ec4899] tracking-wide">{formatTableLabel(tableNumber)}</p>}
                </div>
            </div>
        </header>
        <main className="flex-1 w-full max-w-md mx-auto px-4 md:px-6 py-5">{children}</main>
    </div>
);

/** Centered icon + title + body + retry, shared by the not-found and error states. */
const StateCard: React.FC<{
    Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    iconCls: string;
    title: string;
    body: string;
    onRetry: () => void;
}> = ({ Icon, iconCls, title, body, onRetry }) => (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
            <Icon size={26} className={iconCls} strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-bold text-slate-700 mb-1">{title}</h3>
        <p className="text-slate-400 text-sm max-w-[18rem] mb-5">{body}</p>
        <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-[0_8px_20px_-4px_rgba(239,78,140,0.45)] active:scale-95 transition-transform"
            style={{ backgroundColor: '#ec4899' }}
        >
            <RefreshCw size={16} strokeWidth={2.5} /> Try again
        </button>
    </div>
);

export default OrderStatusView;
