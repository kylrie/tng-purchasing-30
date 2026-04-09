import React, { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
    ClipboardList,
    Building2,
    Calendar,
    Search,
    Loader2,
    Package,
    ChevronDown,
    ChevronUp,
    User,
    TrendingUp,
    DollarSign,
    Activity
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { Business } from '../../procurement/types';

// ============================================================
// TYPES
// ============================================================

interface ProductionLogEntry {
    id: string;
    itemId: string;
    itemName: string;
    recipeName?: string;        // stored on newer records from the service
    businessUnitId: string;
    type: 'PRODUCTION_YIELD';
    quantity: number;
    balanceAfter: number;
    referenceId: string;        // recipeId — used for legacy fallback
    batchId?: string;           // unique per production run — preferred for consume lookup
    notes: string;
    performedBy: string;
    performedByName: string;
    timestamp: Timestamp;
    unitCost?: number;
}

interface ConsumeEntry {
    id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    balanceAfter: number;
    notes: string;
}

interface Props {
    businesses: Business[];
    defaultBusinessUnitId?: string;   // passed from parent tab to pre-select the BU
    embedded?: boolean;               // hides page-level h1/description when used inside another view
}

// ============================================================
// HELPER: format a Timestamp or date string
// ============================================================

function formatDate(ts: Timestamp | undefined): string {
    if (!ts) return '—';
    return ts.toDate().toLocaleDateString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// ============================================================
// EXPANDABLE ROW COMPONENT — shows raw material breakdown
// ============================================================

const ProductionLogRow: React.FC<{
    entry: ProductionLogEntry;
    consumes: ConsumeEntry[];
    loadingConsumes: boolean;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ entry, consumes, loadingConsumes, isExpanded, onToggle }) => {
    return (
        <>
            <tr
                className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                onClick={onToggle}
            >
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatDate(entry.timestamp)}
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-500/20 rounded-lg">
                            <Activity size={14} className="text-amber-500 dark:text-amber-400" />
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {entry.recipeName || entry.itemName}
                            </span>
                            {entry.recipeName && entry.recipeName !== entry.itemName && (
                                <p className="text-xs text-slate-400">{entry.itemName}</p>
                            )}
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white text-right whitespace-nowrap">
                    {entry.quantity.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">
                    {entry.unitCost != null ? (
                        <span className="flex items-center justify-end gap-0.5">
                            <PesoSign size={12} />
                            {entry.unitCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                    ) : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">
                    {entry.unitCost != null ? (
                        <span className="flex items-center justify-end gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <PesoSign size={12} />
                            {(entry.unitCost * entry.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                    ) : '—'}
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <User size={13} />
                        <span>{entry.performedByName || '—'}</span>
                    </div>
                </td>
                <td className="px-4 py-3 text-center">
                    <button className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </td>
            </tr>

            {/* Expandable consume sub-rows */}
            {isExpanded && (
                <tr className="bg-amber-50/50 dark:bg-amber-500/5 border-b border-slate-200 dark:border-slate-700">
                    <td colSpan={7} className="px-6 py-3">
                        {loadingConsumes ? (
                            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                <Loader2 size={14} className="animate-spin" />
                                Loading ingredients used...
                            </div>
                        ) : consumes.length === 0 ? (
                            <p className="text-xs text-slate-400 py-1 italic">No raw material consumption records found for this run.</p>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">
                                    Raw Materials Consumed in this Run
                                    {entry.batchId && (
                                        <span className="ml-2 normal-case font-normal text-slate-400 text-xs">
                                            Batch {entry.batchId}
                                        </span>
                                    )}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {consumes.map(c => (
                                        <div
                                            key={c.id}
                                            className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700 text-xs"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <Package size={12} className="text-amber-500" />
                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{c.itemName}</span>
                                            </div>
                                            <span className="text-red-500 dark:text-red-400 font-mono font-semibold ml-2">
                                                -{c.quantity.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
};

// ============================================================
// MAIN VIEW
// ============================================================

const ProductionLogsView: React.FC<Props> = ({ businesses, defaultBusinessUnitId, embedded }) => {
    const [selectedBU, setSelectedBU] = useState<string>(
        defaultBusinessUnitId ?? (businesses.length > 0 ? businesses[0].id : '')
    );
    // Helper: format a Date as YYYY-MM-DD in LOCAL timezone (not UTC)
    const toLocalDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const [dateFrom, setDateFrom] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return toLocalDateStr(d);
    });
    const [dateTo, setDateTo] = useState<string>(() =>
        toLocalDateStr(new Date())
    );
    const [search, setSearch] = useState('');

    const [logs, setLogs] = useState<ProductionLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Expanded rows + their consume data
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [consumeMap, setConsumeMap] = useState<Record<string, ConsumeEntry[]>>({});
    const [loadingConsumes, setLoadingConsumes] = useState<Set<string>>(new Set());

    // ── Fetch Production Yield logs ─────────────────────────────────
    const fetchLogs = useCallback(async () => {
        if (!selectedBU) return;
        setIsLoading(true);
        setError(null);
        setExpandedIds(new Set());
        setConsumeMap({});

        try {
            const fromMs = new Date(dateFrom + 'T00:00:00').getTime();
            const toMs = new Date(dateTo + 'T23:59:59').getTime();

            // ✅ Two equality filters only — no composite index required
            const q = query(
                collection(db, 'stock_transactions'),
                where('businessUnitId', '==', selectedBU),
                where('type', '==', 'PRODUCTION_YIELD')
            );

            const snap = await getDocs(q);
            console.log(`[ProductionLogsView] Fetched ${snap.docs.length} raw PRODUCTION_YIELD records for BU ${selectedBU}`);

            // Filter by date range + sort client-side
            const fetched: ProductionLogEntry[] = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as ProductionLogEntry))
                .filter(entry => {
                    if (!entry.timestamp) return true; // keep if no timestamp (edge case)
                    const ms = entry.timestamp.toDate().getTime();
                    return ms >= fromMs && ms <= toMs;
                })
                .sort((a, b) => {
                    const ta = a.timestamp?.toDate().getTime() ?? 0;
                    const tb = b.timestamp?.toDate().getTime() ?? 0;
                    return tb - ta; // newest first
                })
                .slice(0, 200);

            console.log(`[ProductionLogsView] ${fetched.length} records after date filter (${dateFrom} → ${dateTo})`);
            setLogs(fetched);
        } catch (err) {
            console.error('[ProductionLogsView] Error fetching logs:', err);
            setError(`Failed to load production logs: ${err instanceof Error ? err.message : String(err)}`);

        } finally {
            setIsLoading(false);
        }
    }, [selectedBU, dateFrom, dateTo]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // ── Fetch raw-material consumes for a specific production run ───
    const fetchConsumes = async (entry: ProductionLogEntry) => {
        const logId = entry.id;
        if (consumeMap[logId]) return; // Already loaded

        setLoadingConsumes(prev => new Set(prev).add(logId));
        try {
            let snap;

            if (entry.batchId) {
                // ✅ New records: query by batchId (exact run)
                const q = query(
                    collection(db, 'stock_transactions'),
                    where('batchId', '==', entry.batchId),
                    where('type', '==', 'PRODUCTION_CONSUME')
                );
                snap = await getDocs(q);
            } else {
                // ⚠️ Legacy records (no batchId): fallback to referenceId + timestamp window
                // Fetch all PRODUCTION_CONSUME for this recipe, then filter by close timestamp
                const q = query(
                    collection(db, 'stock_transactions'),
                    where('referenceId', '==', entry.referenceId),
                    where('type', '==', 'PRODUCTION_CONSUME'),
                    orderBy('timestamp', 'desc')
                );
                snap = await getDocs(q);
            }

            const entries: ConsumeEntry[] = snap.docs.map(d => ({
                id: d.id,
                itemId: d.data().itemId,
                itemName: d.data().itemName,
                quantity: d.data().quantity,
                balanceAfter: d.data().balanceAfter,
                notes: d.data().notes
            }));
            setConsumeMap(prev => ({ ...prev, [logId]: entries }));
        } catch (err) {
            console.error('[ProductionLogsView] Error fetching consumes:', err);
            setConsumeMap(prev => ({ ...prev, [logId]: [] }));
        } finally {
            setLoadingConsumes(prev => {
                const next = new Set(prev);
                next.delete(logId);
                return next;
            });
        }
    };

    const toggleExpand = (entry: ProductionLogEntry) => {
        const next = new Set(expandedIds);
        if (next.has(entry.id)) {
            next.delete(entry.id);
        } else {
            next.add(entry.id);
            fetchConsumes(entry);  // pass the full entry so we can use batchId or referenceId
        }
        setExpandedIds(next);
    };

    // ── Filter by search ─────────────────────────────────────────────
    const filtered = search.trim()
        ? logs.filter(l =>
            l.itemName.toLowerCase().includes(search.toLowerCase()) ||
            l.performedByName?.toLowerCase().includes(search.toLowerCase())
        )
        : logs;

    // ── Stats ─────────────────────────────────────────────────────────
    const totalRuns = filtered.length;
    const totalUnits = filtered.reduce((s, l) => s + l.quantity, 0);
    const totalCost = filtered.reduce((s, l) => s + (l.unitCost ? l.unitCost * l.quantity : 0), 0);
    const uniqueItems = new Set(filtered.map(l => l.itemName)).size;

    // ── Render ────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header — hidden when embedded inside another page */}
            {!embedded && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ClipboardList className="text-amber-500 dark:text-amber-400" />
                        Production Logs
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        View all past production runs and the raw materials consumed
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Business Unit */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                        <Building2 size={16} className="text-slate-500 dark:text-slate-400" />
                        <select
                            value={selectedBU}
                            onChange={e => setSelectedBU(e.target.value)}
                            className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-sm"
                        >
                            {businesses.map(bu => (
                                <option key={bu.id} value={bu.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                    {bu.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date From */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                        <Calendar size={16} className="text-slate-500 dark:text-slate-400" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-sm"
                        />
                    </div>

                    {/* Date To */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                        <Calendar size={16} className="text-slate-500 dark:text-slate-400" />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-sm"
                        />
                    </div>
                </div>
            </div>
            )}

            {/* Filters row — shown even when embedded */}
            {embedded && (
            <div className="flex flex-wrap items-center gap-3">
                {/* Date From */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                    <Calendar size={16} className="text-slate-500 dark:text-slate-400" />
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-sm"
                    />
                </div>
                <span className="text-slate-400 text-sm">to</span>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                    <Calendar size={16} className="text-slate-500 dark:text-slate-400" />
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-sm"
                    />
                </div>
            </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <ClipboardList size={16} className="text-amber-500" />
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase">Total Runs</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalRuns}</p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-emerald-500" />
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase">Total Units</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {totalUnits.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={16} className="text-blue-500" />
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase">Total Cost</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <PesoSign size={18} />
                        {totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-2 mb-1">
                        <Package size={16} className="text-purple-500" />
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase">Unique Items</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{uniqueItems}</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by recipe or operator..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm dark:shadow-none overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <Loader2 size={40} className="text-amber-400 animate-spin mx-auto mb-3" />
                            <p className="text-slate-400 text-sm">Loading production logs...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center max-w-sm">
                            <p className="text-red-400 font-medium mb-2">Failed to load logs</p>
                            <p className="text-slate-500 text-sm">{error}</p>
                            <button
                                onClick={fetchLogs}
                                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <ClipboardList size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">No production logs found</p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm">
                            {search ? 'Try adjusting your search' : 'Adjust the date range or perform a production run'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Date & Time</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recipe / Item</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Qty Produced</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Cost/Unit</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Total Cost</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Performed By</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(entry => (
                                    <ProductionLogRow
                                        key={entry.id}
                                        entry={entry}
                                        consumes={consumeMap[entry.id] ?? []}
                                        loadingConsumes={loadingConsumes.has(entry.id)}
                                        isExpanded={expandedIds.has(entry.id)}
                                        onToggle={() => toggleExpand(entry)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer note */}
            {!isLoading && filtered.length > 0 && (
                <p className="text-xs text-slate-400 text-center">
                    Showing {filtered.length} production run{filtered.length !== 1 ? 's' : ''}.
                    Click any row to see the raw materials consumed in that run.
                </p>
            )}
        </div>
    );
};

export default ProductionLogsView;
