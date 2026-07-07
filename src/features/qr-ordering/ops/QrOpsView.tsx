import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    LayoutDashboard, ListOrdered, ChefHat, Table2, History as HistoryIcon, LockKeyhole,
    AlertCircle, Loader2, ChevronLeft, ChevronRight, X, Wifi, WifiOff, Clock, Receipt,
    CheckCircle2, StickyNote,
} from 'lucide-react';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { subscribeQrOrders, type OpsOrder } from '../services/qrOrders.service';
import { updateQrOrderStatus, toUserFacingTransitionError, NEXT_STATUS } from '../services/updateOrderStatus.service';
import {
    kitchenLaneFor, attentionFor, sortRank, isActiveStatus, orderStatusPresentation,
    SOLID_CLS, type KitchenLane, type OpsColor,
} from './qrOpsStatus';
import { StatusChip, PaymentChip, AttentionBadge, AccentBar, minutesSince, elapsedLabel, clockLabel } from './OpsShared';

/**
 * QR Operations dashboard — the staff control surface, attached under QR Hub.
 *
 * ONE live BU-scoped onSnapshot of qr_orders feeds five tabs (Overview / Live
 * Orders / Kitchen / Tables / History). Kitchen transitions persist through the
 * updateQrOrderStatus callable (never local-only). Colors carry operational
 * meaning only (see qrOpsStatus). Functional, high-contrast, dense — built so a
 * busy worker knows in ~2s what is new, late, cooking, ready, or a problem.
 */

type OpsTab = 'overview' | 'live' | 'kitchen' | 'tables' | 'history';
const TABS: { key: OpsTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }[] = [
    { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { key: 'live', label: 'Live Orders', Icon: ListOrdered },
    { key: 'kitchen', label: 'Kitchen', Icon: ChefHat },
    { key: 'tables', label: 'Tables', Icon: Table2 },
    { key: 'history', label: 'History', Icon: HistoryIcon },
];

/** An OpsOrder plus the live-derived fields the views need (recomputed each tick). */
interface DerivedOrder extends OpsOrder {
    minutesInStatus: number;
    minutesSinceCreated: number;
    attention: ReturnType<typeof attentionFor>;
}

const TICK_MS = 10_000;

const QrOpsView: React.FC = () => {
    const { tab: tabParam } = useParams<{ tab?: string }>();
    const navigate = useNavigate();
    const { currentUser, loading: authLoading } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();

    const tab: OpsTab = (TABS.find(t => t.key === tabParam)?.key) ?? 'overview';
    const businessUnitId =
        selectedBusinessUnit && selectedBusinessUnit !== 'all' ? selectedBusinessUnit : currentUser?.businessId ?? '';
    const signedIn = !!currentUser;

    // ── Live subscription ──────────────────────────────────────────────────
    type ConnState = 'loading' | 'live' | 'error' | 'unauthorized';
    const [orders, setOrders] = useState<OpsOrder[]>([]);
    const [conn, setConn] = useState<ConnState>('loading');
    const [lastUpdated, setLastUpdated] = useState<number>(0);
    const [reloadKey, setReloadKey] = useState(0);

    // Ticking clock so elapsed timers + attention refresh without re-subscribing.
    const [now, setNow] = useState<number>(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        if (authLoading) { setConn('loading'); return; }
        if (!signedIn || !businessUnitId) { setConn('unauthorized'); return; }
        setConn('loading');
        const unsub = subscribeQrOrders(
            businessUnitId,
            list => { setOrders(list); setConn('live'); setLastUpdated(Date.now()); setNow(Date.now()); },
            () => setConn('error'),
        );
        return () => unsub();
    }, [authLoading, signedIn, businessUnitId, reloadKey]);

    // ── Derived orders (recomputed each snapshot / tick) ───────────────────
    const derived: DerivedOrder[] = useMemo(() => orders.map(o => {
        const minutesInStatus = minutesSince(o.statusEnteredAtMillis, now);
        return {
            ...o,
            minutesInStatus,
            minutesSinceCreated: minutesSince(o.createdAtMillis, now),
            attention: attentionFor({ status: o.status, paymentStatus: o.paymentStatus, minutesInStatus }),
        };
    }), [orders, now]);

    // ── Order detail selection + transition action state ───────────────────
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = derived.find(o => o.id === selectedId) ?? null;
    const [liveFilter, setLiveFilter] = useState<string>('active');

    const openLiveWithFilter = (f: string) => { setLiveFilter(f); goTab('live'); };
    const goTab = (t: OpsTab) => navigate(`/qr-ops/${t}`);

    // ── Non-ready gates ────────────────────────────────────────────────────
    if (conn === 'unauthorized') {
        return (
            <OpsShell tab={tab} goTab={goTab} businessUnitId={businessUnitId} conn={conn} lastUpdated={lastUpdated} now={now} onRetry={() => setReloadKey(k => k + 1)}>
                <Centered Icon={LockKeyhole} title="Staff sign-in required"
                    body="Sign in with a staff account that has a business unit selected to view QR operations." />
            </OpsShell>
        );
    }

    return (
        <OpsShell tab={tab} goTab={goTab} businessUnitId={businessUnitId} conn={conn} lastUpdated={lastUpdated} now={now} onRetry={() => setReloadKey(k => k + 1)}>
            {conn === 'loading' ? (
                <Centered Icon={Loader2} spin title="Loading live orders…" body="Connecting to the operations feed." />
            ) : conn === 'error' ? (
                <Centered Icon={AlertCircle} iconRed title="Couldn’t reach live orders"
                    body="The operations feed dropped. Check your connection and retry." onRetry={() => setReloadKey(k => k + 1)} />
            ) : tab === 'overview' ? (
                <OverviewTab orders={derived} now={now} onCount={openLiveWithFilter} onOpen={setSelectedId} goTab={goTab} />
            ) : tab === 'live' ? (
                <LiveOrdersTab orders={derived} now={now} filter={liveFilter} setFilter={setLiveFilter} onOpen={setSelectedId} />
            ) : tab === 'kitchen' ? (
                <KitchenTab orders={derived} now={now} onOpen={setSelectedId} />
            ) : tab === 'tables' ? (
                <TablesTab />
            ) : (
                <HistoryTab orders={derived} onOpen={setSelectedId} />
            )}

            {selected && <OrderDetailPanel order={selected} now={now} onClose={() => setSelectedId(null)} />}
        </OpsShell>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Shell: header, tab bar, connection/last-updated indicator
// ════════════════════════════════════════════════════════════════════════════
const OpsShell: React.FC<{
    tab: OpsTab; goTab: (t: OpsTab) => void; businessUnitId: string;
    conn: 'loading' | 'live' | 'error' | 'unauthorized'; lastUpdated: number; now: number;
    onRetry: () => void; children: React.ReactNode;
}> = ({ tab, goTab, businessUnitId, conn, lastUpdated, children }) => {
    const navigate = useNavigate();
    return (
        <div className="min-h-dvh bg-slate-100 text-slate-900">
            <header className="sticky top-0 z-20 bg-white border-b-2 border-slate-200">
                <div className="max-w-[1500px] mx-auto px-3 md:px-6 py-2.5 flex items-center gap-3">
                    <button type="button" onClick={() => navigate('/qr-hub')} aria-label="Back to QR Hub"
                        className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                        <ChevronLeft size={20} className="text-slate-700" strokeWidth={2.5} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg md:text-xl font-black tracking-tight leading-none">QR Operations</h1>
                        <p className="text-xs font-semibold text-slate-500 truncate">{businessUnitId || '—'}</p>
                    </div>
                    <ConnBadge conn={conn} lastUpdated={lastUpdated} />
                </div>
                <nav className="max-w-[1500px] mx-auto px-2 md:px-4 flex gap-1 overflow-x-auto">
                    {TABS.map(t => {
                        const active = t.key === tab;
                        return (
                            <button key={t.key} type="button" onClick={() => goTab(t.key)}
                                className={`shrink-0 flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-sm font-bold border-b-[3px] transition-colors ${active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                                <t.Icon size={16} strokeWidth={2.25} /> {t.label}
                            </button>
                        );
                    })}
                </nav>
            </header>
            <main className="max-w-[1500px] mx-auto px-3 md:px-6 py-4">{children}</main>
        </div>
    );
};

const ConnBadge: React.FC<{ conn: string; lastUpdated: number }> = ({ conn, lastUpdated }) => {
    const time = lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    if (conn === 'error') {
        return <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600 text-white text-xs font-black"><WifiOff size={13} /> OFFLINE</span>;
    }
    return (
        <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-400 text-xs font-bold">
            <Wifi size={13} /> <span className="hidden sm:inline">Live ·</span> {time}
        </span>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Overview
// ════════════════════════════════════════════════════════════════════════════
const OverviewTab: React.FC<{
    orders: DerivedOrder[]; now: number; onCount: (f: string) => void; onOpen: (id: string) => void; goTab: (t: OpsTab) => void;
}> = ({ orders, now, onCount, onOpen }) => {
    const active = orders.filter(o => isActiveStatus(o.status));
    const counts = {
        live: active.length,
        awaiting: orders.filter(o => o.status === 'AWAITING_PAYMENT').length,
        paid: orders.filter(o => o.status === 'PAID').length,
        preparing: orders.filter(o => o.status === 'IN_KITCHEN').length,
        ready: orders.filter(o => o.status === 'READY').length,
        attention: orders.filter(o => o.attention.level !== 'none').length,
    };
    const tiles: { label: string; value: number; color: OpsColor; filter: string }[] = [
        { label: 'Live orders', value: counts.live, color: 'blue', filter: 'active' },
        { label: 'Awaiting payment', value: counts.awaiting, color: 'amber', filter: 'AWAITING_PAYMENT' },
        { label: 'Paid · new', value: counts.paid, color: 'green', filter: 'PAID' },
        { label: 'Preparing', value: counts.preparing, color: 'orange', filter: 'IN_KITCHEN' },
        { label: 'Ready', value: counts.ready, color: 'green', filter: 'READY' },
        { label: 'Needs attention', value: counts.attention, color: 'red', filter: 'attention' },
    ];

    const oldestWaiting = [...active]
        .filter(o => o.status === 'AWAITING_PAYMENT' || o.status === 'PAID' || o.status === 'IN_KITCHEN' || o.status === 'READY')
        .sort((a, b) => a.statusEnteredAtMillis - b.statusEnteredAtMillis)[0];

    const alerts = orders.filter(o => o.attention.level !== 'none')
        .sort((a, b) => (a.attention.level === 'critical' ? 0 : 1) - (b.attention.level === 'critical' ? 0 : 1) || b.minutesInStatus - a.minutesInStatus);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {tiles.map(t => (
                    <button key={t.label} type="button" onClick={() => onCount(t.filter)}
                        className={`relative overflow-hidden rounded-xl border-2 bg-white p-4 text-left active:scale-[0.98] transition-transform ${t.value > 0 && t.color === 'red' ? 'border-red-500' : 'border-slate-200'}`}>
                        <AccentBar color={t.color} />
                        <div className="pl-2">
                            <div className="text-4xl font-black tabular-nums leading-none">{t.value}</div>
                            <div className="mt-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{t.label}</div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Oldest waiting */}
                <section className="rounded-xl border-2 border-slate-200 bg-white p-4">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Oldest order waiting</h2>
                    {oldestWaiting ? (
                        <button type="button" onClick={() => onOpen(oldestWaiting.id)} className="w-full text-left flex items-center gap-4">
                            <div className="shrink-0 text-center">
                                <div className="text-[11px] font-black uppercase text-slate-400">Table</div>
                                <div className="text-4xl font-black leading-none">{oldestWaiting.tableNumber}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-black">{oldestWaiting.orderNumber}</div>
                                <div className="mt-1 flex items-center gap-2 flex-wrap"><StatusChip status={oldestWaiting.status} size="sm" /></div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="inline-flex items-center gap-1 text-xl font-black tabular-nums"><Clock size={18} />{elapsedLabel(oldestWaiting.statusEnteredAtMillis, now)}</div>
                            </div>
                        </button>
                    ) : <p className="text-sm text-slate-500">No orders waiting.</p>}
                </section>

                {/* Urgent alerts */}
                <section className="rounded-xl border-2 border-slate-200 bg-white p-4">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Urgent alerts</h2>
                    {alerts.length === 0 ? (
                        <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 size={16} /> Nothing needs attention.</p>
                    ) : (
                        <ul className="space-y-2">
                            {alerts.slice(0, 6).map(o => (
                                <li key={o.id}>
                                    <button type="button" onClick={() => onOpen(o.id)}
                                        className={`w-full flex items-center gap-3 rounded-lg border-2 p-2.5 text-left ${o.attention.level === 'critical' ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'}`}>
                                        <span className="shrink-0 font-black text-lg w-10 text-center">{o.tableNumber}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-bold text-sm">{o.orderNumber}</span>
                                            <span className="block text-xs font-semibold text-slate-600">{o.attention.reason}</span>
                                        </span>
                                        <StatusChip status={o.status} size="sm" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Live Orders
// ════════════════════════════════════════════════════════════════════════════
const LIVE_FILTERS: { key: string; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
    { key: 'PAID', label: 'New / Paid' },
    { key: 'IN_KITCHEN', label: 'Preparing' },
    { key: 'READY', label: 'Ready' },
    { key: 'SERVED', label: 'Served' },
    { key: 'attention', label: 'Needs attention' },
    { key: 'all', label: 'All' },
];

const LiveOrdersTab: React.FC<{
    orders: DerivedOrder[]; now: number; filter: string; setFilter: (f: string) => void; onOpen: (id: string) => void;
}> = ({ orders, now, filter, setFilter, onOpen }) => {
    const filtered = orders.filter(o => {
        if (filter === 'all') return true;
        if (filter === 'active') return isActiveStatus(o.status);
        if (filter === 'attention') return o.attention.level !== 'none';
        return o.status === filter;
    }).sort((a, b) =>
        sortRank(a.status, a.attention.level) - sortRank(b.status, b.attention.level)
        || a.statusEnteredAtMillis - b.statusEnteredAtMillis,
    );

    return (
        <div>
            <div className="flex gap-1.5 overflow-x-auto pb-3">
                {LIVE_FILTERS.map(f => (
                    <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold border-2 ${filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                        {f.label}
                    </button>
                ))}
            </div>
            {filtered.length === 0 ? (
                <div className="py-16 text-center text-slate-500 font-semibold">No orders in this view.</div>
            ) : (
                <ul className="space-y-2">
                    {filtered.map(o => {
                        const color = orderStatusPresentation(o.status).color;
                        return (
                            <li key={o.id}>
                                <button type="button" onClick={() => onOpen(o.id)}
                                    className={`relative w-full overflow-hidden rounded-xl border-2 bg-white pl-4 pr-3 py-3 text-left flex items-center gap-3 md:gap-4 active:scale-[0.995] transition-transform ${o.attention.level === 'critical' ? 'border-red-500' : 'border-slate-200'}`}>
                                    <AccentBar color={color} />
                                    <div className="shrink-0 text-center w-12">
                                        <div className="text-[10px] font-black uppercase text-slate-400 leading-none">Table</div>
                                        <div className="text-2xl md:text-3xl font-black leading-none">{o.tableNumber}</div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black">{o.orderNumber}</span>
                                            <span className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 tabular-nums"><Clock size={13} />{elapsedLabel(o.statusEnteredAtMillis, now)}</span>
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                            <StatusChip status={o.status} size="sm" />
                                            <PaymentChip paymentStatus={o.paymentStatus} size="sm" />
                                            {o.attention.level !== 'none' && <AttentionBadge level={o.attention.level} reason={o.attention.reason} />}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-lg font-black tabular-nums">₱{o.totalAmount.toFixed(2)}</div>
                                        <div className="text-xs font-semibold text-slate-500">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</div>
                                    </div>
                                    <ChevronRight size={20} className="shrink-0 text-slate-300" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Kitchen Board (real persisted transitions)
// ════════════════════════════════════════════════════════════════════════════
// Lane colors are DERIVED from the single status vocabulary (never hardcoded) so a
// status shows the SAME color on the kitchen board as it does in Live Orders /
// Overview / History / Detail: PAID→green, IN_KITCHEN→orange, READY→green, SERVED→blue.
const LANES: { key: KitchenLane; title: string; color: OpsColor }[] = [
    { key: 'new', title: 'New · Paid', color: orderStatusPresentation('PAID').color },
    { key: 'preparing', title: 'Preparing', color: orderStatusPresentation('IN_KITCHEN').color },
    { key: 'ready', title: 'Ready', color: orderStatusPresentation('READY').color },
    { key: 'served', title: 'Served', color: orderStatusPresentation('SERVED').color },
];
const LANE_ACTION: Record<KitchenLane, { toLabel: string } | null> = {
    new: { toLabel: 'Start preparing' },
    preparing: { toLabel: 'Mark ready' },
    ready: { toLabel: 'Mark served' },
    served: { toLabel: 'Complete' },
};

const KitchenTab: React.FC<{ orders: DerivedOrder[]; now: number; onOpen: (id: string) => void }> = ({ orders, now, onOpen }) => {
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string>('');

    const advance = async (o: DerivedOrder) => {
        const to = NEXT_STATUS[o.status];
        if (!to || pending[o.id]) return;
        setPending(p => ({ ...p, [o.id]: true }));
        setError('');
        try {
            await updateQrOrderStatus(o.id, to);
            // No local state change — the live onSnapshot reflects the new status.
        } catch (e) {
            setError(toUserFacingTransitionError(e));
        } finally {
            setPending(p => ({ ...p, [o.id]: false }));
        }
    };

    const byLane = (lane: KitchenLane) => orders
        .filter(o => kitchenLaneFor(o.status) === lane)
        .sort((a, b) => a.statusEnteredAtMillis - b.statusEnteredAtMillis);

    return (
        <div>
            {error && (
                <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-bold">
                    <AlertCircle size={16} /> {error}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {LANES.map(lane => {
                    const laneOrders = byLane(lane.key);
                    const action = LANE_ACTION[lane.key];
                    return (
                        <section key={lane.key} className="flex flex-col rounded-xl overflow-hidden bg-white border-2 border-slate-200 min-h-[200px]">
                            <header className={`${SOLID_CLS[lane.color]} px-3 py-2.5 flex items-center justify-between`}>
                                <h2 className="text-base font-black uppercase tracking-wide">{lane.title}</h2>
                                <span className="min-w-7 h-7 px-2 rounded-full bg-white/25 text-white font-black flex items-center justify-center tabular-nums">{laneOrders.length}</span>
                            </header>
                            <div className="flex-1 p-2.5 space-y-2.5 bg-slate-50">
                                {laneOrders.length === 0 ? (
                                    <div className="py-10 text-center text-slate-400 text-sm font-bold">Empty</div>
                                ) : laneOrders.map(o => {
                                    const late = o.attention.level === 'critical';
                                    return (
                                        <div key={o.id} className={`rounded-lg bg-white border-2 p-3 ${late ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <button type="button" onClick={() => onOpen(o.id)} className="flex items-baseline gap-2 min-w-0 text-left">
                                                    <span className="text-[10px] font-black uppercase text-slate-400">T</span>
                                                    <span className="text-3xl font-black leading-none">{o.tableNumber}</span>
                                                </button>
                                                <div className="text-right shrink-0">
                                                    <div className="text-xs font-bold text-slate-500">{o.orderNumber}</div>
                                                    <div className={`inline-flex items-center gap-1 text-sm font-black tabular-nums ${late ? 'text-red-600' : 'text-slate-700'}`}><Clock size={13} />{clockLabel(o.statusEnteredAtMillis, now)}</div>
                                                </div>
                                            </div>
                                            <ul className="mt-2 space-y-1">
                                                {o.items.map((l, i) => (
                                                    <li key={i}>
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="font-black tabular-nums">{l.qty}×</span>
                                                            <span className="font-semibold leading-tight">{l.name}</span>
                                                        </div>
                                                        {l.notes && <div className="ml-6 inline-flex items-start gap-1 bg-yellow-100 border border-yellow-300 text-yellow-900 rounded px-1.5 py-0.5 text-xs font-semibold"><StickyNote size={12} className="mt-0.5" />{l.notes}</div>}
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="mt-2"><PaymentChip paymentStatus={o.paymentStatus} size="sm" /></div>
                                            {action && (
                                                <button type="button" onClick={() => advance(o)} disabled={pending[o.id]}
                                                    className={`mt-2.5 w-full py-3 rounded-lg text-white text-base font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 ${SOLID_CLS[lane.color]}`}>
                                                    {pending[o.id] ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} strokeWidth={2.5} />}
                                                    {action.toLabel}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Tables (reuse existing manager)
// ════════════════════════════════════════════════════════════════════════════
const TablesTab: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="rounded-xl border-2 border-slate-200 bg-white p-6 text-center">
            <Table2 size={30} className="mx-auto text-slate-500 mb-3" />
            <h2 className="text-base font-black mb-1">Table & QR management</h2>
            <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">Create tables, reveal QR tokens, and print customer QR codes in the dedicated table manager for this business.</p>
            <button type="button" onClick={() => navigate('/qr-tables/live')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-black">
                Open table manager <ChevronRight size={16} />
            </button>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// History (closed orders)
// ════════════════════════════════════════════════════════════════════════════
const HistoryTab: React.FC<{ orders: DerivedOrder[]; onOpen: (id: string) => void }> = ({ orders, onOpen }) => {
    const closed = orders.filter(o => !isActiveStatus(o.status)).sort((a, b) => b.updatedAtMillis - a.updatedAtMillis);
    return closed.length === 0 ? (
        <div className="py-16 text-center text-slate-500 font-semibold">No completed or closed orders yet.</div>
    ) : (
        <ul className="space-y-2">
            {closed.map(o => (
                <li key={o.id}>
                    <button type="button" onClick={() => onOpen(o.id)} className="relative w-full overflow-hidden rounded-xl border-2 border-slate-200 bg-white pl-4 pr-3 py-3 text-left flex items-center gap-4">
                        <AccentBar color={orderStatusPresentation(o.status).color} />
                        <div className="shrink-0 w-12 text-center"><div className="text-[10px] font-black uppercase text-slate-400">Table</div><div className="text-2xl font-black">{o.tableNumber}</div></div>
                        <div className="min-w-0 flex-1"><div className="font-black">{o.orderNumber}</div><div className="mt-1"><StatusChip status={o.status} size="sm" /></div></div>
                        <div className="shrink-0 text-right"><div className="text-base font-black tabular-nums">₱{o.totalAmount.toFixed(2)}</div><div className="text-xs text-slate-500">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</div></div>
                    </button>
                </li>
            ))}
        </ul>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Order Detail panel (full truth + real timeline)
// ════════════════════════════════════════════════════════════════════════════
interface TimelineEvent { atMillis: number; label: string; }
function buildTimeline(o: DerivedOrder): TimelineEvent[] {
    const ev: TimelineEvent[] = [];
    if (o.createdAtMillis) ev.push({ atMillis: o.createdAtMillis, label: 'Order created' });
    if (o.paidAtMillis) ev.push({ atMillis: o.paidAtMillis, label: 'Payment confirmed' });
    if (o.releasedAtMillis) ev.push({ atMillis: o.releasedAtMillis, label: 'Released to kitchen' });
    for (const h of o.statusHistory) {
        if (h.atMillis) ev.push({ atMillis: h.atMillis, label: `Status → ${orderStatusPresentation(h.status).label}` });
    }
    return ev.sort((a, b) => a.atMillis - b.atMillis);
}

const OrderDetailPanel: React.FC<{ order: DerivedOrder; now: number; onClose: () => void }> = ({ order: o, now, onClose }) => {
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [onClose]);

    const timeline = buildTimeline(o);
    const awaitingPay = o.status === 'AWAITING_PAYMENT';

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Order ${o.orderNumber} detail`}>
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b-2 border-slate-200 px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2"><span className="text-lg font-black">{o.orderNumber}</span><span className="text-sm font-bold text-slate-500">Table {o.tableNumber}</span></div>
                        <div className="text-xl font-black tabular-nums">₱{o.totalAmount.toFixed(2)}</div>
                    </div>
                    <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={18} /></button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Status grid */}
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Payment status"><PaymentChip paymentStatus={o.paymentStatus} /></Field>
                        <Field label="Order status"><StatusChip status={o.status} /></Field>
                        <Field label="Current stage">{orderStatusPresentation(o.status).label}</Field>
                        <Field label="Time in stage">{elapsedLabel(o.statusEnteredAtMillis, now)}</Field>
                    </div>

                    {o.attention.level !== 'none' && (
                        <div className={`rounded-lg border-2 p-3 ${o.attention.level === 'critical' ? 'border-red-500 bg-red-50' : 'border-amber-400 bg-amber-50'}`}>
                            <div className="flex items-center gap-2 font-black uppercase text-sm"><AlertCircle size={16} /> Needs attention</div>
                            <div className="text-sm font-semibold mt-0.5">{o.attention.reason}</div>
                        </div>
                    )}

                    {/* Items */}
                    <section>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><Receipt size={14} /> Items</h3>
                        <ul className="space-y-1.5">
                            {o.items.map((l, i) => (
                                <li key={i} className="flex items-start justify-between gap-3">
                                    <div className="min-w-0"><span className="font-black tabular-nums">{l.qty}× </span><span className="font-semibold">{l.name}</span>{l.notes && <div className="text-xs text-amber-700 font-semibold">{l.notes}</div>}</div>
                                    <span className="font-bold tabular-nums shrink-0">₱{l.subtotal.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-2 pt-2 border-t-2 border-slate-100 flex items-center justify-between"><span className="font-bold">Total</span><span className="text-lg font-black tabular-nums">₱{o.totalAmount.toFixed(2)}</span></div>
                    </section>

                    {/* Payment trace */}
                    <section>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Payment trace</h3>
                        <div className="rounded-lg border-2 border-slate-200 divide-y divide-slate-100 text-sm">
                            <TraceRow label="Payment status"><PaymentChip paymentStatus={o.paymentStatus} size="sm" /></TraceRow>
                            {o.paymentReference && <TraceRow label="Reference"><code className="text-xs break-all">{o.paymentReference}</code></TraceRow>}
                            {o.xenditPaymentSessionId && <TraceRow label="Session"><code className="text-xs break-all">{o.xenditPaymentSessionId}</code></TraceRow>}
                            {typeof o.paymentAttempt === 'number' && <TraceRow label="Attempt">{o.paymentAttempt}</TraceRow>}
                            <TraceRow label="Released to kitchen">{o.released ? 'Yes' : 'No'}</TraceRow>
                            {awaitingPay && (
                                <div className="px-3 py-2 bg-amber-50 text-amber-900 text-sm font-bold flex items-center gap-2"><AlertCircle size={15} /> No payment confirmation received</div>
                            )}
                        </div>
                    </section>

                    {/* Timeline */}
                    <section>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><Clock size={14} /> Timeline</h3>
                        {timeline.length === 0 ? (
                            <p className="text-sm text-slate-500">No recorded events yet.</p>
                        ) : (
                            <ol className="space-y-2.5">
                                {timeline.map((e, i) => (
                                    <li key={i} className="flex gap-3">
                                        <div className="shrink-0 w-14 text-right text-xs font-bold text-slate-500 tabular-nums">{new Date(e.atMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        <div className="relative pl-4 border-l-2 border-slate-200"><span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-400" /><span className="text-sm font-semibold">{e.label}</span></div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="rounded-lg border-2 border-slate-200 p-2.5">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">{label}</div>
        <div className="font-bold text-sm">{children}</div>
    </div>
);
const TraceRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="px-3 py-2 flex items-center justify-between gap-3"><span className="text-slate-500 font-semibold">{label}</span><span className="font-bold text-right min-w-0">{children}</span></div>
);

const Centered: React.FC<{
    Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    title: string; body: string; spin?: boolean; iconRed?: boolean; onRetry?: () => void;
}> = ({ Icon, title, body, spin, iconRed, onRetry }) => (
    <div className="py-20 flex flex-col items-center text-center max-w-md mx-auto">
        <Icon size={30} className={`${iconRed ? 'text-red-500' : 'text-slate-400'} ${spin ? 'animate-spin' : ''}`} strokeWidth={1.75} />
        <h3 className="mt-4 text-base font-black text-slate-800">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{body}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-black">Retry</button>}
    </div>
);

export default QrOpsView;
