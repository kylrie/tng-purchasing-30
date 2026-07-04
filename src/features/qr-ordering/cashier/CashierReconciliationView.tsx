import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Wallet, AlertTriangle, CheckCircle2, Clock, Receipt, Info, Check, Search,
    Loader2, RefreshCw, LockKeyhole, AlertCircle,
} from 'lucide-react';
import { MOCK_PAID_ORDERS } from '../data/mockReconciliation';
import type { PaidOrder } from '../data/mockReconciliation';
import { isConfigValid } from '../../../config/firebase';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { subscribeCashierOrders, postOfficialInvoice, toUserFacingPostError } from '../services/cashierOrders.service';
import type { CashierOrder } from '../services/cashierOrders.service';

/**
 * QR Ordering — Cashier Reconciliation (Sprint 2 · Phase 3.5)
 *
 * Spec: docs/QR_SCREEN_SPEC.md · Staff-facing reconciliation dashboard.
 *
 * `/cashier/demo` (and local dev without Firebase) shows the mock board. Any
 * other session id reads REAL paid/completed `qr_orders` live (BU-scoped
 * onSnapshot) and posts the registered-POS official invoice number via the
 * postOfficialInvoice callable, which audit-stamps postedBy/postedAt server-side.
 *
 * BUSINESS RULE (A4): TNG does NOT issue official BIR invoices. This screen only
 * records the number the registered POS issued. No official invoice generation,
 * no POS sync, no Xendit.
 */

const PESO = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type FilterKey = 'all' | 'unreconciled' | 'reconciled';

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unreconciled', label: 'Unreconciled' },
    { key: 'reconciled', label: 'Reconciled' },
];

const METHOD_STYLE: Record<string, string> = {
    GCash: 'bg-blue-100 text-blue-700',
    Maya: 'bg-emerald-100 text-emerald-700',
    QRPH: 'bg-teal-100 text-teal-700',
    Card: 'bg-slate-200 text-slate-700',
};

/** Unified row rendered from either mock or live data. */
interface CashierRow {
    id: string;
    orderNumber: string;
    tableNumber: string;
    totalAmount: number;
    reconciled: boolean;
    invoiceNumber: string;
    paymentMethod?: string; // demo only
    xenditRef?: string;     // demo only
    paidAtLabel?: string;   // demo only
    auditLabel?: string;    // live: "Posted by … · <time>"
}

function demoToRow(o: PaidOrder): CashierRow {
    return {
        id: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.tableNumber,
        totalAmount: o.totalAmount,
        reconciled: o.status === 'reconciled',
        invoiceNumber: o.invoiceNumber,
        paymentMethod: o.paymentMethod,
        xenditRef: o.xenditRef,
        paidAtLabel: o.paidAtLabel,
    };
}

function liveToRow(o: CashierOrder, myUid?: string, myName?: string): CashierRow {
    let auditLabel: string | undefined;
    if (o.reconciled) {
        const who = o.postedBy && o.postedBy === myUid ? (myName || 'you') : (o.postedBy || 'staff');
        const when = o.postedAtMillis ? ` · ${new Date(o.postedAtMillis).toLocaleString()}` : '';
        auditLabel = `Posted by ${who}${when}`;
    }
    return {
        id: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.tableNumber,
        totalAmount: o.totalAmount,
        reconciled: o.reconciled,
        invoiceNumber: o.officialInvoiceNumber,
        auditLabel,
    };
}

const KpiCard: React.FC<{
    label: string; value: string; Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    accent: string; iconBg: string;
}> = ({ label, value, Icon, accent, iconBg }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
            <Icon size={23} className={accent} strokeWidth={2.25} />
        </div>
        <p className="text-sm font-semibold text-slate-500 leading-tight mt-3">{label}</p>
        <p className="text-2xl md:text-3xl font-black text-slate-900 leading-tight tabular-nums mt-0.5">{value}</p>
    </div>
);

type ReadState = 'loading' | 'ready' | 'error' | 'unauthorized';

const CashierReconciliationView: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { currentUser, loading: authLoading } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();

    const isDemo = !sessionId || sessionId.trim().toLowerCase() === 'demo' || !isConfigValid;
    const businessUnitId =
        selectedBusinessUnit && selectedBusinessUnit !== 'all' ? selectedBusinessUnit : currentUser?.businessId ?? '';
    const signedIn = !!currentUser;

    const [filter, setFilter] = useState<FilterKey>('all');
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    // Demo rows live in local state (mock flip); live rows come from the listener.
    const [demoOrders, setDemoOrders] = useState<PaidOrder[]>(MOCK_PAID_ORDERS);
    const [serverOrders, setServerOrders] = useState<CashierOrder[]>([]);
    const [readState, setReadState] = useState<ReadState>(isDemo ? 'ready' : 'loading');
    const [reloadKey, setReloadKey] = useState(0);
    const [posting, setPosting] = useState<Record<string, boolean>>({});
    const [postError, setPostError] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isDemo) { setReadState('ready'); return; }
        if (authLoading) { setReadState('loading'); return; }
        if (!signedIn || !businessUnitId) { setReadState('unauthorized'); return; }

        let cancelled = false;
        setReadState('loading');
        const unsub = subscribeCashierOrders(
            businessUnitId,
            orders => { if (!cancelled) { setServerOrders(orders); setReadState('ready'); } },
            () => { if (!cancelled) setReadState('error'); },
        );
        return () => { cancelled = true; unsub(); };
    }, [isDemo, authLoading, signedIn, businessUnitId, reloadKey]);

    const rows: CashierRow[] = useMemo(
        () => (isDemo ? demoOrders.map(demoToRow) : serverOrders.map(o => liveToRow(o, currentUser?.id, currentUser?.name))),
        [isDemo, demoOrders, serverOrders, currentUser?.id, currentUser?.name],
    );

    const stats = useMemo(() => {
        const paidCount = rows.length;
        const reconciledCount = rows.filter(r => r.reconciled).length;
        const totalPaid = rows.reduce((sum, r) => sum + r.totalAmount, 0);
        return { paidCount, unreconciledCount: paidCount - reconciledCount, reconciledCount, totalPaid };
    }, [rows]);

    const visibleRows = useMemo(
        () => (filter === 'all' ? rows : rows.filter(r => (filter === 'reconciled') === r.reconciled)),
        [rows, filter],
    );

    const setDraft = (id: string, value: string) => setDrafts(prev => ({ ...prev, [id]: value }));
    const clearDraft = (id: string) => setDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });

    const handleReconcile = async (id: string) => {
        const invoice = (drafts[id] ?? '').trim();
        if (!invoice || posting[id]) return;

        if (isDemo) {
            setDemoOrders(prev => prev.map(o => (o.id === id ? { ...o, status: 'reconciled', invoiceNumber: invoice } : o)));
            clearDraft(id);
            return;
        }

        setPosting(p => ({ ...p, [id]: true }));
        setPostError(e => ({ ...e, [id]: '' }));
        try {
            await postOfficialInvoice(id, invoice);
            clearDraft(id);
            setPosting(p => ({ ...p, [id]: false }));
            // The onSnapshot listener flips the row to reconciled (with audit).
        } catch (err) {
            setPosting(p => ({ ...p, [id]: false }));
            setPostError(e => ({ ...e, [id]: toUserFacingPostError(err) }));
        }
    };

    const header = (
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                    <Receipt size={24} className="text-white" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-none">Cashier Reconciliation</h1>
                    <p className="text-sm font-semibold text-slate-500 truncate">{isDemo ? 'Demo board · sample orders' : 'Live orders'}</p>
                </div>
                <span className={`text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${isDemo ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                    {isDemo ? 'Demo' : 'Live'}
                </span>
            </div>
        </header>
    );

    // ── Non-ready real states ─────────────────────────────────────────────
    if (!isDemo && readState !== 'ready') {
        return (
            <div className="min-h-dvh bg-slate-100 text-slate-900">
                {header}
                <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-16 flex justify-center">
                    {readState === 'loading' ? (
                        <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
                            <Loader2 size={30} className="text-slate-500 animate-spin" />
                            <p className="mt-4 text-sm font-semibold text-slate-500">Loading paid orders…</p>
                        </div>
                    ) : readState === 'unauthorized' ? (
                        <CashierMessage
                            Icon={LockKeyhole}
                            iconCls="text-slate-400"
                            title="Staff sign-in required"
                            body="Sign in with a staff account (with a business unit) to reconcile live orders. Use /cashier/demo for the sample board."
                        />
                    ) : (
                        <CashierMessage
                            Icon={AlertCircle}
                            iconCls="text-rose-400"
                            title="Couldn’t load orders"
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

            <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-5 md:py-6 space-y-5">
                {/* KPI cards */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <KpiCard label="Paid orders" value={String(stats.paidCount)} Icon={Wallet} accent="text-blue-600" iconBg="bg-blue-100" />
                    <KpiCard label="Unreconciled" value={String(stats.unreconciledCount)} Icon={AlertTriangle} accent="text-amber-600" iconBg="bg-amber-100" />
                    <KpiCard label="Reconciled" value={String(stats.reconciledCount)} Icon={CheckCircle2} accent="text-emerald-600" iconBg="bg-emerald-100" />
                    <KpiCard label="Total paid" value={PESO(stats.totalPaid)} Icon={Receipt} accent="text-slate-700" iconBg="bg-slate-200" />
                </section>

                {/* Warning banner (unreconciled paid orders) */}
                {stats.unreconciledCount > 0 && (
                    <section className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300">
                        <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" strokeWidth={2.25} />
                        <div className="min-w-0">
                            <p className="text-base font-bold text-amber-900">
                                {stats.unreconciledCount} paid order{stats.unreconciledCount === 1 ? '' : 's'} still need reconciling
                            </p>
                            <p className="text-sm text-amber-800 mt-0.5">
                                Record the official invoice number from the registered POS for each order below.
                            </p>
                        </div>
                    </section>
                )}

                {/* Business-rule helper */}
                <section className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200">
                    <Info size={20} className="text-blue-600 shrink-0 mt-0.5" strokeWidth={2.25} />
                    <p className="text-sm md:text-[15px] text-blue-900 leading-relaxed">
                        Official invoice is issued by the registered POS. TNG only stores the invoice number for reconciliation.
                    </p>
                </section>

                {/* Filter tabs */}
                <section className="flex flex-wrap items-center gap-2">
                    {FILTERS.map(f => {
                        const isActive = filter === f.key;
                        const count = f.key === 'all' ? stats.paidCount : f.key === 'unreconciled' ? stats.unreconciledCount : stats.reconciledCount;
                        return (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilter(f.key)}
                                aria-pressed={isActive}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[15px] font-bold transition-colors ${isActive
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {f.label}
                                <span className={`min-w-6 h-6 px-1.5 rounded-full text-xs font-black flex items-center justify-center tabular-nums ${isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </section>

                {/* Orders — table on desktop, cards on mobile */}
                <section>
                    {/* Desktop / laptop table */}
                    <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-3">Table</th>
                                    <th className="px-4 py-3">Order</th>
                                    <th className="px-4 py-3">Payment</th>
                                    <th className="px-4 py-3">Ref</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Official invoice no.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibleRows.map(o => (
                                    <tr key={o.id} className={!o.reconciled ? 'bg-amber-50/40' : ''}>
                                        <td className="px-4 py-3">
                                            <span className="text-2xl font-black text-slate-900 tabular-nums">{o.tableNumber}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800">{o.orderNumber}</div>
                                            {o.paidAtLabel && <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Clock size={12} />{o.paidAtLabel}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {o.paymentMethod ? (
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-bold ${METHOD_STYLE[o.paymentMethod] ?? 'bg-slate-100 text-slate-600'}`}>{o.paymentMethod}</span>
                                            ) : (
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700">Paid</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm text-slate-500">{o.xenditRef ?? '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-lg font-black text-slate-900 tabular-nums">{PESO(o.totalAmount)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {o.reconciled ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                                                    <CheckCircle2 size={15} /> Reconciled
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                                                    <AlertTriangle size={15} /> Unreconciled
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {o.reconciled ? (
                                                <div>
                                                    <span className="font-mono text-sm font-bold text-slate-800">{o.invoiceNumber}</span>
                                                    {o.auditLabel && <div className="text-[11px] text-slate-400 mt-0.5">{o.auditLabel}</div>}
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={drafts[o.id] ?? ''}
                                                            onChange={e => setDraft(o.id, e.target.value)}
                                                            placeholder="e.g. SI-100484"
                                                            aria-label={`Official invoice number for ${o.orderNumber}`}
                                                            className="w-36 px-3 py-2 rounded-lg border-2 border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReconcile(o.id)}
                                                            disabled={!((drafts[o.id] ?? '').trim()) || posting[o.id]}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors whitespace-nowrap"
                                                        >
                                                            {posting[o.id] ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.75} />}
                                                            {posting[o.id] ? 'Saving…' : 'Mark Reconciled'}
                                                        </button>
                                                    </div>
                                                    {postError[o.id] && <div className="text-[11px] font-medium text-red-600 mt-1">{postError[o.id]}</div>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {visibleRows.length === 0 && (
                            <div className="py-12 flex flex-col items-center text-center">
                                <Search size={32} className="text-slate-300 mb-2" strokeWidth={1.75} />
                                <p className="text-base font-bold text-slate-400">{isDemo ? 'No orders in this filter' : 'No paid orders to reconcile'}</p>
                            </div>
                        )}
                    </div>

                    {/* Mobile / tablet cards */}
                    <div className="lg:hidden space-y-3">
                        {visibleRows.map(o => (
                            <div key={o.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${!o.reconciled ? 'border-amber-300' : 'border-slate-200'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Table</span>
                                        <span className="text-3xl font-black text-slate-900 leading-none tabular-nums">{o.tableNumber}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-bold text-slate-800">{o.orderNumber}</div>
                                        {o.paidAtLabel && <div className="text-xs text-slate-500 flex items-center justify-end gap-1 mt-0.5"><Clock size={12} />{o.paidAtLabel}</div>}
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {o.paymentMethod ? (
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-bold ${METHOD_STYLE[o.paymentMethod] ?? 'bg-slate-100 text-slate-600'}`}>{o.paymentMethod}</span>
                                    ) : (
                                        <span className="inline-flex px-2.5 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700">Paid</span>
                                    )}
                                    {o.reconciled ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                                            <CheckCircle2 size={15} /> Reconciled
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-bold">
                                            <AlertTriangle size={15} /> Unreconciled
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                                    <span className="font-mono text-slate-500">{o.xenditRef ?? '—'}</span>
                                    <span className="text-xl font-black text-slate-900 tabular-nums">{PESO(o.totalAmount)}</span>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    {o.reconciled ? (
                                        <>
                                            <p className="text-sm text-slate-600">
                                                Official invoice no.: <span className="font-mono font-bold text-slate-900">{o.invoiceNumber}</span>
                                            </p>
                                            {o.auditLabel && <p className="text-[11px] text-slate-400 mt-0.5">{o.auditLabel}</p>}
                                        </>
                                    ) : (
                                        <>
                                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Official invoice no.</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={drafts[o.id] ?? ''}
                                                    onChange={e => setDraft(o.id, e.target.value)}
                                                    placeholder="e.g. SI-100484"
                                                    aria-label={`Official invoice number for ${o.orderNumber}`}
                                                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border-2 border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleReconcile(o.id)}
                                                    disabled={!((drafts[o.id] ?? '').trim()) || posting[o.id]}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                                                >
                                                    {posting[o.id] ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.75} />}
                                                    {posting[o.id] ? 'Saving…' : 'Reconcile'}
                                                </button>
                                            </div>
                                            {postError[o.id] && <div className="text-[11px] font-medium text-red-600 mt-1">{postError[o.id]}</div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {visibleRows.length === 0 && (
                            <div className="py-12 flex flex-col items-center text-center bg-white rounded-2xl border border-slate-200">
                                <Search size={32} className="text-slate-300 mb-2" strokeWidth={1.75} />
                                <p className="text-base font-bold text-slate-400">{isDemo ? 'No orders in this filter' : 'No paid orders to reconcile'}</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

/** Centered icon + title + body (+ optional retry) for the non-ready states. */
const CashierMessage: React.FC<{
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

export default CashierReconciliationView;
