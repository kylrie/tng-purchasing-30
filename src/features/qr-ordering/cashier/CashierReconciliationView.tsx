import React, { useMemo, useState } from 'react';
import {
    Wallet, AlertTriangle, CheckCircle2, Clock, Receipt, Info, Check, Search,
} from 'lucide-react';
import { MOCK_PAID_ORDERS } from '../data/mockReconciliation';
import type { PaidOrder, ReconStatus } from '../data/mockReconciliation';

/**
 * QR Ordering — Cashier Reconciliation (Phase 1 UI prototype · MOCK ONLY)
 *
 * Spec: docs/QR_SCREEN_SPEC.md · Staff-facing reconciliation dashboard.
 * MOCK ONLY — no Firestore, no Xendit, no Functions, no backend, no real
 * payment updates, no real invoice posting. Reconciliation state lives in
 * local React state only.
 *
 * BUSINESS RULE: TNG does NOT issue official BIR invoices. The official invoice
 * is issued by the registered POS / invoicing system; this screen only records
 * that invoice number for reconciliation.
 *
 * Bright, high-contrast light theme for admin/staff on tablet or laptop.
 */

const PESO = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type FilterKey = 'all' | ReconStatus;

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

const CashierReconciliationView: React.FC = () => {
    const [orders, setOrders] = useState<PaidOrder[]>(MOCK_PAID_ORDERS);
    const [filter, setFilter] = useState<FilterKey>('all');
    // Draft invoice-number inputs, keyed by order id (before "Mark Reconciled").
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    const stats = useMemo(() => {
        const paidCount = orders.length;
        const unreconciled = orders.filter(o => o.status === 'unreconciled');
        const reconciled = orders.filter(o => o.status === 'reconciled');
        const totalPaid = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        return { paidCount, unreconciledCount: unreconciled.length, reconciledCount: reconciled.length, totalPaid };
    }, [orders]);

    const visibleOrders = useMemo(
        () => (filter === 'all' ? orders : orders.filter(o => o.status === filter)),
        [orders, filter],
    );

    const setDraft = (id: string, value: string) => setDrafts(prev => ({ ...prev, [id]: value }));

    // MOCK: record the POS invoice number and flip status — local state only.
    const handleReconcile = (id: string) => {
        const invoice = (drafts[id] ?? '').trim();
        if (!invoice) return;
        setOrders(prev => prev.map(o => (o.id === id ? { ...o, status: 'reconciled', invoiceNumber: invoice } : o)));
        setDrafts(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    return (
        <div className="min-h-dvh bg-slate-100 text-slate-900">
            {/* Top bar */}
            <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                        <Receipt size={24} className="text-white" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-none">Cashier Reconciliation</h1>
                        <p className="text-sm font-semibold text-slate-500 truncate">Inflatable Island Beach Club</p>
                    </div>
                </div>
            </header>

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
                                    <th className="px-4 py-3">Xendit ref</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Official invoice no.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibleOrders.map(o => (
                                    <tr key={o.id} className={o.status === 'unreconciled' ? 'bg-amber-50/40' : ''}>
                                        <td className="px-4 py-3">
                                            <span className="text-2xl font-black text-slate-900 tabular-nums">{o.tableNumber}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800">{o.orderNumber}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Clock size={12} />{o.paidAtLabel}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-bold ${METHOD_STYLE[o.paymentMethod]}`}>{o.paymentMethod}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm text-slate-600">{o.xenditRef}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-lg font-black text-slate-900 tabular-nums">{PESO(o.totalAmount)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {o.status === 'reconciled' ? (
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
                                            {o.status === 'reconciled' ? (
                                                <span className="font-mono text-sm font-bold text-slate-800">{o.invoiceNumber}</span>
                                            ) : (
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
                                                        disabled={!((drafts[o.id] ?? '').trim())}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors whitespace-nowrap"
                                                    >
                                                        <Check size={16} strokeWidth={2.75} /> Mark Reconciled
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {visibleOrders.length === 0 && (
                            <div className="py-12 flex flex-col items-center text-center">
                                <Search size={32} className="text-slate-300 mb-2" strokeWidth={1.75} />
                                <p className="text-base font-bold text-slate-400">No orders in this filter</p>
                            </div>
                        )}
                    </div>

                    {/* Mobile / tablet cards */}
                    <div className="lg:hidden space-y-3">
                        {visibleOrders.map(o => (
                            <div key={o.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${o.status === 'unreconciled' ? 'border-amber-300' : 'border-slate-200'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Table</span>
                                        <span className="text-3xl font-black text-slate-900 leading-none tabular-nums">{o.tableNumber}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-bold text-slate-800">{o.orderNumber}</div>
                                        <div className="text-xs text-slate-500 flex items-center justify-end gap-1 mt-0.5"><Clock size={12} />{o.paidAtLabel}</div>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-bold ${METHOD_STYLE[o.paymentMethod]}`}>{o.paymentMethod}</span>
                                    {o.status === 'reconciled' ? (
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
                                    <span className="font-mono text-slate-500">{o.xenditRef}</span>
                                    <span className="text-xl font-black text-slate-900 tabular-nums">{PESO(o.totalAmount)}</span>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    {o.status === 'reconciled' ? (
                                        <p className="text-sm text-slate-600">
                                            Official invoice no.: <span className="font-mono font-bold text-slate-900">{o.invoiceNumber}</span>
                                        </p>
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
                                                    disabled={!((drafts[o.id] ?? '').trim())}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                                                >
                                                    <Check size={16} strokeWidth={2.75} /> Reconcile
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {visibleOrders.length === 0 && (
                            <div className="py-12 flex flex-col items-center text-center bg-white rounded-2xl border border-slate-200">
                                <Search size={32} className="text-slate-300 mb-2" strokeWidth={1.75} />
                                <p className="text-base font-bold text-slate-400">No orders in this filter</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default CashierReconciliationView;
