import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UtensilsCrossed, CheckCircle2, Loader2, Clock, ChefHat, ConciergeBell, ReceiptText, Plus } from 'lucide-react';
import { MOCK_ORDER, mockOrderTotal } from '../data/mockOrder';

/**
 * QR Ordering — Order Status (Phase 1 UI prototype)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §5 · Visuals: docs/QR_UI_GUIDE.md §2.5
 * MOCK ONLY — no Firestore listener, no Xendit redirect handling, no backend.
 *
 * Light, beach-friendly theme (matches the customer menu). Simulates the real
 * flow: a brief "Confirming payment…" state, then the status advances to a
 * live "Preparing" step with a pulsing highlight.
 */

// Timeline steps (spec §5 stepper).
const STEPS = [
    { key: 'received', label: 'Order received', sub: 'We’ve got your order' },
    { key: 'payment', label: 'Payment confirmed', sub: 'Paid online' },
    { key: 'preparing', label: 'Preparing your food', sub: 'The kitchen is on it' },
    { key: 'ready', label: 'Ready', sub: 'Ready to be served' },
    { key: 'served', label: 'Served', sub: 'Enjoy your meal!' },
] as const;

const CONFIRM_MS = 3200; // mock "confirming payment" duration

const OrderStatusView: React.FC = () => {
    const navigate = useNavigate();
    const { orderId } = useParams<{ orderId: string }>();
    const order = MOCK_ORDER;
    const total = mockOrderTotal(order);

    // Mock progression: start confirming payment, then advance to Preparing.
    const [confirming, setConfirming] = useState(true);
    const [currentStep, setCurrentStep] = useState(1); // index into STEPS

    useEffect(() => {
        const t = window.setTimeout(() => {
            setConfirming(false);
            setCurrentStep(2); // → Preparing
        }, CONFIRM_MS);
        return () => window.clearTimeout(t);
    }, [orderId]);

    const bigStatus = confirming
        ? { label: 'Confirming payment', cls: 'bg-amber-100 text-amber-700 border border-amber-200', Icon: Loader2, spin: true }
        : { label: 'Preparing', cls: 'bg-blue-100 text-blue-700 border border-blue-200', Icon: ChefHat, spin: false };

    return (
        <div className="min-h-dvh flex flex-col bg-[#ffffff] text-slate-900 selection:bg-[#ec4899]/20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-[#ffffff]/90 backdrop-blur-sm border-b border-black/[0.06]">
                <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 max-w-md mx-auto w-full">
                    <div className="p-2 bg-[#ec4899]/10 rounded-xl border border-[#ec4899]/20 shrink-0">
                        <UtensilsCrossed size={18} className="text-[#ec4899]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">Order {order.orderNumber}</p>
                        <p className="text-[11px] font-semibold text-[#ec4899] tracking-wide">Table {order.tableNumber}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-md mx-auto px-4 md:px-6 py-5 space-y-4">
                {/* Order summary + big status card */}
                <section className="relative p-5 rounded-[1.5rem] bg-white border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Order number</p>
                            <p className="text-lg font-bold text-slate-900 tracking-tight">{order.orderNumber}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Placed {order.placedAtLabel} · Table {order.tableNumber}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide ${bigStatus.cls}`}>
                            <bigStatus.Icon size={13} className={bigStatus.spin ? 'animate-spin' : ''} />
                            {bigStatus.label}
                        </span>
                    </div>

                    {/* Estimated prep time */}
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-700 bg-[#f9fafb] border border-black/[0.05] rounded-xl px-3.5 py-2.5">
                        <Clock size={15} className="text-[#ec4899] shrink-0" />
                        <span>Estimated prep time</span>
                        <span className="ml-auto font-bold text-slate-900 tabular-nums">≈ {order.estPrepMinutes} min</span>
                    </div>
                </section>

                {/* Confirming-payment mock banner (spec §5.10) */}
                {confirming && (
                    <section className="flex items-center gap-3 p-4 rounded-[1.25rem] bg-amber-50 border border-amber-200">
                        <Loader2 size={18} className="text-amber-600 animate-spin shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-amber-800">Confirming payment…</p>
                            <p className="text-[11px] text-amber-700/80">This can take a few seconds for e-wallets &amp; QRPH.</p>
                        </div>
                    </section>
                )}

                {/* Status stepper (spec §5.4–5.5) */}
                <section className="p-5 rounded-[1.5rem] bg-white border border-black/[0.05] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Order progress</p>
                    <ol className="space-y-0">
                        {STEPS.map((step, i) => {
                            const isDone = i < currentStep;
                            const isCurrent = i === currentStep;
                            const isLast = i === STEPS.length - 1;
                            const isConfirmingPayment = confirming && step.key === 'payment';

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
                                            <span className={`w-[2px] flex-1 min-h-[26px] my-1 rounded-full ${i < currentStep ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                        )}
                                    </div>

                                    {/* Label */}
                                    <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
                                        <p className={`text-sm font-semibold leading-tight ${isDone ? 'text-slate-700' : isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                                            {isConfirmingPayment ? 'Confirming payment…' : step.label}
                                            {isCurrent && !isConfirmingPayment && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#ec4899] animate-pulse align-middle" />}
                                        </p>
                                        <p className={`text-[11px] mt-0.5 ${isDone ? 'text-slate-500' : isCurrent ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {step.key === 'payment' && isDone ? `Paid online · ${order.paidAtLabel}` : step.sub}
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
                    <ul className="space-y-2.5">
                        {order.lines.map((line, i) => (
                            <li key={i} className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-800 leading-snug">
                                        <span className="text-[#ec4899] font-bold">{line.qty}×</span> {line.name}
                                    </p>
                                    {line.note && <p className="text-[11px] text-amber-700 mt-0.5">{line.note}</p>}
                                </div>
                                <span className="text-sm font-semibold text-slate-700 tabular-nums shrink-0">
                                    <span className="text-slate-400 mr-0.5 text-xs">₱</span>{(line.unitPrice * line.qty).toFixed(2)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.06]">
                        <span className="text-sm font-semibold text-slate-700">Total</span>
                        <span className="text-xl font-black tracking-tight tabular-nums text-slate-900">
                            ₱{total.toFixed(2)}
                        </span>
                    </div>
                </section>

                {/* Help / contact message (spec §5) */}
                <section className="flex items-start gap-3 p-4 rounded-[1.25rem] bg-white border border-black/[0.05]">
                    <ConciergeBell size={17} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Need help or want to change your order? Please approach our staff and mention
                        <span className="text-slate-800 font-semibold"> Table {order.tableNumber}</span> or order
                        <span className="text-slate-800 font-semibold"> {order.orderNumber}</span>.
                    </p>
                </section>

                {/* Order more (returns to the table's menu) */}
                <button
                    type="button"
                    onClick={() => navigate(`/order/${order.tableNumber}`)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-[1.25rem] bg-[#ec4899] hover:bg-[#db2777] active:scale-[0.99] text-white font-bold tracking-wide transition-all duration-200 shadow-sm"
                >
                    <Plus size={17} /> Order more
                </button>
            </main>
        </div>
    );
};

export default OrderStatusView;
