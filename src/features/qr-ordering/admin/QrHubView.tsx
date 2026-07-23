import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Store, ChevronRight, Loader2, RefreshCw, ShieldCheck, FlaskConical } from 'lucide-react';
import type { Business } from '../../procurement/types';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { listQrTables, isPermissionDenied } from '../services/qrTables.service';
import { withBusinessParam } from '../utils/adminBusinessParam';

/**
 * QR Hub — ERP-wide, cross-business entry point for QR ordering (top-level module).
 *
 * QR ordering is an operational module multiple TNG businesses will use over time.
 * This hub lists every business the user can access (by its canonical name from the
 * real `businesses` collection — never a hardcoded label) and shows each one's REAL
 * QR state (table counts from the deployed `listQrTables` callable — never
 * fabricated), then routes into the per-business QR Operations dashboard with the
 * business context set explicitly (no reliance on the global Business Unit switcher).
 *
 * Reuses the existing backend + the existing TableManagementView; adds only the
 * discovery/navigation shell. Admin-only (same gate as the manager + the callables).
 */

/** Honest, data-derived status for a business's QR configuration. */
type QrStatus = 'checking' | 'active' | 'no_active' | 'not_configured' | 'unavailable';

interface BusinessQrState {
    status: QrStatus;
    totalTables: number;
    activeTables: number;
}

const STATUS_META: Record<Exclude<QrStatus, 'checking'>, { label: string; cls: string }> = {
    active: { label: 'ACTIVE', cls: 'bg-emerald-100 text-emerald-700' },
    no_active: { label: 'NO ACTIVE TABLES', cls: 'bg-amber-100 text-amber-700' },
    not_configured: { label: 'NOT CONFIGURED', cls: 'bg-slate-200 text-slate-600' },
    unavailable: { label: 'UNAVAILABLE', cls: 'bg-rose-100 text-rose-700' },
};

interface QrHubViewProps {
    businesses?: Business[];
}

const QrHubView: React.FC<QrHubViewProps> = ({ businesses }) => {
    const navigate = useNavigate();
    const { setSelectedBusinessUnit } = useBusinessUnit();

    const [states, setStates] = useState<Record<string, BusinessQrState>>({});
    const [reloadKey, setReloadKey] = useState(0);

    // Honest environment signal (deployment-derived, not fabricated): the QR system
    // runs against Xendit TEST keys on staging/local; production is the live surface.
    const isSandbox = typeof window !== 'undefined'
        && (window.location.hostname.includes('staging') || window.location.hostname.includes('localhost'));

    const list = businesses ?? [];

    useEffect(() => {
        if (list.length === 0) return;
        let cancelled = false;

        // Seed every row as "checking", then resolve each independently so one
        // business failing never blocks the others.
        setStates(Object.fromEntries(list.map(b => [b.id, { status: 'checking', totalTables: 0, activeTables: 0 } as BusinessQrState])));

        list.forEach(business => {
            listQrTables(business.id)
                .then(res => {
                    if (cancelled) return;
                    const total = res.tables.length;
                    const active = res.tables.filter(t => t.isActive).length;
                    const status: QrStatus = total === 0 ? 'not_configured' : active > 0 ? 'active' : 'no_active';
                    setStates(prev => ({ ...prev, [business.id]: { status, totalTables: total, activeTables: active } }));
                })
                .catch(err => {
                    if (cancelled) return;
                    // Permission-denied for a listed business is still honestly "not configured
                    // for you"; any other failure is a transient "unavailable" (never faked ok).
                    const status: QrStatus = isPermissionDenied(err) ? 'not_configured' : 'unavailable';
                    setStates(prev => ({ ...prev, [business.id]: { status, totalTables: 0, activeTables: 0 } }));
                });
        });

        return () => { cancelled = true; };
    }, [list, reloadKey]);

    // Enter the per-business QR Operations dashboard with the business context set
    // explicitly (no manual Business Unit switcher step). The ops dashboard's
    // Tables tab links onward to the table/QR manager.
    //
    // The business id is carried in the URL (?bu=) so the selection is DURABLE:
    // it survives hard refresh, new tab, cold open and paste, instead of being
    // lost with the transient context (which silently reverted Fun Roof→Inflatable).
    const manage = (businessId: string) => {
        setSelectedBusinessUnit(businessId);
        navigate(withBusinessParam('/qr-ops/overview', businessId));
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-3 mb-1">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                    <QrCode size={22} className="text-white" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-none">QR Hub</h1>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full ${isSandbox ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isSandbox ? <><FlaskConical size={12} /> Sandbox</> : <><ShieldCheck size={12} /> Live</>}
                        </span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                        QR ordering across TNG businesses. Pick a business to manage its live tables, tokens, and customer links.
                    </p>
                </div>
            </div>

            {/* Business list */}
            <div className="mt-6 space-y-3">
                {list.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                        <p className="text-sm font-semibold text-slate-500">No businesses are available on your account yet.</p>
                    </div>
                ) : list.map(business => {
                    const state = states[business.id] ?? { status: 'checking' as QrStatus, totalTables: 0, activeTables: 0 };
                    const checking = state.status === 'checking';
                    const meta = state.status === 'checking' ? null : STATUS_META[state.status];
                    const configured = state.status === 'active' || state.status === 'no_active';

                    return (
                        <div key={business.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                <Store size={20} className="text-slate-600" strokeWidth={2} />
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="text-base font-bold text-slate-900 truncate">{business.name}</h2>
                                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                    {checking ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                            <Loader2 size={13} className="animate-spin" /> Checking…
                                        </span>
                                    ) : (
                                        <>
                                            <span className={`inline-flex items-center text-[11px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${meta!.cls}`}>
                                                {meta!.label}
                                            </span>
                                            {configured && (
                                                <span className="text-xs font-medium text-slate-500 tabular-nums">
                                                    {state.activeTables} active / {state.totalTables} table{state.totalTables === 1 ? '' : 's'}
                                                </span>
                                            )}
                                            {state.status === 'unavailable' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setReloadKey(k => k + 1)}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
                                                >
                                                    <RefreshCw size={12} /> Retry
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => manage(business.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
                            >
                                {configured ? 'Manage QR' : 'Set up QR'}
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default QrHubView;
