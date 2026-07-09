import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Table2, ChevronRight, X, CalendarClock, Phone, User, Loader2, AlertCircle,
    CheckCircle2, RefreshCw, CalendarPlus, Settings2,
} from 'lucide-react';
import { listQrTables } from '../services/qrTables.service';
import {
    subscribeQrReservations, createQrReservation, toReservationLite,
    isReservationConflict, toUserFacingReservationError,
} from '../services/qrReservations.service';
import type { QrReservation } from '../types/qrOrder.types';
import {
    resolveTableStatus, nextReservation, upcomingReservations, hasReservationConflict,
    RESERVATION_HOLD_MINUTES, type TableStatus, type ReservationLite,
} from './tableStatus';
import { isActiveStatus } from './qrOpsStatus';
import { isValidPhMobile } from '../utils/phMobile';
import { formatTableLabel } from '../utils/tableUtils';

/**
 * QR Operations → Tables — the LIVE table board.
 *
 * Reads the SAME authoritative tables as Table Manager (listQrTables callable) and
 * derives each table's operational status from the live order feed (occupancy) +
 * the qr_reservations subscription (reservations). Clicking a table opens a popup
 * (no navigation): next upcoming reservation first, then a quick reservation form
 * for FREE tables. Table Manager stays the separate route for creating tables /
 * QR administration (the "Open Table Manager" action below).
 */

/** Minimal order shape the occupancy resolver needs (from the parent live feed). */
export interface OpsTableOrder {
    tableId?: string;
    tableNumber: string;
    status: string;
}

interface TableRow {
    id: string;
    tableNumber: string;
    isActive: boolean;
}

// ── Status presentation (uses the ops color vocabulary) ──────────────────────
const STATUS_STYLE: Record<TableStatus, { chip: string; solid: string; dot: string; label: string }> = {
    FREE: { chip: 'bg-emerald-100 text-emerald-900 border-emerald-500', solid: 'bg-emerald-600', dot: 'bg-emerald-500', label: 'Free' },
    OCCUPIED: { chip: 'bg-blue-100 text-blue-900 border-blue-500', solid: 'bg-blue-600', dot: 'bg-blue-500', label: 'Occupied' },
    RESERVED: { chip: 'bg-purple-100 text-purple-900 border-purple-500', solid: 'bg-purple-600', dot: 'bg-purple-500', label: 'Reserved' },
};

function reservationDateLabel(millis: number, now: number): string {
    const d = new Date(millis);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const sameDay = new Date(now).toDateString() === d.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = tomorrow.toDateString() === d.toDateString();
    const day = sameDay ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${day}, ${time}`;
}

interface DerivedTable {
    row: TableRow;
    status: TableStatus;
    reservations: ReservationLite[];   // this table's reservations (for the popup)
    next: ReservationLite | null;      // nearest upcoming (shown first)
}

const OpsTablesTab: React.FC<{
    businessUnitId: string;
    orders: OpsTableOrder[];
    now: number;
    onOpenManager: () => void;
}> = ({ businessUnitId, orders, now, onOpenManager }) => {
    const [tables, setTables] = useState<TableRow[]>([]);
    const [tablesState, setTablesState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [tablesError, setTablesError] = useState<string>('');
    const [reloadKey, setReloadKey] = useState(0);
    const [reservations, setReservations] = useState<QrReservation[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

    // Load the authoritative tables (same source as Table Manager).
    useEffect(() => {
        if (!businessUnitId) return;
        let cancelled = false;
        setTablesState('loading'); setTablesError('');
        listQrTables(businessUnitId)
            .then(res => {
                if (cancelled) return;
                setTables(res.tables.map(t => ({ id: t.id, tableNumber: t.tableNumber, isActive: t.isActive })));
                setTablesState('ready');
            })
            .catch(() => { if (!cancelled) { setTablesState('error'); setTablesError('Couldn’t load tables. Check your connection and retry.'); } });
        return () => { cancelled = true; };
    }, [businessUnitId, reloadKey]);

    // Live reservations for this business unit.
    useEffect(() => {
        if (!businessUnitId) return;
        const unsub = subscribeQrReservations(businessUnitId, setReservations, () => setReservations([]));
        return () => unsub();
    }, [businessUnitId]);

    // Active orders per table (occupancy) — match by authoritative tableId, then number.
    const occupancy = useMemo(() => {
        const byId = new Set<string>();
        const byNumber = new Set<string>();
        for (const o of orders) {
            if (!isActiveStatus(o.status)) continue;
            if (o.tableId) byId.add(o.tableId);
            if (o.tableNumber) byNumber.add(o.tableNumber);
        }
        return { byId, byNumber };
    }, [orders]);

    const derived: DerivedTable[] = useMemo(() => {
        return tables.map(row => {
            const mine = reservations
                .filter(r => r.tableId === row.id)
                .map(toReservationLite);
            const hasActiveOrder = occupancy.byId.has(row.id) || occupancy.byNumber.has(row.tableNumber);
            return {
                row,
                status: resolveTableStatus(hasActiveOrder, mine, now),
                reservations: mine,
                next: nextReservation(mine, now),
            };
        });
    }, [tables, reservations, occupancy, now]);

    const selected = derived.find(d => d.row.id === selectedTableId) ?? null;

    return (
        <div className="space-y-4">
            {/* Header row — live board + the separate Table Manager action */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-black">Tables</h2>
                    <span className="text-sm font-semibold text-slate-500">{derived.length} table{derived.length === 1 ? '' : 's'}</span>
                    {tablesState === 'ready' && (
                        <button type="button" onClick={() => setReloadKey(k => k + 1)} title="Refresh tables"
                            className="ml-1 inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 border-slate-200 text-slate-500 hover:border-slate-400">
                            <RefreshCw size={15} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <LegendDot cls="bg-emerald-500" label="Free" />
                    <LegendDot cls="bg-blue-500" label="Occupied" />
                    <LegendDot cls="bg-purple-500" label="Reserved" />
                    <button type="button" onClick={onOpenManager}
                        className="ml-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-black">
                        <Settings2 size={15} /> <span className="hidden sm:inline">Open Table Manager</span><span className="sm:hidden">Manager</span>
                    </button>
                </div>
            </div>

            {tablesState === 'loading' ? (
                <div className="py-16 text-center text-slate-500 font-semibold inline-flex items-center gap-2 w-full justify-center"><Loader2 size={18} className="animate-spin" /> Loading tables…</div>
            ) : tablesState === 'error' ? (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
                    <AlertCircle size={26} className="mx-auto text-red-500 mb-2" />
                    <p className="text-sm font-bold text-red-800">{tablesError}</p>
                    <button type="button" onClick={() => setReloadKey(k => k + 1)} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-black"><RefreshCw size={15} /> Retry</button>
                </div>
            ) : derived.length === 0 ? (
                <div className="rounded-xl border-2 border-slate-200 bg-white p-8 text-center">
                    <Table2 size={30} className="mx-auto text-slate-400 mb-3" />
                    <h3 className="text-base font-black mb-1">No tables yet</h3>
                    <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">Create tables and print their QR codes in Table Manager. They’ll appear here with live status.</p>
                    <button type="button" onClick={onOpenManager} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-black">Open Table Manager <ChevronRight size={16} /></button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    {derived.map(d => {
                        const s = STATUS_STYLE[d.status];
                        return (
                            <button key={d.row.id} type="button" onClick={() => setSelectedTableId(d.row.id)}
                                className="relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-4 text-left active:scale-[0.98] transition-transform hover:border-slate-300">
                                <span className={`absolute left-0 top-0 h-full w-1.5 ${s.solid}`} />
                                <div className="pl-1.5">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Table</div>
                                    <div className="text-4xl font-black leading-none tabular-nums mt-0.5">{d.row.tableNumber}</div>
                                    <span className={`mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-black uppercase tracking-wide ${s.chip}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
                                    </span>
                                    {d.next && (
                                        <div className="mt-2 text-[11px] leading-tight text-slate-500">
                                            <span className="font-bold text-slate-600">Next:</span> {reservationDateLabel(d.next.reservationAtMillis, now)}
                                            <span className="block truncate">{d.next.customerName}</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selected && (
                <TablePanel
                    table={selected.row}
                    status={selected.status}
                    reservations={selected.reservations}
                    now={now}
                    onClose={() => setSelectedTableId(null)}
                />
            )}
        </div>
    );
};

const LegendDot: React.FC<{ cls: string; label: string }> = ({ cls, label }) => (
    <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-slate-500"><span className={`w-2 h-2 rounded-full ${cls}`} /> {label}</span>
);

// ════════════════════════════════════════════════════════════════════════════
// Table popup — next reservation first, then quick reservation for FREE tables
// ════════════════════════════════════════════════════════════════════════════
const TablePanel: React.FC<{
    table: TableRow;
    status: TableStatus;
    reservations: ReservationLite[];
    now: number;
    onClose: () => void;
}> = ({ table, status, reservations, now, onClose }) => {
    const closeRef = useRef<HTMLButtonElement>(null);
    const [reserving, setReserving] = useState(false);

    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [onClose]);

    const s = STATUS_STYLE[status];
    // Nearest upcoming first (the currently-blocking reservation counts as upcoming).
    const upcoming = upcomingReservations(reservations, now);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={`Table ${table.tableNumber}`}>
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b-2 border-slate-200 px-4 py-3 flex items-center gap-3">
                    <div className="shrink-0 text-center">
                        <div className="text-[10px] font-black uppercase text-slate-400 leading-none">Table</div>
                        <div className="text-3xl font-black leading-none tabular-nums">{table.tableNumber}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-black uppercase tracking-wide ${s.chip}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
                        </span>
                    </div>
                    <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={18} /></button>
                </div>

                <div className="p-4 space-y-4">
                    {/* NEXT RESERVATION — always first when one exists */}
                    {upcoming.length > 0 ? (
                        <section>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Next reservation</h3>
                            <ReservationCard r={upcoming[0]} now={now} emphasized />
                            {upcoming.length > 1 && (
                                <div className="mt-2 space-y-2">
                                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Later</div>
                                    {upcoming.slice(1).map(r => <ReservationCard key={r.id} r={r} now={now} />)}
                                </div>
                            )}
                        </section>
                    ) : (
                        <p className="text-sm text-slate-500">No upcoming reservations.</p>
                    )}

                    {/* Quick reservation — ONLY for an available (FREE) table */}
                    {status === 'FREE' ? (
                        reserving ? (
                            <ReservationForm table={table} existing={reservations} now={now}
                                onCancel={() => setReserving(false)}
                                onSaved={() => setReserving(false) /* live subscription refreshes the list */} />
                        ) : (
                            <button type="button" onClick={() => setReserving(true)}
                                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black">
                                <CalendarPlus size={17} /> Reserve table
                            </button>
                        )
                    ) : (
                        <div className="rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600 inline-flex items-center gap-2 w-full">
                            <AlertCircle size={15} className="shrink-0" />
                            {status === 'OCCUPIED' ? 'Table is currently in use — reserve it once it’s free.' : 'Table is reserved for the time above.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReservationCard: React.FC<{ r: ReservationLite; now: number; emphasized?: boolean }> = ({ r, now, emphasized }) => (
    <div className={`rounded-xl border-2 p-3 ${emphasized ? 'border-purple-300 bg-purple-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-2 font-black"><User size={15} className="text-slate-500" /> {r.customerName}</div>
        <div className="mt-1.5 grid grid-cols-1 gap-1 text-sm text-slate-700">
            <div className="inline-flex items-center gap-2"><CalendarClock size={14} className="text-slate-400" /> {reservationDateLabel(r.reservationAtMillis, now)}</div>
            <div className="inline-flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {r.customerPhone}</div>
        </div>
    </div>
);

// ── Quick reservation form: DATE / TIME / NAME / PHONE ────────────────────────
const ReservationForm: React.FC<{
    table: TableRow;
    existing: ReservationLite[];
    now: number;
    onCancel: () => void;
    onSaved: () => void;
}> = ({ table, existing, now, onCancel, onSaved }) => {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!date) return setError('Please choose a date.');
        if (!time) return setError('Please choose a time.');
        if (!name.trim()) return setError('Please enter the customer name.');
        if (!isValidPhMobile(phone)) return setError('Enter a valid PH mobile number (e.g. 0917 123 4567).');
        const startMillis = new Date(`${date}T${time}`).getTime();
        if (!Number.isFinite(startMillis)) return setError('That date/time looks invalid.');
        if (startMillis < now - 60_000) return setError('Pick a future date and time.');
        // Client-side pre-check (the server re-checks authoritatively).
        if (hasReservationConflict(existing, startMillis, RESERVATION_HOLD_MINUTES)) {
            return setError('That time overlaps an existing reservation for this table.');
        }
        setSaving(true);
        try {
            await createQrReservation({ tableId: table.id, reservationAtMillis: startMillis, customerName: name.trim(), customerPhone: phone });
            onSaved();
        } catch (err) {
            setError(isReservationConflict(err)
                ? 'That table already has a reservation overlapping this time. Pick another time.'
                : toUserFacingReservationError(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="rounded-xl border-2 border-slate-200 p-3 space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Reserve {formatTableLabel(table.tableNumber)}</h3>
            <div className="grid grid-cols-2 gap-2">
                <label className="block">
                    <span className="block text-xs font-bold text-slate-600 mb-1">Date</span>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                        className="w-full rounded-lg border-2 border-slate-200 px-2.5 py-2 text-sm font-semibold focus:border-slate-900 outline-none" />
                </label>
                <label className="block">
                    <span className="block text-xs font-bold text-slate-600 mb-1">Time</span>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} required
                        className="w-full rounded-lg border-2 border-slate-200 px-2.5 py-2 text-sm font-semibold focus:border-slate-900 outline-none" />
                </label>
            </div>
            <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Customer name</span>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required maxLength={80} placeholder="Maria Santos"
                    className="w-full rounded-lg border-2 border-slate-200 px-2.5 py-2 text-sm font-semibold focus:border-slate-900 outline-none" />
            </label>
            <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Phone number</span>
                <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="0917 123 4567"
                    className="w-full rounded-lg border-2 border-slate-200 px-2.5 py-2 text-sm font-semibold focus:border-slate-900 outline-none" />
            </label>
            {error && (
                <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-red-700 bg-red-50 border-2 border-red-200 rounded-lg px-2.5 py-2">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                </p>
            )}
            <div className="flex gap-2">
                <button type="button" onClick={onCancel} disabled={saving}
                    className="flex-1 px-4 py-2.5 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-black hover:border-slate-400 disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-black disabled:opacity-60">
                    {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={16} /> Save reservation</>}
                </button>
            </div>
        </form>
    );
};

export default OpsTablesTab;
