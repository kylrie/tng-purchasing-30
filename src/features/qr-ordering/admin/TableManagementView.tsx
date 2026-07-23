import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { QrCode, Plus, Loader2, RefreshCw, LockKeyhole, AlertCircle, CheckCircle2, X, Copy, Table2, Printer, Download, Store, Pencil, Trash2, Check } from 'lucide-react';
import { isConfigValid } from '../../../config/firebase';
import { buildQrMatrix, qrMatrixToSvgString } from './qrMatrix';
import { QrSvg } from './QrSvg';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import {
    listQrTables, createQrTable, getQrTableToken, editQrTable, deleteQrTable,
    toUserFacingTableError, toUserFacingCreateError, toUserFacingEditError, toUserFacingDeleteError,
} from '../services/qrTables.service';
import type { QrTableSummary } from '../types/qrOrder.types';
import { MOCK_TABLES, MOCK_BUSINESS_UNIT, mockTokenFor } from '../data/mockTables';
import { formatTableLabel } from '../utils/tableUtils';
import { buildCustomerMenuUrl } from '../utils/customerMenuUrl';
import { readBusinessParam, resolveAdminBusinessUnit } from '../utils/adminBusinessParam';

/**
 * QR Ordering — Table Management (Sprint 2 · admin)
 *
 * `/qr-tables/demo` (and local dev without Firebase) shows a mock board. Any
 * other mode (e.g. /qr-tables/live) is REAL and admin-only: it lists tables via
 * listQrTables (token-OMITTING), creates via createQrTable, and reveals a single
 * table's qrToken via getQrTableToken ONLY when explicitly requested. No token is
 * ever shown in the list. No Xendit, no inventory, no deployment.
 */

type ReadState = 'loading' | 'ready' | 'error' | 'unauthorized' | 'no_business';

const fmtDate = (ms: number): string => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

const StatusChip: React.FC<{ active: boolean }> = ({ active }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
        {active ? 'Active' : 'Inactive'}
    </span>
);

const TableManagementView: React.FC = () => {
    const { mode } = useParams<{ mode?: string }>();
    const location = useLocation();
    const { currentUser, loading: authLoading } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();

    const isDemo = !mode || mode.trim().toLowerCase() === 'demo' || !isConfigValid;
    const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';
    // Business identity is DURABLE — read from the URL (?bu=) first so it survives
    // hard refresh / new tab / cold open / paste. NO fallback to the signed-in
    // admin's home business: that silently turned Fun Roof (b1) into Inflatable
    // (b3) on refresh. When unresolved we show an explicit "no business" state.
    // The view is driven entirely by the URL — it never writes back to the shared
    // global switcher (which would leak this page's business into the rest of the ERP).
    const urlBusinessUnitId = readBusinessParam(location.search);
    const businessUnitId = isDemo
        ? MOCK_BUSINESS_UNIT
        : resolveAdminBusinessUnit({ urlBusinessUnitId, selectedBusinessUnit });

    // ── List state ────────────────────────────────────────────────────────
    const [liveTables, setLiveTables] = useState<QrTableSummary[]>([]);
    const [readState, setReadState] = useState<ReadState>(isDemo ? 'ready' : 'loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    // Demo tables live in local state so the mock create flow can append.
    const [demoTables, setDemoTables] = useState<QrTableSummary[]>(() => MOCK_TABLES.map(m => ({ ...m })));

    // ── Create-form state ─────────────────────────────────────────────────
    const [tableNumber, setTableNumber] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');

    // ── QR-reveal state (on-demand only) ──────────────────────────────────
    const [tokenPanel, setTokenPanel] = useState<{ tableId: string; tableNumber: string } | null>(null);
    const [tokenLoading, setTokenLoading] = useState(false);
    const [tokenValue, setTokenValue] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [copied, setCopied] = useState(false);

    // ── Edit (inline rename) + Delete (confirm modal) state ───────────────
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');

    const [deleteTarget, setDeleteTarget] = useState<{ tableId: string; tableNumber: string } | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const signedIn = !!currentUser;

    useEffect(() => {
        if (isDemo) { setReadState('ready'); return; }
        if (authLoading) { setReadState('loading'); return; }
        if (!signedIn || !isAdmin) { setReadState('unauthorized'); return; }
        // Signed-in admin but no durable business in the URL/switcher → explicit
        // state (open QR Hub to choose one). NEVER silently default to a business.
        if (!businessUnitId) { setReadState('no_business'); return; }

        let cancelled = false;
        setReadState('loading');
        setErrorMsg('');
        listQrTables(businessUnitId)
            .then(res => { if (!cancelled) { setLiveTables(res.tables); setReadState('ready'); } })
            .catch(err => { if (!cancelled) { setErrorMsg(toUserFacingTableError(err)); setReadState('error'); } });
        return () => { cancelled = true; };
    }, [isDemo, authLoading, signedIn, isAdmin, businessUnitId, reloadKey]);

    // Token is loaded ONLY when a panel is opened (req 10 — explicit request).
    useEffect(() => {
        if (!tokenPanel) return;
        let cancelled = false;
        setTokenValue(''); setTokenError(''); setCopied(false); setTokenLoading(true);
        if (isDemo) {
            setTokenValue(mockTokenFor(tokenPanel.tableId));
            setTokenLoading(false);
            return;
        }
        getQrTableToken(tokenPanel.tableId)
            .then(res => { if (!cancelled) { setTokenValue(res.qrToken); setTokenLoading(false); } })
            .catch(err => { if (!cancelled) { setTokenError(toUserFacingTableError(err)); setTokenLoading(false); } });
        return () => { cancelled = true; };
    }, [tokenPanel, isDemo]);

    // Modal a11y: Escape to close + lock body scroll while the QR panel is open.
    useEffect(() => {
        if (!tokenPanel) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTokenPanel(null); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [tokenPanel]);

    // Delete-modal a11y: Escape closes (unless a delete is in flight) + scroll lock.
    useEffect(() => {
        if (!deleteTarget) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleteBusy) setDeleteTarget(null); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [deleteTarget, deleteBusy]);

    const rows = useMemo(() => (isDemo ? demoTables : liveTables), [isDemo, demoTables, liveTables]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const num = tableNumber.trim();
        if (!num || creating) return;
        setCreating(true); setCreateError(''); setCreateSuccess('');

        if (isDemo) {
            if (demoTables.some(t => t.isActive && t.tableNumber === num)) {
                setCreating(false); setCreateError('An active table with that number already exists.'); return;
            }
            setDemoTables(prev => [...prev, { id: `demo-${num}-${prev.length}`, tableNumber: num, isActive: true, businessUnitId, createdAtMillis: Date.now() }]
                .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })));
            setCreating(false); setCreateSuccess(`Table ${num} created.`); setTableNumber('');
            return;
        }

        try {
            const res = await createQrTable(businessUnitId, num);
            setCreating(false);
            setCreateSuccess(`Table ${res.tableNumber} created.`);
            setTableNumber('');
            setReloadKey(k => k + 1); // refresh the list (req 8)
        } catch (err) {
            setCreating(false);
            setCreateError(toUserFacingCreateError(err));
        }
    };

    // ── Edit (inline rename) ──────────────────────────────────────────────
    const startEdit = (t: QrTableSummary) => { setEditingId(t.id); setEditValue(t.tableNumber); setEditError(''); };
    const cancelEdit = () => { setEditingId(null); setEditValue(''); setEditError(''); };

    const saveEdit = async (e: React.FormEvent, t: QrTableSummary) => {
        e.preventDefault();
        const num = editValue.trim();
        if (!num || editSaving) return;
        if (num === t.tableNumber) { cancelEdit(); return; } // no-op rename
        setEditSaving(true); setEditError('');

        if (isDemo) {
            if (demoTables.some(d => d.id !== t.id && d.isActive && d.tableNumber === num)) {
                setEditSaving(false); setEditError('An active table with that number already exists.'); return;
            }
            setDemoTables(prev => prev.map(d => (d.id === t.id ? { ...d, tableNumber: num } : d))
                .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })));
            setEditSaving(false); cancelEdit();
            return;
        }

        try {
            await editQrTable(t.id, num);
            setEditSaving(false); cancelEdit();
            setReloadKey(k => k + 1); // refresh the list
        } catch (err) {
            setEditSaving(false); setEditError(toUserFacingEditError(err));
        }
    };

    // ── Delete (with confirmation) ────────────────────────────────────────
    const confirmDelete = async () => {
        if (!deleteTarget || deleteBusy) return;
        setDeleteBusy(true); setDeleteError('');

        if (isDemo) {
            setDemoTables(prev => prev.filter(d => d.id !== deleteTarget.tableId));
            setDeleteBusy(false); setDeleteTarget(null);
            return;
        }

        try {
            await deleteQrTable(deleteTarget.tableId);
            setDeleteBusy(false); setDeleteTarget(null);
            setReloadKey(k => k + 1); // refresh the list
        } catch (err) {
            setDeleteBusy(false); setDeleteError(toUserFacingDeleteError(err));
        }
    };

    // Business-aware customer link: Fun Roof (b1) tables open the standalone
    // /funroof/<tableNumber> menu; all others use the token-based /order/<token>.
    const customerUrl = buildCustomerMenuUrl(window.location.origin, businessUnitId, tokenPanel?.tableNumber ?? '', tokenValue);
    const copyUrl = () => {
        if (!customerUrl) return;
        navigator.clipboard?.writeText(customerUrl).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }).catch(() => { /* clipboard unavailable */ });
    };

    // Build the QR matrix from the customer link (purely local — the token never
    // leaves the browser). Guarded so an over-long link surfaces as an error
    // instead of throwing during render.
    const qr = useMemo<{ matrix: boolean[][] | null; error: boolean }>(() => {
        if (!customerUrl) return { matrix: null, error: false };
        try { return { matrix: buildQrMatrix(customerUrl, 'M'), error: false }; }
        catch { return { matrix: null, error: true }; }
    }, [customerUrl]);

    // Download the QR as a self-contained SVG (local Blob — no upload, no network).
    const downloadQr = () => {
        if (!qr.matrix) return;
        const svg = qrMatrixToSvgString(qr.matrix, { margin: 4 });
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-table-${tokenPanel?.tableNumber ?? 'table'}.svg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // Print the print-only card (see .qr-print-root + the @media print rules).
    const printQr = () => { if (qr.matrix) window.print(); };

    const header = (
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                    <Table2 size={22} className="text-white" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-none">QR Tables</h1>
                    <p className="text-sm font-semibold text-slate-500 truncate">{isDemo ? 'Demo · sample tables' : `Business unit: ${businessUnitId || '—'}`}</p>
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
                <main className="max-w-3xl mx-auto px-4 md:px-6 py-16 flex justify-center">
                    {readState === 'loading' ? (
                        <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
                            <Loader2 size={30} className="text-slate-500 animate-spin" />
                            <p className="mt-4 text-sm font-semibold text-slate-500">Loading tables…</p>
                        </div>
                    ) : readState === 'unauthorized' ? (
                        <StateCard
                            Icon={LockKeyhole}
                            iconCls="text-slate-500"
                            title="Admin access required"
                            body="Sign in with an admin account to manage QR tables. Use /qr-tables/demo for the sample board."
                            signInFrom={location.pathname + location.search}
                        />
                    ) : readState === 'no_business' ? (
                        <StateCard
                            Icon={Store}
                            iconCls="text-slate-500"
                            title="No business selected"
                            body="Open QR Hub and choose a business to manage its tables and QR codes."
                            to="/qr-hub"
                            toLabel="Open QR Hub"
                        />
                    ) : (
                        <StateCard
                            Icon={AlertCircle}
                            iconCls="text-rose-400"
                            title="Couldn’t load tables"
                            body={errorMsg}
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

            <main className="max-w-3xl mx-auto px-4 md:px-6 py-5 md:py-6 space-y-5">
                {/* Create table */}
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">Add a table</h2>
                    <form onSubmit={handleCreate} className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="flex-1">
                            <label htmlFor="new-table-number" className="block text-sm font-bold text-slate-700 mb-1.5">Table number</label>
                            <input
                                id="new-table-number"
                                type="text"
                                inputMode="numeric"
                                value={tableNumber}
                                onChange={e => { setTableNumber(e.target.value); setCreateError(''); setCreateSuccess(''); }}
                                placeholder="e.g. 14"
                                aria-describedby={createError ? 'create-error' : undefined}
                                className="w-full px-3 py-3 rounded-xl border-2 border-slate-300 text-base font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!tableNumber.trim() || creating}
                            aria-busy={creating}
                            className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-base font-bold active:scale-[0.98] transition-all whitespace-nowrap"
                        >
                            {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={2.75} />}
                            {creating ? 'Creating…' : 'Create table'}
                        </button>
                    </form>
                    {createError && (
                        <p id="create-error" role="alert" className="mt-3 flex items-start gap-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span className="min-w-0">{createError}</span>
                        </p>
                    )}
                    {createSuccess && (
                        <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                            <CheckCircle2 size={16} className="shrink-0" /> {createSuccess}
                        </p>
                    )}
                </section>

                {/* Table list */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Tables ({rows.length})</h2>
                        {!isDemo && (
                            <button
                                type="button"
                                onClick={() => setReloadKey(k => k + 1)}
                                aria-label="Refresh table list"
                                className="inline-flex items-center gap-1.5 py-2 -my-1 text-sm font-bold text-slate-500 hover:text-slate-800 active:scale-95 transition-all"
                            >
                                <RefreshCw size={15} strokeWidth={2.5} aria-hidden /> Refresh
                            </button>
                        )}
                    </div>

                    {rows.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 py-12 flex flex-col items-center text-center">
                            <Table2 size={32} className="text-slate-300 mb-2" strokeWidth={1.75} />
                            <p className="text-base font-bold text-slate-500">No tables yet</p>
                            <p className="text-sm text-slate-500">Add your first table above.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {rows.map(t => (
                                <li key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                    {editingId === t.id ? (
                                        /* ── Edit mode: inline rename (QR token/link stays the same) ── */
                                        <form onSubmit={e => saveEdit(e, t)} className="flex flex-col gap-2">
                                            <label htmlFor={`edit-table-${t.id}`} className="text-sm font-bold text-slate-700">Edit table number / name</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id={`edit-table-${t.id}`}
                                                    type="text"
                                                    value={editValue}
                                                    autoFocus
                                                    onChange={e => { setEditValue(e.target.value); setEditError(''); }}
                                                    aria-describedby={editError ? `edit-error-${t.id}` : undefined}
                                                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-slate-300 text-base font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!editValue.trim() || editSaving}
                                                    aria-busy={editSaving}
                                                    className="shrink-0 inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-bold active:scale-95 transition-all"
                                                >
                                                    {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.75} />} Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelEdit}
                                                    aria-label="Cancel edit"
                                                    className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl border-2 border-slate-300 hover:border-slate-400 text-slate-600 active:scale-95 transition-all"
                                                >
                                                    <X size={18} aria-hidden />
                                                </button>
                                            </div>
                                            {editError && (
                                                <p id={`edit-error-${t.id}`} role="alert" className="flex items-start gap-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                                    <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span className="min-w-0">{editError}</span>
                                                </p>
                                            )}
                                            <p className="text-[11px] text-slate-500">Only the number/name changes — the QR code and customer link stay the same.</p>
                                        </form>
                                    ) : (
                                        /* ── View mode ─────────────────────────────────────────────── */
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-baseline gap-2 shrink-0 w-20">
                                                <span className="text-sm font-black uppercase tracking-wider text-slate-400 mr-2">{formatTableLabel(t.tableNumber).replace(t.tableNumber, '').trim()}</span>
                                                <span className="text-2xl font-black text-slate-900 tabular-nums leading-none">{t.tableNumber}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <StatusChip active={t.isActive} />
                                                    <span className="text-xs text-slate-500 truncate">BU: {t.businessUnitId}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Created {fmtDate(t.createdAtMillis)}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setTokenPanel({ tableId: t.id, tableNumber: t.tableNumber })}
                                                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold active:scale-95 transition-all"
                                                >
                                                    <QrCode size={16} strokeWidth={2.5} aria-hidden /> <span className="hidden sm:inline">Show QR</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(t)}
                                                    aria-label={`Edit table ${t.tableNumber}`}
                                                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 active:scale-95 transition-all"
                                                >
                                                    <Pencil size={16} strokeWidth={2.25} aria-hidden />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDeleteTarget({ tableId: t.id, tableNumber: t.tableNumber }); setDeleteError(''); }}
                                                    aria-label={`Delete table ${t.tableNumber}`}
                                                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-500 hover:text-red-600 active:scale-95 transition-all"
                                                >
                                                    <Trash2 size={16} strokeWidth={2.25} aria-hidden />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>

            {/* QR-reveal modal (token loaded on demand) */}
            {tokenPanel && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`QR token for table ${tokenPanel.tableNumber}`}>
                    <button type="button" aria-label="Close" onClick={() => setTokenPanel(null)} className="absolute inset-0 bg-slate-900/50" />
                    <div className="relative w-full sm:max-w-md bg-white rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl p-5 md:p-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{formatTableLabel(tokenPanel.tableNumber)}</p>
                                <h3 className="text-lg font-black text-slate-900">QR access token</h3>
                            </div>
                            <button type="button" onClick={() => setTokenPanel(null)} aria-label="Close" className="w-10 h-10 -mr-1 -mt-1 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
                                <X size={20} aria-hidden />
                            </button>
                        </div>

                        {tokenLoading ? (
                            <div className="py-10 flex flex-col items-center text-center" role="status" aria-live="polite">
                                <Loader2 size={26} className="text-blue-600 animate-spin" />
                                <p className="mt-3 text-sm font-semibold text-slate-500">Loading token…</p>
                            </div>
                        ) : tokenError ? (
                            <div className="py-6 flex flex-col items-center text-center">
                                <AlertCircle size={26} className="text-rose-400 mb-2" />
                                <p className="text-sm text-slate-500 max-w-xs">{tokenError}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Rendered QR (generated locally from the customer link) */}
                                <div className="flex flex-col items-center">
                                    {qr.matrix ? (
                                        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                            <QrSvg matrix={qr.matrix} size={196} ariaLabel={`QR code linking to the menu for table ${tokenPanel.tableNumber}`} />
                                        </div>
                                    ) : (
                                        <div className="w-[196px] h-[196px] flex flex-col items-center justify-center text-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
                                            <AlertCircle size={22} className="text-rose-400 mb-2" />
                                            <p className="text-xs text-slate-500">Couldn’t render the QR code. You can still copy the link below.</p>
                                        </div>
                                    )}
                                    <p className="mt-2 text-[11px] text-slate-500">Scan to open {formatTableLabel(tokenPanel.tableNumber)}’s menu</p>
                                </div>

                                {/* Actions: print + download (only when the QR built) */}
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={printQr}
                                        disabled={!qr.matrix}
                                        className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-bold active:scale-[0.98] transition-all"
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                    <button
                                        type="button"
                                        onClick={downloadQr}
                                        disabled={!qr.matrix}
                                        className="inline-flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-slate-300 hover:border-slate-400 disabled:opacity-50 text-slate-800 text-sm font-bold active:scale-[0.98] transition-all"
                                    >
                                        <Download size={16} /> Download SVG
                                    </button>
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Customer link</p>
                                    <p className="font-mono text-xs text-slate-600 break-all bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">{customerUrl}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={copyUrl}
                                    className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold active:scale-[0.98] transition-all"
                                >
                                    {copied ? <CheckCircle2 size={17} className="text-emerald-600" /> : <Copy size={17} />} {copied ? 'Copied!' : 'Copy customer link'}
                                </button>
                                <p className="text-[11px] text-slate-500 text-center">Keep this link private — anyone with it can view this table’s menu.</p>

                                {/* Print-only card: shown ONLY on paper (see the @media print rules).
                                    Hidden on screen so the admin sees the compact panel above. */}
                                {qr.matrix && (
                                    <>
                                        <style>{`@media print {
  body * { visibility: hidden !important; }
  .qr-print-root, .qr-print-root * { visibility: visible !important; }
  .qr-print-root { display: flex !important; position: fixed !important; inset: 0 !important; }
}`}</style>
                                        <div className="qr-print-root hidden flex-col items-center justify-center text-center gap-4 p-10">
                                            <p className="text-lg font-semibold text-slate-600">Scan to view the menu &amp; order</p>
                                            <p className="text-5xl font-black tracking-tight text-slate-900">{formatTableLabel(tokenPanel.tableNumber)}</p>
                                            <QrSvg matrix={qr.matrix} size={320} ariaLabel={`QR code for table ${tokenPanel.tableNumber}`} />
                                            <p className="font-mono text-xs text-slate-500 break-all max-w-md">{customerUrl}</p>
                                            <p className="text-sm text-slate-500">Point your phone camera at the code, then tap the link.</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`Delete table ${deleteTarget.tableNumber}`}>
                    <button type="button" aria-label="Close" onClick={() => { if (!deleteBusy) setDeleteTarget(null); }} className="absolute inset-0 bg-slate-900/50" />
                    <div className="relative w-full sm:max-w-md bg-white rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-2xl p-5 md:p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                <Trash2 size={20} className="text-red-600" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-lg font-black text-slate-900">Delete {formatTableLabel(deleteTarget.tableNumber)}?</h3>
                                <p className="text-sm text-slate-600 mt-1">This removes the QR table from active table management. Paid order history will remain.</p>
                            </div>
                        </div>
                        {deleteError && (
                            <p role="alert" className="mb-3 flex items-start gap-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span className="min-w-0">{deleteError}</span>
                            </p>
                        )}
                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleteBusy}
                                className="inline-flex items-center justify-center h-11 rounded-xl border-2 border-slate-300 hover:border-slate-400 disabled:opacity-50 text-slate-800 text-sm font-bold active:scale-[0.98] transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={deleteBusy}
                                aria-busy={deleteBusy}
                                className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-bold active:scale-[0.98] transition-all"
                            >
                                {deleteBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {deleteBusy ? 'Deleting…' : 'Delete table'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/** Centered icon + title + body (+ optional retry) for the non-ready states. */
const StateCard: React.FC<{
    Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    iconCls: string;
    title: string;
    body: string;
    onRetry?: () => void;
    /** When set, render a Sign-in link that returns here after login. */
    signInFrom?: string;
    /** When set, render a plain navigation link (e.g. back to QR Hub). */
    to?: string;
    toLabel?: string;
}> = ({ Icon, iconCls, title, body, onRetry, signInFrom, to, toLabel }) => (
    <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
            <Icon size={26} className={iconCls} strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-bold text-slate-700 mb-1">{title}</h3>
        <p className="text-slate-500 text-sm mb-5">{body}</p>
        {signInFrom && (
            <Link
                to="/login"
                state={{ from: { pathname: signInFrom } }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold active:scale-95 transition-transform"
            >
                <LockKeyhole size={16} strokeWidth={2.5} /> Sign in
            </Link>
        )}
        {to && (
            <Link
                to={to}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold active:scale-95 transition-transform"
            >
                <QrCode size={16} strokeWidth={2.5} /> {toLabel ?? 'Continue'}
            </Link>
        )}
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

export default TableManagementView;
