import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChefHat, CheckCircle2, Check, Clock, AlertTriangle, StickyNote, Loader2, RefreshCw, LockKeyhole, AlertCircle } from 'lucide-react';
import { MOCK_KITCHEN_ORDERS, LATE_THRESHOLD_MIN } from '../data/mockKitchen';
import type { KitchenOrder } from '../data/mockKitchen';
import { isConfigValid } from '../../../config/firebase';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { subscribeKitchenOrders } from '../services/kitchenOrders.service';
import type { KitchenCard, KitchenLane } from '../services/kitchenOrders.service';

/**
 * QR Ordering — Kitchen Queue (Sprint 2 · real qr_orders listener)
 *
 * Spec: docs/QR_SCREEN_SPEC.md · Staff-facing kitchen display.
 *
 * `/kitchen/demo` (and local dev without Firebase) shows the mock board with
 * interactive (mock-only) status buttons. Any other session id (e.g. /kitchen/live)
 * reads REAL `qr_orders` live via a BU-scoped onSnapshot for the signed-in staff
 * user's business unit, showing only PAID kitchen work.
 *
 * The LIVE board is READ-ONLY: `qr_orders` is `write: if false` and no safe
 * kitchen-transition callable exists yet, so no status buttons are rendered live
 * (no writes). AWAITING_PAYMENT orders never appear (release only on paid —
 * Master Plan A3); until Xendit lands, the live board is legitimately empty
 * ("No paid kitchen orders yet."). No Xendit, no inventory deduction.
 */

type NextAction = KitchenLane | 'served';

interface LaneConfig {
    key: KitchenLane;
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
        key: 'paid', title: 'New · Paid',
        headerBg: 'bg-blue-600', columnBg: 'bg-blue-50', cardBorder: 'border-blue-200', countChip: 'bg-white/25',
        btnClass: 'bg-amber-500 hover:bg-amber-600', btnLabel: 'Start preparing', btnIcon: ChefHat,
        next: 'preparing', flagLate: true,
    },
    {
        key: 'preparing', title: 'Preparing',
        headerBg: 'bg-amber-600', columnBg: 'bg-amber-50', cardBorder: 'border-amber-200', countChip: 'bg-white/25',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700', btnLabel: 'Mark ready', btnIcon: CheckCircle2,
        next: 'ready', flagLate: true,
    },
    {
        key: 'ready', title: 'Ready',
        headerBg: 'bg-emerald-600', columnBg: 'bg-emerald-50', cardBorder: 'border-emerald-200', countChip: 'bg-white/25',
        btnClass: 'bg-slate-800 hover:bg-slate-900', btnLabel: 'Mark served', btnIcon: Check,
        next: 'served', flagLate: false,
    },
];

/** Adapt a mock order to the shared card shape (demo mode). */
function mockToCard(o: KitchenOrder): KitchenCard {
    return {
        id: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.tableNumber,
        lane: o.status,
        minutesSinceOrder: o.minutesSincePaid,
        createdAtMillis: 0,
        lines: o.lines,
    };
}

const OrderCard: React.FC<{
    card: KitchenCard;
    lane: LaneConfig;
    /** Interactive (mock) status buttons — demo mode only. Live board is read-only. */
    interactive: boolean;
    onAdvance?: (id: string, to: NextAction) => void;
}> = ({ card, lane, interactive, onAdvance }) => {
    const isLate = lane.flagLate && card.minutesSinceOrder >= LATE_THRESHOLD_MIN;
    const BtnIcon = lane.btnIcon;

    return (
        <div className={`rounded-2xl bg-white border-2 shadow-md ${isLate ? 'border-red-400 ring-2 ring-red-200' : lane.cardBorder} p-4 md:p-5`}>
            {/* Table number + order meta */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">Table</span>
                    <span className="text-4xl md:text-5xl font-black leading-none text-slate-900">{card.tableNumber}</span>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-600">{card.orderNumber}</div>
                    <div
                        className={`mt-1 inline-flex items-center gap-1 text-sm font-bold ${isLate ? 'text-red-600' : 'text-slate-500'}`}
                        title="Time since order"
                    >
                        <Clock size={14} strokeWidth={2.5} />{card.minutesSinceOrder} min
                    </div>
                </div>
            </div>

            {isLate && (
                <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black uppercase tracking-wide">
                        <AlertTriangle size={13} strokeWidth={2.75} /> Late
                    </span>
                </div>
            )}

            {/* Items */}
            <ul className="mt-3 space-y-2.5">
                {card.lines.map((line, i) => (
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

            {/* Big action button — mock-only, demo mode. The live board is read-only. */}
            {interactive && onAdvance && (
                <button
                    type="button"
                    onClick={() => onAdvance(card.id, lane.next)}
                    className={`mt-4 w-full py-4 rounded-xl text-white text-lg font-bold flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.98] ${lane.btnClass}`}
                >
                    <BtnIcon size={22} strokeWidth={2.5} />
                    {lane.btnLabel}
                </button>
            )}
        </div>
    );
};

type ReadState = 'loading' | 'ready' | 'error' | 'unauthorized';

const KitchenQueueView: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { currentUser, loading: authLoading } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();

    const isDemo = !sessionId || sessionId.trim().toLowerCase() === 'demo' || !isConfigValid;
    const businessUnitId =
        selectedBusinessUnit && selectedBusinessUnit !== 'all' ? selectedBusinessUnit : currentUser?.businessId ?? '';
    const signedIn = !!currentUser;

    const demoCards = useMemo(() => MOCK_KITCHEN_ORDERS.map(mockToCard), []);

    const [serverCards, setServerCards] = useState<KitchenCard[]>([]);
    const [readState, setReadState] = useState<ReadState>(isDemo ? 'ready' : 'loading');
    const [reloadKey, setReloadKey] = useState(0);

    // Local-only lane overrides + served dismissals (both modes). Never persisted.
    const [overrides, setOverrides] = useState<Record<string, KitchenLane>>({});
    const [servedIds, setServedIds] = useState<string[]>([]);

    useEffect(() => {
        if (isDemo) { setReadState('ready'); return; }
        if (authLoading) { setReadState('loading'); return; }
        if (!signedIn || !businessUnitId) { setReadState('unauthorized'); return; }

        let cancelled = false;
        setReadState('loading');
        const unsub = subscribeKitchenOrders(
            businessUnitId,
            cards => { if (!cancelled) { setServerCards(cards); setReadState('ready'); } },
            () => { if (!cancelled) setReadState('error'); },
        );
        return () => { cancelled = true; unsub(); };
    }, [isDemo, authLoading, signedIn, businessUnitId, reloadKey]);

    const handleAdvance = (id: string, to: NextAction) => {
        if (to === 'served') {
            setServedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
        } else {
            setOverrides(prev => ({ ...prev, [id]: to }));
        }
    };

    // Effective board: base cards (demo or live) minus locally-served, with
    // local lane overrides applied on top of the real status.
    const baseCards = isDemo ? demoCards : serverCards;
    const cards: KitchenCard[] = baseCards
        .filter(c => !servedIds.includes(c.id))
        .map(c => ({ ...c, lane: overrides[c.id] ?? c.lane }));

    const activeCount = cards.length;

    const header = (
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                        <ChefHat size={24} className="text-white" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-none">Kitchen Queue</h1>
                        <p className="text-sm font-semibold text-slate-500 truncate">
                            {isDemo ? 'Demo board · sample orders' : 'Live orders'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full ${isDemo ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isDemo ? 'Demo' : 'Live'}
                    </span>
                    <span className="text-sm font-bold text-slate-500 hidden sm:inline">Active</span>
                    <span className="min-w-9 h-9 px-3 rounded-full bg-slate-900 text-white text-lg font-black flex items-center justify-center tabular-nums">
                        {activeCount}
                    </span>
                </div>
            </div>
        </header>
    );

    // ── Non-ready real states ─────────────────────────────────────────────
    if (!isDemo && readState !== 'ready') {
        return (
            <div className="min-h-dvh bg-slate-100 text-slate-900">
                {header}
                <main className="max-w-[1500px] mx-auto px-4 md:px-6 py-16 flex justify-center">
                    {readState === 'loading' ? (
                        <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
                            <Loader2 size={30} className="text-slate-500 animate-spin" />
                            <p className="mt-4 text-sm font-semibold text-slate-500">Loading live orders…</p>
                        </div>
                    ) : readState === 'unauthorized' ? (
                        <KitchenMessage
                            Icon={LockKeyhole}
                            iconCls="text-slate-400"
                            title="Staff sign-in required"
                            body="Sign in with a staff account (with a business unit) to view the live kitchen queue. Use /kitchen/demo for the sample board."
                        />
                    ) : (
                        <KitchenMessage
                            Icon={AlertCircle}
                            iconCls="text-rose-400"
                            title="Couldn’t load the queue"
                            body="We couldn’t reach the live orders. Please check your connection and try again."
                            onRetry={() => setReloadKey(k => k + 1)}
                        />
                    )}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-slate-100 text-slate-900">
            {header}

            <main className="max-w-[1500px] mx-auto px-3 md:px-6 py-4 md:py-6">
                {!isDemo && cards.length === 0 ? (
                    /* Live board with no PAID kitchen orders (expected until Xendit lands). */
                    <div className="py-16 flex justify-center">
                        <KitchenMessage
                            Icon={ChefHat}
                            iconCls="text-slate-400"
                            title="No paid kitchen orders yet."
                            body="Paid orders appear here automatically once payment is confirmed. Until then, this board stays empty."
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 md:h-[calc(100dvh-140px)]">
                        {LANES.map(lane => {
                            const laneOrders = cards.filter(o => o.lane === lane.key);
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
                                                <OrderCard key={order.id} card={order} lane={lane} interactive={isDemo} onAdvance={isDemo ? handleAdvance : undefined} />
                                            ))
                                        ) : (
                                            <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center py-10">
                                                <CheckCircle2 size={36} className="text-slate-300 mb-2" strokeWidth={1.75} />
                                                <p className="text-base font-bold text-slate-400">All clear</p>
                                                <p className="text-sm text-slate-400">No orders in this lane</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

/** Centered icon + title + body (+ optional retry) for the non-ready states. */
const KitchenMessage: React.FC<{
    Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    iconCls: string;
    title: string;
    body: string;
    onRetry?: () => void;
}> = ({ Icon, iconCls, title, body, onRetry }) => (
    <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
            <Icon size={26} className={iconCls} strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-bold text-slate-700 mb-1">{title}</h3>
        <p className="text-slate-500 text-sm mb-5">{body}</p>
        {onRetry && (
            <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold active:scale-95 transition-transform"
            >
                <RefreshCw size={16} strokeWidth={2.5} /> Try again
            </button>
        )}
    </div>
);

export default KitchenQueueView;
