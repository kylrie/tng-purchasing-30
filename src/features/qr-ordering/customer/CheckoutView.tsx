import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ChevronLeft, ReceiptText, Wallet, Smartphone, QrCode, CreditCard,
    ShieldCheck, Loader2, Check,
} from 'lucide-react';
import { MOCK_ORDER, mockOrderTotal } from '../data/mockOrder';

/**
 * QR Ordering — Checkout (Phase 1 UI prototype · MOCK ONLY)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §4 · Visuals: docs/QR_UI_GUIDE.md
 * MOCK ONLY — no Firebase, no Xendit API, no Functions, no backend, no real
 * payment, no order creation, no webhook. The "Pay with Xendit" CTA runs a
 * timed confirming animation, then routes to the mock order-status screen.
 *
 * Light, glossy Inflatable Island theme. Mobile-first, large touch targets,
 * high daylight readability. Sticky bottom payment CTA.
 */

const PINK = '#ec4899';
const TEAL = '#0d6e62';
const CONFIRM_MS = 1900;

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

const CheckoutView: React.FC = () => {
    const navigate = useNavigate();
    // Route param is decorative in the prototype (mock data is fixed).
    useParams<{ sessionId?: string }>();

    const order = MOCK_ORDER;
    const total = mockOrderTotal(order);

    const [selected, setSelected] = useState<string>('gcash');
    const [confirming, setConfirming] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const handlePay = () => {
        if (confirming) return;
        setConfirming(true);
        // MOCK: no Xendit call — just simulate the redirect/confirm delay,
        // then hand off to the mock order-status screen.
        timer.current = window.setTimeout(() => {
            navigate('/order-status/demo');
        }, CONFIRM_MS);
    };

    const goBack = () => navigate(`/order/${order.tableNumber}`);

    return (
        <div className="min-h-dvh bg-white text-slate-800 relative overflow-x-hidden">
            {/* Soft top glow (matches the menu header) */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-64 -z-0"
                style={{
                    background:
                        'radial-gradient(90% 60% at 50% -8%, #ffd6e6 0%, rgba(255,214,230,0) 60%),' +
                        'radial-gradient(78% 55% at 90% 0%, #b9f0e2 0%, rgba(185,240,226,0) 58%),' +
                        'linear-gradient(#ffffff00, #ffffff 82%)',
                }}
            />

            <div className="relative z-10 max-w-md mx-auto w-full px-5">
                {/* Header */}
                <header className="flex items-center gap-3 pt-6 pb-2">
                    <button
                        type="button"
                        onClick={goBack}
                        aria-label="Back to menu"
                        className="w-11 h-11 rounded-full bg-white shadow-[0_6px_18px_-6px_rgba(15,23,42,0.25)] flex items-center justify-center active:scale-95 transition-transform shrink-0"
                    >
                        <ChevronLeft size={24} className="text-[#0d6e62]" strokeWidth={2.25} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-extrabold tracking-tight text-[#0d6e62] leading-none">Checkout</h1>
                        <p className="text-sm font-semibold text-[#ec4899] mt-1">Table {order.tableNumber}</p>
                    </div>
                </header>

                {/* Order summary */}
                <section className="mt-4 bg-white rounded-[20px] p-5 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.12)] border border-black/[0.04]">
                    <div className="flex items-center gap-2 mb-4">
                        <ReceiptText size={18} className="text-[#ec4899]" />
                        <h2 className="text-[15px] font-extrabold tracking-wide uppercase text-slate-800">Order summary</h2>
                    </div>

                    <ul className="space-y-3.5">
                        {order.lines.map((line, i) => (
                            <li key={i} className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[15px] text-slate-800 leading-snug">
                                        <span className="font-bold text-[#0d6e62]">{line.qty}×</span> {line.name}
                                    </p>
                                    {line.note && (
                                        <p className="text-[13px] text-slate-500 mt-0.5 leading-snug">{line.note}</p>
                                    )}
                                </div>
                                <span className="text-[15px] font-bold text-slate-800 tabular-nums shrink-0">
                                    <span className="text-slate-400 text-xs mr-0.5">₱</span>{(line.unitPrice * line.qty).toFixed(2)}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-5 pt-4 border-t border-dashed border-black/[0.1] space-y-2">
                        <div className="flex items-center justify-between text-sm text-slate-500">
                            <span>Subtotal</span>
                            <span className="tabular-nums">₱{total.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-slate-800">Total</span>
                            <span className="text-2xl font-extrabold tracking-tight tabular-nums text-[#0d6e62]">
                                ₱{total.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Payment method */}
                <section className="mt-6">
                    <h2 className="text-[15px] font-extrabold tracking-wide uppercase text-slate-800 mb-3">Payment method</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {METHODS.map(m => {
                            const isSel = selected === m.id;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setSelected(m.id)}
                                    aria-pressed={isSel}
                                    className={`relative flex flex-col gap-3 p-4 rounded-[18px] bg-white text-left transition-all duration-200 active:scale-[0.97] ${isSel
                                        ? 'shadow-[0_10px_26px_-8px_rgba(236,72,153,0.45)]'
                                        : 'border border-black/[0.08] shadow-[0_4px_14px_-6px_rgba(15,23,42,0.12)]'
                                        }`}
                                    style={isSel ? { boxShadow: `inset 0 0 0 2px ${PINK}, 0 10px 26px -8px rgba(236,72,153,0.45)` } : undefined}
                                >
                                    <span
                                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: m.tint, color: m.color }}
                                    >
                                        <m.Icon size={22} strokeWidth={2} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[16px] font-bold text-slate-800 leading-tight">{m.name}</span>
                                        <span className="block text-[13px] text-slate-500">{m.blurb}</span>
                                    </span>
                                    <span
                                        className={`absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSel ? 'text-white' : 'border-2 border-slate-300'}`}
                                        style={isSel ? { backgroundColor: PINK } : undefined}
                                        aria-hidden
                                    >
                                        {isSel && <Check size={15} strokeWidth={3} />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* spacer so content clears the sticky CTA */}
                <div className="h-40" />
            </div>

            {/* Sticky bottom payment CTA */}
            <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-t border-black/[0.06] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="max-w-md mx-auto">
                    <p className="flex items-center justify-center gap-1.5 text-[13px] text-slate-500 mb-2.5">
                        <ShieldCheck size={15} className="text-[#0d6e62] shrink-0" />
                        Payment will be securely processed by Xendit
                    </p>
                    <button
                        type="button"
                        onClick={handlePay}
                        disabled={confirming}
                        className="w-full flex items-center justify-center gap-2.5 rounded-[20px] px-5 py-4 text-white font-bold text-[16px] shadow-[0_16px_36px_-8px_rgba(13,110,98,0.55)] active:scale-[0.98] transition-transform duration-200 disabled:active:scale-100"
                        style={{ backgroundColor: TEAL }}
                    >
                        {confirming ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Confirming payment…
                            </>
                        ) : (
                            <>
                                Pay with Xendit
                                <span className="text-white/70">·</span>
                                <span className="tabular-nums">₱{total.toFixed(2)}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Confirming overlay (mock redirect) */}
            {confirming && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm px-8">
                    <div className="flex flex-col items-center text-center bg-white rounded-[24px] px-8 py-8 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.3)] border border-black/[0.05]">
                        <span className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${TEAL}14` }}>
                            <Loader2 size={28} className="animate-spin text-[#0d6e62]" />
                        </span>
                        <p className="text-base font-bold text-slate-800">Connecting to Xendit</p>
                        <p className="text-sm text-slate-500 mt-1 max-w-[15rem]">Taking you to secure payment. Please don't close this page.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutView;
