import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    LayoutDashboard, ListOrdered, ChefHat, Wine, Table2, History as HistoryIcon, LockKeyhole,
    AlertCircle, Loader2, LogOut, ChevronRight, X, Wifi, WifiOff, Clock, Receipt,
    CheckCircle2, StickyNote, Printer, Bluetooth, Power, RotateCcw, Zap, RefreshCw,
} from 'lucide-react';
import type { Business } from '../../procurement/types';
import { useAuth } from '../../../contexts/useAuth';
import { formatTableLabel } from '../utils/tableUtils';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { subscribeQrOrders, type OpsOrder, type OpsOrderLine } from '../services/qrOrders.service';
import { isDrinkCategory } from '../services/barOrders.service';
import {
    connectPrinter, disconnectPrinter, isPrinterConnected, printTest, printStation,
    getJobStatus, getPrintMode, setPrintMode, getPrinterIp, setPrinterIp,
    type Station, type TicketLine, type PrintMode,
} from '../services/qrPrinter.service';
import {
    subscribeBridgeStatus, subscribeOrderPrintJobs, setAutoPrint, retryPrintJob,
    isBridgeOnline, overallPrinterState,
    type BridgeStatus, type PrintJobView, type PrinterState,
} from '../services/qrPrintStatus.service';
import { updateQrOrderStatus, toUserFacingTransitionError, NEXT_STATUS } from '../services/updateOrderStatus.service';
import {
    kitchenLaneFor, attentionFor, sortRank, isActiveStatus, orderStatusPresentation,
    SOLID_CLS, type KitchenLane, type OpsColor,
} from './qrOpsStatus';
import { StatusChip, PaymentChip, AttentionBadge, AccentBar, minutesSince, elapsedLabel, clockLabel } from './OpsShared';
import { opsNavCounts } from './opsNavCounts';

/**
 * QR Operations dashboard — the staff control surface, attached under QR Hub.
 *
 * ONE live BU-scoped onSnapshot of qr_orders feeds five tabs (Overview / Live
 * Orders / Kitchen / Tables / History). Kitchen transitions persist through the
 * updateQrOrderStatus callable (never local-only). Colors carry operational
 * meaning only (see qrOpsStatus). Functional, high-contrast, dense — built so a
 * busy worker knows in ~2s what is new, late, cooking, ready, or a problem.
 */

export type OpsTab = 'overview' | 'live' | 'kitchen' | 'bar' | 'tables' | 'history';
const TABS: { key: OpsTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }[] = [
    { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { key: 'live', label: 'Live Orders', Icon: ListOrdered },
    { key: 'kitchen', label: 'Kitchen', Icon: ChefHat },
    { key: 'bar', label: 'Bar Orders', Icon: Wine },
    { key: 'tables', label: 'Tables', Icon: Table2 },
    { key: 'history', label: 'History', Icon: HistoryIcon },
];

// ── Food / drink line routing (single source: the approved menu's Drinks group) ──
// Kitchen shows FOOD lines only; Bar shows DRINK lines only. Both derive from the
// SAME live order via item.category, so one order can appear on both boards.
const foodLines = (items: OpsOrderLine[]): OpsOrderLine[] => items.filter(l => !isDrinkCategory(l.category));
const drinkLines = (items: OpsOrderLine[]): OpsOrderLine[] => items.filter(l => isDrinkCategory(l.category));

// ── Live nav-tab count badges ────────────────────────────────────────────────
interface NavCounts { awaiting: number; live: number; kitchen: number; bar: number; attention: number; }

/** The count badge for a nav tab, or null when there is nothing to show. The
 *  awaiting-payment count "lights up" amber + pulses on Live Orders (the alert a
 *  waiting order needs a human); other tabs show a neutral live workload count. */
function tabBadge(key: OpsTab, c?: NavCounts): { n: number; cls: string } | null {
    if (!c) return null;
    switch (key) {
        case 'overview':
            return c.attention > 0 ? { n: c.attention, cls: 'bg-red-600 text-white' } : null;
        case 'live':
            if (c.awaiting > 0) return { n: c.awaiting, cls: 'bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse' };
            return c.live > 0 ? { n: c.live, cls: 'bg-slate-800 text-white' } : null;
        case 'kitchen':
            return c.kitchen > 0 ? { n: c.kitchen, cls: 'bg-slate-800 text-white' } : null;
        case 'bar':
            return c.bar > 0 ? { n: c.bar, cls: 'bg-slate-800 text-white' } : null;
        default:
            return null;
    }
}

/** An OpsOrder plus the live-derived fields the views need (recomputed each tick). */
interface DerivedOrder extends OpsOrder {
    minutesInStatus: number;
    minutesSinceCreated: number;
    attention: ReturnType<typeof attentionFor>;
}

const TICK_MS = 10_000;

const QrOpsView: React.FC<{
    businesses?: Business[];
    /** Embedded mode: mount inside the unified POS operations shell — no OpsShell
     *  chrome; the POS shell owns the header + tab nav + business selection. When
     *  false (default) this is the standalone /qr-ops experience (unchanged). */
    embedded?: boolean;
    /** Business unit to scope to when embedded (the POS-selected business). */
    businessUnitId?: string;
    /** Externally-controlled active tab when embedded. */
    activeTab?: OpsTab;
    /** Tab-change callback when embedded (parent updates its nav state). */
    onNavigate?: (t: OpsTab) => void;
}> = ({ businesses, embedded = false, businessUnitId: businessUnitIdProp, activeTab, onNavigate }) => {
    const { tab: tabParam } = useParams<{ tab?: string }>();
    const navigate = useNavigate();
    const { currentUser, loading: authLoading } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();

    const tab: OpsTab = embedded
        ? (activeTab ?? 'overview')
        : ((TABS.find(t => t.key === tabParam)?.key) ?? 'overview');
    // When embedded, scope to the POS-selected business (prop). Otherwise use the
    // BusinessUnit context / signed-in user's BU (standalone /qr-ops behavior).
    const businessUnitId =
        (embedded && typeof businessUnitIdProp === 'string' && businessUnitIdProp)
            ? businessUnitIdProp
            : (selectedBusinessUnit && selectedBusinessUnit !== 'all' ? selectedBusinessUnit : currentUser?.businessId ?? '');
    // Canonical business-unit NAME from real TNG data (never hardcoded). Falls back
    // to the raw id only if the business record isn't in the accessible list.
    const businessName = businesses?.find(b => b.id === businessUnitId)?.name || businessUnitId || '—';
    const signedIn = !!currentUser;

    // ── Live subscription ──────────────────────────────────────────────────
    type ConnState = 'loading' | 'live' | 'error' | 'unauthorized';
    const [orders, setOrders] = useState<OpsOrder[]>([]);
    const [conn, setConn] = useState<ConnState>('loading');
    const [lastUpdated, setLastUpdated] = useState<number>(0);
    const [lastError, setLastError] = useState<{ code?: string; message?: string } | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Phase-1 diagnostics: the exact runtime facts needed to root-cause an OFFLINE
    // feed (surfaced in the error panel + logged), instead of silently swallowing it.
    const diagnostics = {
        businessUnitId,
        databaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined)?.trim() || '(default)',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
        uid: currentUser?.id,
        role: (currentUser as { role?: string } | null)?.role,
        errorCode: lastError?.code,
        errorMessage: lastError?.message,
    };

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
        setLastError(null);
        const unsub = subscribeQrOrders(
            businessUnitId,
            list => { setOrders(list); setConn('live'); setLastUpdated(Date.now()); setNow(Date.now()); },
            (err) => {
                const e = err as { code?: string; message?: string };
                // Real evidence for the OFFLINE trace — the exact Firestore failure +
                // the query context, so the cause is diagnosable without guessing.
                console.error('[qr-ops] live feed error', {
                    code: e?.code, message: e?.message,
                    businessUnitId,
                    databaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined)?.trim() || '(default)',
                });
                setLastError({ code: e?.code, message: e?.message });
                setConn('error');
            },
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

    // ── Live nav counts (drive the tab badges; awaiting-payment "lights up") ──
    // Shared pure helper so the standalone QR dashboard and the embedded POS shell
    // compute identical badge counts.
    const navCounts: NavCounts = useMemo(() => opsNavCounts(derived, now), [derived, now]);

    // ── Order detail selection + transition action state ───────────────────
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = derived.find(o => o.id === selectedId) ?? null;
    const [liveFilter, setLiveFilter] = useState<string>('active');

    // ── Ticket printer: Bluetooth (spare test printer) or System/window.print
    // (OS-installed XP-Q801). Both reuse existing print paths — no new bridge. ──
    const [printerOpen, setPrinterOpen] = useState(false);
    const [btConnected, setBtConnected] = useState<boolean>(() => isPrinterConnected());
    const [printMode, setPrintModeState] = useState<PrintMode>(() => getPrintMode());
    // System and Network modes need no pairing (always available); Bluetooth
    // needs an active connection.
    const printerReady = printMode === 'system' || printMode === 'qz' || btConnected;

    const openLiveWithFilter = (f: string) => { setLiveFilter(f); goTab('live'); };
    const goTab = (t: OpsTab) => { if (embedded && onNavigate) onNavigate(t); else navigate(`/qr-ops/${t}`); };

    // ── The tab content (shared by standalone + embedded renders) ──────────
    const content = conn === 'loading' ? (
        <Centered Icon={Loader2} spin title="Loading live orders…" body="Connecting to the operations feed." />
    ) : conn === 'error' ? (
        <OfflineDiagnostics diagnostics={diagnostics} onRetry={() => setReloadKey(k => k + 1)} />
    ) : tab === 'overview' ? (
        <OverviewTab orders={derived} now={now} onCount={openLiveWithFilter} onOpen={setSelectedId} goTab={goTab} />
    ) : tab === 'live' ? (
        <LiveOrdersTab orders={derived} now={now} filter={liveFilter} setFilter={setLiveFilter} onOpen={setSelectedId} />
    ) : tab === 'kitchen' ? (
        <KitchenTab orders={derived} now={now} onOpen={setSelectedId} />
    ) : tab === 'bar' ? (
        <BarTab orders={derived} now={now} onOpen={setSelectedId} />
    ) : tab === 'tables' ? (
        <TablesTab />
    ) : (
        <HistoryTab orders={derived} onOpen={setSelectedId} />
    );

    // Overlays (order detail + printer panel) — identical in both modes.
    const overlays = (
        <>
            {selected && <OrderDetailPanel order={selected} now={now} onClose={() => setSelectedId(null)}
                printerConnected={printerReady} onNeedPrinter={() => setPrinterOpen(true)} />}
            {printerOpen && <PrinterPanel mode={printMode} onModeChange={(m) => { setPrintMode(m); setPrintModeState(m); }}
                btConnected={btConnected} setBtConnected={setBtConnected} businessUnitId={businessUnitId} onClose={() => setPrinterOpen(false)} />}
        </>
    );

    // ── Embedded (inside the unified POS operations shell) ─────────────────
    // The POS shell provides the header + tab nav; here we render only a slim
    // status strip (printer + connection) and the tab content. No Exit button.
    if (embedded) {
        if (conn === 'unauthorized') {
            return (
                <div className="flex-1 flex items-center justify-center bg-slate-100">
                    <Centered Icon={LockKeyhole} title="Staff sign-in required"
                        body="Sign in with a staff account to view live orders." />
                </div>
            );
        }
        return (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-100 text-slate-900">
                <div className="flex items-center justify-end gap-2 px-3 md:px-5 py-1.5 bg-white border-b border-slate-200 shrink-0">
                    <button type="button" onClick={() => setPrinterOpen(true)} title="Printer setup"
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-bold border-2 ${printerReady ? 'bg-emerald-50 text-emerald-800 border-emerald-400' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                        <Printer size={15} strokeWidth={2.25} />
                        <span className="hidden md:inline">Printer</span>
                        <span className={`w-2 h-2 rounded-full ${printerReady ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </button>
                    <ConnBadge conn={conn} lastUpdated={lastUpdated} />
                </div>
                <main className="flex-1 min-h-0 overflow-y-auto w-full px-3 md:px-5 py-4">{content}</main>
                {overlays}
            </div>
        );
    }

    // ── Standalone (/qr-ops) — unchanged behavior ─────────────────────────
    if (conn === 'unauthorized') {
        return (
            <OpsShell tab={tab} goTab={goTab} businessName={businessName} conn={conn} lastUpdated={lastUpdated} now={now} navCounts={navCounts} onRetry={() => setReloadKey(k => k + 1)}>
                <Centered Icon={LockKeyhole} title="Staff sign-in required"
                    body="Sign in with a staff account that has a business unit selected to view QR operations." />
            </OpsShell>
        );
    }

    return (
        <OpsShell tab={tab} goTab={goTab} businessName={businessName} conn={conn} lastUpdated={lastUpdated} now={now} navCounts={navCounts}
            printerConnected={printerReady} onOpenPrinter={() => setPrinterOpen(true)} onRetry={() => setReloadKey(k => k + 1)}>
            {content}
            {overlays}
        </OpsShell>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Shell: header, tab bar, connection/last-updated indicator
// ════════════════════════════════════════════════════════════════════════════
const OpsShell: React.FC<{
    tab: OpsTab; goTab: (t: OpsTab) => void; businessName: string;
    conn: 'loading' | 'live' | 'error' | 'unauthorized'; lastUpdated: number; now: number;
    navCounts?: NavCounts; printerConnected?: boolean; onOpenPrinter?: () => void;
    onRetry: () => void; children: React.ReactNode;
}> = ({ tab, goTab, businessName, conn, lastUpdated, navCounts, printerConnected, onOpenPrinter, children }) => {
    const navigate = useNavigate();
    return (
        // Full-viewport operational surface — NO ERP shell. Neutral base (white / slate),
        // color used only for status meaning. Fills the screen edge-to-edge (KDS-style).
        <div className="min-h-dvh w-full bg-slate-100 text-slate-900 flex flex-col">
            <header className="sticky top-0 z-20 bg-white border-b-2 border-slate-200">
                <div className="w-full px-3 md:px-5 py-2 flex items-center gap-3">
                    {/* Exit Operations — the one clear way back to QR Hub (no ERP sidebar). */}
                    <button type="button" onClick={() => navigate('/qr-hub')}
                        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold">
                        <LogOut size={16} className="rotate-180" strokeWidth={2.5} />
                        <span className="hidden sm:inline">Exit Operations</span>
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">QR Operations</div>
                        <p className="text-base md:text-lg font-black tracking-tight leading-tight truncate">{businessName}</p>
                    </div>
                    {onOpenPrinter && (
                        <button type="button" onClick={onOpenPrinter} title="Printer setup"
                            className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm font-bold border-2 ${printerConnected ? 'bg-emerald-50 text-emerald-800 border-emerald-400' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                            <Printer size={16} strokeWidth={2.25} />
                            <span className="hidden md:inline">Printer</span>
                            <span className={`w-2 h-2 rounded-full ${printerConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </button>
                    )}
                    <ConnBadge conn={conn} lastUpdated={lastUpdated} />
                </div>
                <nav className="w-full px-1 md:px-3 flex gap-1 overflow-x-auto">
                    {TABS.map(t => {
                        const active = t.key === tab;
                        const badge = tabBadge(t.key, navCounts);
                        return (
                            <button key={t.key} type="button" onClick={() => goTab(t.key)}
                                className={`relative shrink-0 flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-sm font-bold border-b-[3px] transition-colors ${active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                                <t.Icon size={16} strokeWidth={2.25} /> {t.label}
                                {badge && (
                                    <span className={`ml-0.5 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-black tabular-nums leading-none ${badge.cls}`}>
                                        {badge.n}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </header>
            <main className="flex-1 w-full px-3 md:px-5 py-4">{children}</main>
        </div>
    );
};

const ConnBadge: React.FC<{ conn: string; lastUpdated: number }> = ({ conn, lastUpdated }) => {
    const time = lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    if (conn === 'error') {
        return <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-600 text-white text-xs font-black"><WifiOff size={13} /> OFFLINE</span>;
    }
    return (
        <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-400 text-xs font-black">
            <Wifi size={13} /> ONLINE <span className="hidden sm:inline font-bold text-emerald-600">· {time}</span>
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

    const countFor = (key: string): number => {
        if (key === 'all') return orders.length;
        if (key === 'active') return orders.filter(o => isActiveStatus(o.status)).length;
        if (key === 'attention') return orders.filter(o => o.attention.level !== 'none').length;
        return orders.filter(o => o.status === key).length;
    };

    return (
        <div>
            <div className="flex gap-1.5 overflow-x-auto pb-3">
                {LIVE_FILTERS.map(f => {
                    const n = countFor(f.key);
                    const isSel = filter === f.key;
                    // Awaiting payment / attention chips light up when non-empty (alert colors).
                    const alert = n > 0 && (f.key === 'AWAITING_PAYMENT' || f.key === 'attention');
                    const badgeCls = isSel ? 'bg-white/25 text-white'
                        : f.key === 'AWAITING_PAYMENT' ? 'bg-amber-500 text-white'
                        : f.key === 'attention' ? 'bg-red-600 text-white'
                        : 'bg-slate-200 text-slate-700';
                    return (
                        <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 ${isSel ? 'bg-slate-900 text-white border-slate-900' : alert ? 'bg-white text-slate-800 border-amber-400' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                            {f.label}
                            {n > 0 && <span className={`min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[11px] font-black tabular-nums leading-none ${badgeCls}`}>{n}</span>}
                        </button>
                    );
                })}
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

    // Kitchen shows FOOD work only — orders with no food line (drinks-only) live on
    // the Bar board instead. Item lines are filtered to food below.
    const byLane = (lane: KitchenLane) => orders
        .filter(o => kitchenLaneFor(o.status) === lane && foodLines(o.items).length > 0)
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
                                                {foodLines(o.items).map((l, i) => (
                                                    <li key={i}>
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="font-black tabular-nums">{l.qty}×</span>
                                                            <span className="font-semibold leading-tight">{l.name}</span>
                                                        </div>
                                                        {l.notes && <div className="ml-6 inline-flex items-start gap-1 bg-yellow-100 border border-yellow-300 text-yellow-900 rounded px-1.5 py-0.5 text-xs font-semibold"><StickyNote size={12} className="mt-0.5" />{l.notes}</div>}
                                                    </li>
                                                ))}
                                            </ul>
                                            {drinkLines(o.items).length > 0 && (
                                                <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500"><Wine size={12} /> +{drinkLines(o.items).length} drink item{drinkLines(o.items).length === 1 ? '' : 's'} at bar</div>
                                            )}
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
// Bar Board (drinks only) — beside Kitchen. Reuses the SAME live feed, the SAME
// transition callable, and the drink/food split from barOrders.service.
//
// IMPORTANT (honest limitation): an order has ONE server status. Bar and Kitchen
// therefore share it — advancing a mixed order on either board moves the whole
// order. True independent bar/kitchen progress needs a backend per-station status
// model (a Cloud Function + data-model change); it is NOT faked here.
// ════════════════════════════════════════════════════════════════════════════
const BAR_LANES: { key: KitchenLane; title: string; color: OpsColor }[] = [
    { key: 'new', title: 'New · Paid', color: orderStatusPresentation('PAID').color },
    { key: 'preparing', title: 'Preparing', color: orderStatusPresentation('IN_KITCHEN').color },
    { key: 'ready', title: 'Ready', color: orderStatusPresentation('READY').color },
    { key: 'served', title: 'Served', color: orderStatusPresentation('SERVED').color },
];

const BarTab: React.FC<{ orders: DerivedOrder[]; now: number; onOpen: (id: string) => void }> = ({ orders, now, onOpen }) => {
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string>('');

    const advance = async (o: DerivedOrder) => {
        const to = NEXT_STATUS[o.status];
        if (!to || pending[o.id]) return;
        setPending(p => ({ ...p, [o.id]: true }));
        setError('');
        try {
            await updateQrOrderStatus(o.id, to);
        } catch (e) {
            setError(toUserFacingTransitionError(e));
        } finally {
            setPending(p => ({ ...p, [o.id]: false }));
        }
    };

    // Bar shows DRINK work only — orders with no drink line never appear here.
    const byLane = (lane: KitchenLane) => orders
        .filter(o => kitchenLaneFor(o.status) === lane && drinkLines(o.items).length > 0)
        .sort((a, b) => a.statusEnteredAtMillis - b.statusEnteredAtMillis);

    return (
        <div>
            {error && (
                <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-bold">
                    <AlertCircle size={16} /> {error}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {BAR_LANES.map(lane => {
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
                                    const drinks = drinkLines(o.items);
                                    const hasFood = foodLines(o.items).length > 0;
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
                                                {drinks.map((l, i) => (
                                                    <li key={i}>
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="font-black tabular-nums">{l.qty}×</span>
                                                            <span className="font-semibold leading-tight">{l.name}</span>
                                                        </div>
                                                        {l.notes && <div className="ml-6 inline-flex items-start gap-1 bg-yellow-100 border border-yellow-300 text-yellow-900 rounded px-1.5 py-0.5 text-xs font-semibold"><StickyNote size={12} className="mt-0.5" />{l.notes}</div>}
                                                    </li>
                                                ))}
                                            </ul>
                                            {hasFood && (
                                                <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500"><ChefHat size={12} /> Food also in kitchen</div>
                                            )}
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

const OrderDetailPanel: React.FC<{ order: DerivedOrder; now: number; onClose: () => void; printerConnected: boolean; onNeedPrinter: () => void }> = ({ order: o, now, onClose, printerConnected, onNeedPrinter }) => {
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
                        <div className="flex items-baseline gap-2"><span className="text-lg font-black">{o.orderNumber}</span><span className="text-sm font-bold text-slate-500">{formatTableLabel(o.tableNumber)}</span></div>
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

                    <PrintButtons order={o} printerConnected={printerConnected} onNeedPrinter={onNeedPrinter} />

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
                            <TraceRow label="Order ID"><code className="text-xs break-all">{o.id}</code></TraceRow>
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

// ════════════════════════════════════════════════════════════════════════════
// OFFLINE diagnostics — surfaces the exact runtime evidence needed to root-cause a
// dropped live feed (Firestore error code/message + the query context), instead of
// the old opaque "feed dropped" message. Also mirrored to the console.
// ════════════════════════════════════════════════════════════════════════════
interface OpsDiagnostics {
    businessUnitId: string;
    databaseId: string;
    projectId?: string;
    uid?: string;
    role?: string;
    errorCode?: string;
    errorMessage?: string;
}

const OfflineDiagnostics: React.FC<{ diagnostics: OpsDiagnostics; onRetry: () => void }> = ({ diagnostics, onRetry }) => {
    const rows: [string, string][] = [
        ['Error code', diagnostics.errorCode || '(none reported)'],
        ['Error message', diagnostics.errorMessage || '(none reported)'],
        ['Business unit', diagnostics.businessUnitId || '(empty)'],
        ['Firestore database', diagnostics.databaseId],
        ['Project', diagnostics.projectId || '(unknown)'],
        ['Signed-in uid', diagnostics.uid || '(none)'],
        ['Role', diagnostics.role || '(none)'],
    ];
    return (
        <div className="py-12 flex flex-col items-center text-center max-w-lg mx-auto">
            <WifiOff size={30} className="text-red-500" strokeWidth={1.75} />
            <h3 className="mt-4 text-base font-black text-slate-800">Couldn’t reach live orders</h3>
            <p className="mt-1 text-sm text-slate-500">The operations feed dropped. The exact failure is below — share it if it persists.</p>
            <dl className="mt-4 w-full text-left rounded-xl border-2 border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                {rows.map(([k, v]) => (
                    <div key={k} className="px-3 py-2 flex items-start justify-between gap-3">
                        <dt className="text-xs font-bold uppercase tracking-wide text-slate-500 shrink-0">{k}</dt>
                        <dd className="text-xs font-mono text-slate-800 text-right break-all min-w-0">{v}</dd>
                    </div>
                ))}
            </dl>
            <button type="button" onClick={onRetry} className="mt-4 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-black">Retry</button>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Automatic printing (Phase 6): live status of the local Print Bridge + the
// per-BU Auto Print ON/OFF toggle. Additive — the manual modes below are unchanged.
// ════════════════════════════════════════════════════════════════════════════
const StatePill: React.FC<{ label: string; tone: 'ok' | 'bad' | 'unknown' }> = ({ label, tone }) => {
    const cls = tone === 'ok' ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
        : tone === 'bad' ? 'bg-red-100 text-red-700 border-red-300'
        : 'bg-slate-100 text-slate-500 border-slate-300';
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black border ${cls}`}>{label}</span>;
};

const StatRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-center justify-between gap-3">
        <span className="text-slate-500 font-semibold">{label}</span>
        <span className="text-right">{children}</span>
    </div>
);

const AutoPrintSection: React.FC<{ businessUnitId: string }> = ({ businessUnitId }) => {
    const [status, setStatus] = useState<BridgeStatus | null>(null);
    const [now, setNow] = useState<number>(() => Date.now());
    const [optimistic, setOptimistic] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!businessUnitId) return;
        const unsub = subscribeBridgeStatus(businessUnitId, setStatus, () => setStatus(null));
        const id = window.setInterval(() => setNow(Date.now()), 5000);
        return () => { unsub(); window.clearInterval(id); };
    }, [businessUnitId]);

    const online = isBridgeOnline(status, now);
    const printer: PrinterState = overallPrinterState(status, now);
    const reported = status?.autoPrint !== false; // default ON unless explicitly OFF
    const autoOn = optimistic !== null ? optimistic : reported;
    const lastPrint = status?.lastPrint ?? null;

    // Clear the optimistic override once the bridge's heartbeat confirms it.
    useEffect(() => { if (optimistic !== null && reported === optimistic) setOptimistic(null); }, [reported, optimistic]);

    const toggle = async () => {
        const next = !autoOn;
        setBusy(true); setErr(''); setOptimistic(next);
        try { await setAutoPrint(businessUnitId, next); }
        catch (e) { setOptimistic(null); setErr((e as Error)?.message || 'Could not change auto print.'); }
        finally { setBusy(false); }
    };

    return (
        <div className="rounded-xl border-2 border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900 text-white">
                <div className="flex items-center gap-2 font-black"><Zap size={16} /> Automatic printing</div>
                <button type="button" onClick={toggle} disabled={busy}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-black border-2 ${autoOn ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-200'} disabled:opacity-50`}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />} {autoOn ? 'ON' : 'OFF'}
                </button>
            </div>
            <div className="p-3 space-y-2 text-sm">
                <StatRow label="Bridge"><StatePill label={online ? 'ONLINE' : 'OFFLINE'} tone={online ? 'ok' : 'bad'} /></StatRow>
                <StatRow label="Printer"><StatePill label={printer} tone={printer === 'ONLINE' ? 'ok' : printer === 'OFFLINE' ? 'bad' : 'unknown'} /></StatRow>
                <StatRow label="Auto print"><StatePill label={autoOn ? 'ON' : 'OFF'} tone={autoOn ? 'ok' : 'unknown'} /></StatRow>
                <StatRow label="Last print">
                    {lastPrint ? (
                        <span className={`font-bold ${lastPrint.status === 'PRINTED' ? 'text-emerald-700' : 'text-red-600'}`}>
                            {lastPrint.station} {lastPrint.order} · {lastPrint.status} · {new Date(lastPrint.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : <span className="text-slate-400">—</span>}
                </StatRow>
                {err && <div role="alert" className="rounded bg-red-600 text-white px-2 py-1 text-xs font-bold">{err}</div>}
                {!online && (
                    <p className="text-xs text-slate-500 leading-relaxed">
                        The print bridge on the POS computer isn't reporting in — tickets won't print automatically until it's running. Use the manual buttons below meanwhile.
                    </p>
                )}
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════
// Printer: setup panel (top bar) + per-order Kitchen/Bar print buttons.
// Reuses the proven POS Bluetooth path (qrPrinter.service → POSPrinterService).
// ════════════════════════════════════════════════════════════════════════════
const PrinterPanel: React.FC<{
    mode: PrintMode; onModeChange: (m: PrintMode) => void;
    btConnected: boolean; setBtConnected: (b: boolean) => void; businessUnitId: string; onClose: () => void;
}> = ({ mode, onModeChange, btConnected, setBtConnected, businessUnitId, onClose }) => {
    const [ip, setIpLocal] = useState(() => getPrinterIp());
    const [busy, setBusy] = useState<'connect' | 'test' | null>(null);
    const [error, setError] = useState('');
    const [ok, setOk] = useState('');

    const doConnect = async () => {
        setError(''); setOk(''); setBusy('connect');
        try { await connectPrinter(); setBtConnected(true); setOk('Printer paired.'); }
        catch (e) { setBtConnected(isPrinterConnected()); setError((e as Error)?.message || 'Pairing failed.'); }
        finally { setBusy(null); }
    };
    const doTest = async () => {
        setError(''); setOk(''); setBusy('test');
        try { await printTest(); setOk(mode === 'system' ? 'Sent to system printer.' : 'Test ticket sent.'); }
        catch (e) { setError((e as Error)?.message || 'Test print failed.'); if (mode === 'bluetooth') setBtConnected(isPrinterConnected()); }
        finally { setBusy(null); }
    };
    const doDisconnect = () => { disconnectPrinter(); setBtConnected(false); setOk('Disconnected.'); setError(''); };

    const ModeBtn: React.FC<{ m: PrintMode; label: string }> = ({ m, label }) => (
        <button type="button" onClick={() => onModeChange(m)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-black border-2 ${mode === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Printer setup">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-slate-200">
                    <div className="flex items-center gap-2"><Printer size={18} /><h2 className="font-black">Ticket printer</h2></div>
                    <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-3">
                    {/* Automatic printing (Phase 6) — the headless bridge prints on PAID.
                        The manual modes below remain as a fallback / diagnostics. */}
                    <AutoPrintSection businessUnitId={businessUnitId} />

                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1.5">Manual print (fallback)</div>
                        <div className="flex gap-2">
                            <ModeBtn m="system" label="System" />
                            <ModeBtn m="qz" label="IP / Network" />
                            <ModeBtn m="bluetooth" label="Bluetooth" />
                        </div>
                    </div>

                    {error && <div role="alert" className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-bold flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
                    {ok && <div className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-bold flex items-center gap-2"><CheckCircle2 size={15} />{ok}</div>}

                    {mode === 'bluetooth' ? (
                        <>
                            <div className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 font-bold ${btConnected ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                <span className={`w-2.5 h-2.5 rounded-full ${btConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                {btConnected ? 'Printer connected' : 'No printer connected'}
                            </div>
                            <button type="button" onClick={doConnect} disabled={busy === 'connect'} className="w-full py-3 rounded-lg bg-slate-900 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                                {busy === 'connect' ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />} {btConnected ? 'Re-pair printer' : 'Pair printer'}
                            </button>
                            <button type="button" onClick={doTest} disabled={busy === 'test'} className="w-full py-3 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                                {busy === 'test' ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />} Test print
                            </button>
                            {btConnected && (
                                <button type="button" onClick={doDisconnect} className="w-full py-2.5 rounded-lg bg-white border-2 border-slate-300 text-slate-700 font-bold flex items-center justify-center gap-2">
                                    <Power size={16} /> Disconnect
                                </button>
                            )}
                            <p className="text-xs text-slate-500 leading-relaxed pt-1">
                                Web Bluetooth — Fred's spare test printer. Pairing needs a tap and resets on reload. Android/desktop Chrome or Edge only (not iPhone/iPad).
                            </p>
                        </>
                    ) : mode === 'qz' ? (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">Printer IP or Name</label>
                                <input type="text" placeholder="e.g. 192.168.1.100 or XP-Q801" 
                                    className="w-full h-11 px-3 rounded-lg border-2 border-slate-300 font-bold focus:border-slate-500 outline-none"
                                    value={ip} onChange={e => { setIpLocal(e.target.value); setPrinterIp(e.target.value); }} />
                            </div>
                            <div className="rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 mt-2">
                                Prints silently to a network IP or local printer via QZ Tray.
                            </div>
                            <button type="button" onClick={doTest} disabled={busy === 'test'} className="w-full py-3 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                                {busy === 'test' ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />} Test print
                            </button>
                            <p className="text-xs text-slate-500 leading-relaxed pt-1">
                                Requires QZ Tray to be installed and running on the device. No print dialogs.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                                Prints via the browser's print dialog to the OS-installed printer (the location's <b>XP-Q801</b>), 80mm.
                            </div>
                            <button type="button" onClick={doTest} disabled={busy === 'test'} className="w-full py-3 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                                {busy === 'test' ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />} Test print
                            </button>
                            <p className="text-xs text-slate-500 leading-relaxed pt-1">
                                Set the <b>XP-Q801</b> as the default printer and enable its driver's <b>auto-cut</b>. A print dialog appears per ticket (browser rule). Silent raw ESC/POS to :9100 needs a local bridge — a later option.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const PrintButtons: React.FC<{ order: DerivedOrder; printerConnected: boolean; onNeedPrinter: () => void }> = ({ order, printerConnected, onNeedPrinter }) => {
    const [busy, setBusy] = useState<Station | null>(null);
    const [msg, setMsg] = useState<{ station: Station; ok: boolean; text: string } | null>(null);
    const [, force] = useState(0);

    // Live AUTOMATIC-print job status for this order (the bridge). Separate from the
    // manual browser-print ledger below.
    const [autoJobs, setAutoJobs] = useState<PrintJobView[]>([]);
    const [retrying, setRetrying] = useState<Station | null>(null);
    useEffect(() => {
        const unsub = subscribeOrderPrintJobs(order.id, setAutoJobs, () => { /* status only */ });
        return () => unsub();
    }, [order.id]);
    const autoJobFor = (station: Station): PrintJobView | null => autoJobs.find(j => j.station === station) ?? null;
    const doRetry = async (station: Station, jobId: string) => {
        setRetrying(station);
        try { await retryPrintJob(jobId); } catch { /* status reflects the outcome */ } finally { setRetrying(null); }
    };

    const food = foodLines(order.items);
    const drink = drinkLines(order.items);
    const paid = order.paymentStatus === 'PAID' || (order.status !== 'AWAITING_PAYMENT' && order.status !== 'PAYMENT_FAILED');

    const run = async (station: Station, lines: OpsOrderLine[]) => {
        if (!printerConnected) { onNeedPrinter(); return; }
        const reprint = getJobStatus(order.id, station) === 'PRINTED';
        setBusy(station); setMsg(null);
        const ticketLines: TicketLine[] = lines.map(l => ({ qty: l.qty, name: l.name, note: l.notes }));
        const res = await printStation(
            { orderNumber: order.orderNumber, tableNumber: order.tableNumber, station, lines: ticketLines, paid, atMillis: order.createdAtMillis },
            order.id, { reprint },
        );
        setBusy(null);
        setMsg({ station, ok: res.ok, text: res.ok ? (reprint ? 'Reprinted' : 'Printed') : (res.error || 'Failed') });
        force(n => n + 1);
    };

    const verb = (station: Station) => {
        const s = getJobStatus(order.id, station);
        return s === 'FAILED' ? 'Retry' : s === 'PRINTED' ? 'Reprint' : 'Print';
    };

    if (food.length === 0 && drink.length === 0) return null;
    return (
        <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><Printer size={14} /> Print tickets</h3>
            <div className="grid grid-cols-2 gap-2">
                {food.length > 0 && (
                    <button type="button" onClick={() => run('KITCHEN', food)} disabled={busy === 'KITCHEN'}
                        className="py-3 rounded-lg bg-slate-900 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-60">
                        {busy === 'KITCHEN' ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />} {verb('KITCHEN')} Kitchen
                    </button>
                )}
                {drink.length > 0 && (
                    <button type="button" onClick={() => run('BAR', drink)} disabled={busy === 'BAR'}
                        className="py-3 rounded-lg bg-slate-900 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-60">
                        {busy === 'BAR' ? <Loader2 size={16} className="animate-spin" /> : <Wine size={16} />} {verb('BAR')} Bar
                    </button>
                )}
            </div>
            {!printerConnected && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><RotateCcw size={12} /> No printer connected — tap a button to open printer setup.</p>}
            {msg && <p className={`mt-2 text-xs font-bold ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.station}: {msg.text}</p>}

            {/* Automatic-print status (the bridge). Shows per station once a paid
                order has generated jobs; FAILED offers a one-tap Retry. */}
            {(autoJobFor('KITCHEN') || autoJobFor('BAR')) && (
                <div className="mt-2.5 rounded-lg border-2 border-slate-200 p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500"><Zap size={12} /> Auto-print</div>
                    {(['KITCHEN', 'BAR'] as Station[]).map(st => {
                        const j = autoJobFor(st);
                        if (!j) return null;
                        const s = j.status || 'PENDING';
                        const tone = s === 'PRINTED' ? 'ok' : s === 'FAILED' ? 'bad' : 'unknown';
                        return (
                            <div key={st} className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-slate-600">{st === 'KITCHEN' ? 'Kitchen' : 'Bar'}</span>
                                <span className="flex items-center gap-2">
                                    <StatePill label={s} tone={tone} />
                                    {s === 'FAILED' && (
                                        <button type="button" onClick={() => doRetry(st, j.id)} disabled={retrying === st}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-bold disabled:opacity-60">
                                            {retrying === st ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Retry
                                        </button>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                    {autoJobFor('KITCHEN')?.status === 'FAILED' || autoJobFor('BAR')?.status === 'FAILED' ? (
                        <p className="text-[11px] text-amber-700 font-semibold">Auto-print failed — retry, or use the manual buttons above.</p>
                    ) : null}
                </div>
            )}

            {(getJobStatus(order.id, 'KITCHEN') || getJobStatus(order.id, 'BAR')) && (
                <p className="mt-1 text-[11px] text-slate-400 tabular-nums">Manual: Kitchen {getJobStatus(order.id, 'KITCHEN') ?? '—'} · Bar {getJobStatus(order.id, 'BAR') ?? '—'}</p>
            )}
        </section>
    );
};

export default QrOpsView;
