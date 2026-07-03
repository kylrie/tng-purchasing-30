import React, { useState } from 'react';
import { Martini, Blend, CheckCircle2, Check, Clock, AlertTriangle, StickyNote, UtensilsCrossed } from 'lucide-react';
import { MOCK_BAR_ORDERS, BAR_LATE_THRESHOLD_MIN } from '../data/mockBar';
import type { BarOrder, BarStatus } from '../data/mockBar';

/**
 * QR Ordering — Bar Queue (Phase 1 UI prototype · MOCK ONLY)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §7 · Staff-facing bar display.
 * MOCK ONLY — no Firestore listener, no Xendit, no Functions, no backend, no
 * real order updates. Status changes move cards between lanes in local state.
 *
 * Same bright, high-contrast pattern as the Kitchen Queue, tuned for bar staff:
 * drink-only cards, a drink-focused colour system, and a "Food also in kitchen"
 * note when the order also has food. Tablet/desktop = 3 columns, mobile = stacked.
 */

type LaneKey = BarStatus;
type NextAction = BarStatus | 'served';

interface LaneConfig {
    key: LaneKey;
    title: string;
    headerBg: string;
    columnBg: string;
    cardBorder: string;
    countChip: string;
    btnClass: string;
    btnLabel: string;
    btnIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    next: NextAction;
    flagLate: boolean;
}

const LANES: LaneConfig[] = [
    {
        key: 'paid', title: 'New Drinks',
        headerBg: 'bg-cyan-600', columnBg: 'bg-cyan-50', cardBorder: 'border-cyan-200', countChip: 'bg-white/25',
        btnClass: 'bg-violet-600 hover:bg-violet-700', btnLabel: 'Start mixing', btnIcon: Blend,
        next: 'mixing', flagLate: true,
    },
    {
        key: 'mixing', title: 'Mixing · Preparing',
        headerBg: 'bg-violet-600', columnBg: 'bg-violet-50', cardBorder: 'border-violet-200', countChip: 'bg-white/25',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700', btnLabel: 'Mark ready', btnIcon: CheckCircle2,
        next: 'ready', flagLate: true,
    },
    {
        key: 'ready', title: 'Ready for Pickup',
        headerBg: 'bg-emerald-600', columnBg: 'bg-emerald-50', cardBorder: 'border-emerald-200', countChip: 'bg-white/25',
        btnClass: 'bg-slate-800 hover:bg-slate-900', btnLabel: 'Mark served', btnIcon: Check,
        next: 'served', flagLate: false,
    },
];

const OrderCard: React.FC<{
    order: BarOrder;
    lane: LaneConfig;
    onAdvance: (id: string, to: NextAction) => void;
}> = ({ order, lane, onAdvance }) => {
    const isLate = lane.flagLate && order.minutesSincePaid >= BAR_LATE_THRESHOLD_MIN;
    const BtnIcon = lane.btnIcon;

    return (
        <div className={`rounded-2xl bg-white border-2 shadow-md ${isLate ? 'border-red-400 ring-2 ring-red-200' : lane.cardBorder} p-4 md:p-5`}>
            {/* Table number + order meta */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">Table</span>
                    <span className="text-4xl md:text-5xl font-black leading-none text-slate-900">{order.tableNumber}</span>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-600">{order.orderNumber}</div>
                    <div
                        className={`mt-1 inline-flex items-center gap-1 text-sm font-bold ${isLate ? 'text-red-600' : 'text-slate-500'}`}
                        title="Time since paid"
                    >
                        <Clock size={14} strokeWidth={2.5} />{order.minutesSincePaid} min
                    </div>
                </div>
            </div>

            {isLate && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black uppercase tracking-wide">
                    <AlertTriangle size={13} strokeWidth={2.75} /> Late
                </div>
            )}

            {/* Drink items */}
            <ul className="mt-3 space-y-2.5">
                {order.lines.map((line, i) => (
                    <li key={i}>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg md:text-xl font-black text-slate-900 tabular-nums shrink-0">{line.qty}×</span>
                            <span className="text-lg md:text-xl font-semibold text-slate-800 leading-tight">{line.name}</span>
                        </div>
                        {line.note && (
                            <div className="mt-1 ml-8 inline-flex items-start gap-1.5 bg-yellow-100 border border-yellow-300 text-yellow-900 rounded-lg px-2.5 py-1 text-sm font-semibold">
                                <StickyNote size={15} strokeWidth={2.25} className="mt-0.5 shrink-0" />
                                <span className="min-w-0">{line.note}</span>
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            {/* Food-also-in-kitchen note */}
            {order.hasFoodInKitchen && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-100 border border-orange-200 text-orange-800 text-sm font-bold">
                    <UtensilsCrossed size={15} strokeWidth={2.25} className="shrink-0" />
                    Food also in kitchen
                </div>
            )}

            {/* Big action button */}
            <button
                type="button"
                onClick={() => onAdvance(order.id, lane.next)}
                className={`mt-4 w-full py-4 rounded-xl text-white text-lg font-bold flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] ${lane.btnClass}`}
            >
                <BtnIcon size={22} strokeWidth={2.5} />
                {lane.btnLabel}
            </button>
        </div>
    );
};

const BarQueueView: React.FC = () => {
    const [orders, setOrders] = useState<BarOrder[]>(MOCK_BAR_ORDERS);

    // MOCK status change — local state only, no backend / order update.
    const handleAdvance = (id: string, to: NextAction) => {
        setOrders(prev =>
            to === 'served'
                ? prev.filter(o => o.id !== id)
                : prev.map(o => (o.id === id ? { ...o, status: to } : o)),
        );
    };

    const activeCount = orders.length;

    return (
        <div className="min-h-dvh bg-slate-100 text-slate-900">
            {/* Top bar */}
            <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                            <Martini size={24} className="text-white" strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-none">Bar Queue</h1>
                            <p className="text-sm font-semibold text-slate-500 truncate">Inflatable Island Beach Club</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-slate-500 hidden sm:inline">Active</span>
                        <span className="min-w-9 h-9 px-3 rounded-full bg-slate-900 text-white text-lg font-black flex items-center justify-center tabular-nums">
                            {activeCount}
                        </span>
                    </div>
                </div>
            </header>

            {/* Lanes */}
            <main className="max-w-[1500px] mx-auto px-3 md:px-6 py-4 md:py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 md:h-[calc(100dvh-140px)]">
                    {LANES.map(lane => {
                        const laneOrders = orders.filter(o => o.status === lane.key);
                        return (
                            <section key={lane.key} className="flex flex-col min-h-0 rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200">
                                <header className={`${lane.headerBg} text-white px-4 py-3 flex items-center justify-between shrink-0`}>
                                    <h2 className="text-lg md:text-xl font-black uppercase tracking-wide">{lane.title}</h2>
                                    <span className={`min-w-8 h-8 px-2.5 rounded-full ${lane.countChip} text-white text-lg font-black flex items-center justify-center tabular-nums`}>
                                        {laneOrders.length}
                                    </span>
                                </header>
                                <div className={`flex-1 min-h-0 overflow-y-auto ${lane.columnBg} p-3 md:p-4 space-y-3 md:space-y-4`}>
                                    {laneOrders.length > 0 ? (
                                        laneOrders.map(order => (
                                            <OrderCard key={order.id} order={order} lane={lane} onAdvance={handleAdvance} />
                                        ))
                                    ) : (
                                        <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center py-10">
                                            <CheckCircle2 size={36} className="text-slate-300 mb-2" strokeWidth={1.75} />
                                            <p className="text-base font-bold text-slate-400">All clear</p>
                                            <p className="text-sm text-slate-400">No drinks in this lane</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </main>
        </div>
    );
};

export default BarQueueView;
