import React, { useMemo, useState, useEffect } from 'react';
import {
    Activity, Clock, User, Filter, Search, RefreshCw,
    ShoppingCart, Package, DollarSign, FileText,
    Utensils, Truck, Trash2, BarChart3, Settings, Shield,
    ChevronDown
} from 'lucide-react';
import type { Requisition, RequisitionHistory, User as UserType, Business } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { ActivityLogService, type ActivityLogEntry, type ActivityModule } from '../../../shared/services/activityLog.service';

interface ActivityLogViewProps {
    requisitions: Requisition[];
    allUsers: UserType[];
    businesses: Business[];
}

// Unified display entry
interface DisplayEntry {
    id: string;
    timestamp: string;
    module: string;
    action: string;
    description: string;
    actorName: string;
    actorId: string;
    businessUnitId: string;
    businessUnitName?: string;
    entityId?: string;
    severity?: string;
    // Procurement-specific
    comments?: string;
    source: 'system' | 'procurement';
}

// ── helpers ──────────────────────────────────────────────────

const formatDateTime = (ts: string | undefined): string => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    });
};

const MODULE_META: Record<string, { icon: React.ElementType; color: string }> = {
    'Procurement':      { icon: ShoppingCart,  color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' },
    'Finance':          { icon: DollarSign,    color: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30' },
    'Inventory':        { icon: Package,       color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' },
    'POS':              { icon: FileText,      color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' },
    'Menu':             { icon: Utensils,      color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
    'Goods Receiving':  { icon: Truck,         color: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30' },
    'Wastage':          { icon: Trash2,        color: 'text-rose-400 bg-rose-500/20 border-rose-500/30' },
    'Reconciliation':   { icon: BarChart3,     color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
    'Settings':         { icon: Settings,      color: 'text-slate-400 bg-slate-500/20 border-slate-500/30' },
    'Admin':            { icon: Shield,        color: 'text-pink-400 bg-pink-500/20 border-pink-500/30' },
    'System':           { icon: Activity,      color: 'text-slate-400 bg-slate-500/20 border-slate-500/30' },
};

const getActionColor = (action: string, severity?: string): string => {
    if (severity === 'error')   return 'text-red-400 bg-red-500/20 border-red-500/30';
    if (severity === 'warning') return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    if (severity === 'success') return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    const a = action.toLowerCase();
    if (a.includes('approve'))  return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (a.includes('reject'))   return 'text-red-400 bg-red-500/20 border-red-500/30';
    if (a.includes('cancel'))   return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    if (a.includes('creat') || a.includes('submit') || a.includes('import'))
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    if (a.includes('release') || a.includes('fund'))
        return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
    if (a.includes('wastage') || a.includes('waste'))
        return 'text-rose-400 bg-rose-500/20 border-rose-500/30';
    if (a.includes('save') || a.includes('update'))
        return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
    return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
};

const ALL_MODULES: ActivityModule[] = [
    'Procurement', 'Finance', 'Inventory', 'POS', 'Menu',
    'Goods Receiving', 'Wastage', 'Reconciliation', 'Settings', 'Admin', 'System',
];

// ── component ─────────────────────────────────────────────────

const ActivityLogView: React.FC<ActivityLogViewProps> = ({ requisitions, allUsers, businesses }) => {
    const [searchTerm, setSearchTerm]     = useState('');
    const { selectedBusinessUnit }        = useBusinessUnit();
    const [moduleFilter, setModuleFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [dateRange, setDateRange]       = useState<'all' | 'today' | 'week' | 'month'>('week');

    // Live system log entries from Firestore
    const [systemEntries, setSystemEntries] = useState<ActivityLogEntry[]>([]);
    const [loadingSystem, setLoadingSystem] = useState(true);

    useEffect(() => {
        setLoadingSystem(true);
        const unsub = ActivityLogService.subscribeLogs(
            {
                businessUnitId: selectedBusinessUnit === 'all' ? undefined : selectedBusinessUnit,
                limitCount: 1000,
            },
            (entries) => {
                setSystemEntries(entries);
                setLoadingSystem(false);
            }
        );
        return () => unsub();
    }, [selectedBusinessUnit]);

    // Legacy procurement entries derived from requisition history
    const legacyEntries: DisplayEntry[] = useMemo(() => {
        const entries: DisplayEntry[] = [];
        requisitions.forEach(req => {
            if (!req.history || !Array.isArray(req.history)) return;
            // BU filter
            if (selectedBusinessUnit !== 'all' && req.businessId !== selectedBusinessUnit) return;

            req.history.forEach((h: RequisitionHistory, i: number) => {
                entries.push({
                    id: `legacy-${req.id}-${i}`,
                    timestamp: h.timestamp || h.date || '',
                    module: 'Procurement',
                    action: h.action,
                    description: req.description || 'No description',
                    actorId: h.actorId,
                    actorName: h.actorName || 'System',
                    businessUnitId: req.businessId,
                    businessUnitName: businesses.find(b => b.id === req.businessId)?.name,
                    entityId: req.id,
                    comments: h.comments,
                    source: 'procurement',
                });
            });
        });
        return entries;
    }, [requisitions, businesses, selectedBusinessUnit]);

    // Convert system entries to DisplayEntry
    const systemDisplayEntries: DisplayEntry[] = useMemo(() =>
        systemEntries.map(e => ({
            id: e.id ?? '',
            timestamp: e.createdAt ?? '',
            module: e.module,
            action: e.action,
            description: e.description,
            actorId: e.actorId,
            actorName: e.actorName,
            businessUnitId: e.businessUnitId,
            businessUnitName: e.businessUnitName ?? businesses.find(b => b.id === e.businessUnitId)?.name,
            entityId: e.entityId,
            severity: e.severity,
            source: 'system' as const,
        })),
        [systemEntries, businesses]
    );

    // Merge + deduplicate procurement entries that already exist in systemEntries
    const allEntries: DisplayEntry[] = useMemo(() => {
        // Keep legacy entries that don't already appear as system entries for same req
        const systemEntityIds = new Set(systemDisplayEntries.map(e => e.entityId).filter(Boolean));
        const filteredLegacy = legacyEntries.filter(e => !systemEntityIds.has(e.entityId));
        return [...systemDisplayEntries, ...filteredLegacy].sort(
            (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
    }, [systemDisplayEntries, legacyEntries]);

    // Apply filters
    const filteredEntries = useMemo(() => {
        return allEntries.filter(entry => {
            // Date range
            if (dateRange !== 'all' && entry.timestamp) {
                const d = new Date(entry.timestamp);
                const now = new Date();
                if (dateRange === 'today') {
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (d < today) return false;
                } else if (dateRange === 'week') {
                    if (d < new Date(now.getTime() - 7 * 24 * 3600 * 1000)) return false;
                } else if (dateRange === 'month') {
                    if (d < new Date(now.getTime() - 30 * 24 * 3600 * 1000)) return false;
                }
            }
            // Module
            if (moduleFilter !== 'all' && entry.module !== moduleFilter) return false;
            // Severity
            if (severityFilter !== 'all' && entry.severity !== severityFilter) return false;
            // Search
            if (searchTerm) {
                const t = searchTerm.toLowerCase();
                return (
                    entry.actorName.toLowerCase().includes(t) ||
                    entry.action.toLowerCase().includes(t) ||
                    entry.description.toLowerCase().includes(t) ||
                    (entry.entityId ?? '').toLowerCase().includes(t) ||
                    (entry.businessUnitName ?? '').toLowerCase().includes(t)
                );
            }
            return true;
        });
    }, [allEntries, dateRange, moduleFilter, severityFilter, searchTerm]);

    // Counts per module for badge
    const moduleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allEntries.forEach(e => { counts[e.module] = (counts[e.module] ?? 0) + 1; });
        return counts;
    }, [allEntries]);

    return (
        <div className="space-y-6 text-white animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Activity className="text-purple-400" size={28} />
                        System Activity Log
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Real-time audit trail across all modules.{' '}
                        <span className="text-purple-400 font-medium">SuperAdmin Only</span>
                    </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    {loadingSystem && (
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <RefreshCw size={13} className="animate-spin" /> Syncing…
                        </span>
                    )}
                    <span className="text-slate-400 flex items-center gap-1.5">
                        <RefreshCw size={14} />
                        {filteredEntries.length.toLocaleString()} entries
                    </span>
                </div>
            </div>

            {/* Module quick-filter pills */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setModuleFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        moduleFilter === 'all'
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                >
                    All Modules
                    <span className="ml-1.5 opacity-70">{allEntries.length}</span>
                </button>
                {ALL_MODULES.filter(m => (moduleCounts[m] ?? 0) > 0).map(m => {
                    const meta = MODULE_META[m];
                    const Icon = meta?.icon ?? Activity;
                    return (
                        <button
                            key={m}
                            onClick={() => setModuleFilter(m)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                moduleFilter === m
                                    ? 'bg-slate-700 border-slate-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                            <Icon size={12} />
                            {m}
                            <span className="opacity-60">{moduleCounts[m]}</span>
                        </button>
                    );
                })}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Date Range */}
                <div className="relative">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                        className="appearance-none pl-4 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                        <option value="today">Today</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="all">All Time</option>
                    </select>
                    <Clock className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>

                {/* Severity */}
                <div className="relative">
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="appearance-none pl-4 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                        <option value="all">All Severity</option>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                    </select>
                    <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by user, action, description, or entity ID…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm w-full focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                    />
                </div>
            </div>

            {/* Table */}
            <Card className="overflow-hidden !p-0">
                <div className="max-h-[640px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                            <tr>
                                <th className="px-5 py-4">Timestamp</th>
                                <th className="px-5 py-4">Module</th>
                                <th className="px-5 py-4">Action</th>
                                <th className="px-5 py-4">Description</th>
                                <th className="px-5 py-4">User</th>
                                <th className="px-5 py-4">Business Unit</th>
                                <th className="px-5 py-4">Entity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60">
                            {filteredEntries.map((entry) => {
                                const meta = MODULE_META[entry.module];
                                const ModIcon = meta?.icon ?? Activity;
                                const user = allUsers.find(u => u.id === entry.actorId);

                                return (
                                    <tr
                                        key={entry.id}
                                        className="hover:bg-slate-800/50 transition-colors"
                                    >
                                        {/* Timestamp */}
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={13} className="text-slate-500 flex-shrink-0" />
                                                <span className="text-slate-300 text-xs">
                                                    {formatDateTime(entry.timestamp)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Module */}
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${meta?.color ?? 'text-slate-400 bg-slate-500/20 border-slate-500/30'}`}>
                                                <ModIcon size={11} />
                                                {entry.module}
                                            </span>
                                        </td>

                                        {/* Action */}
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getActionColor(entry.action, entry.severity)}`}>
                                                {entry.action}
                                            </span>
                                        </td>

                                        {/* Description */}
                                        <td className="px-5 py-3 max-w-[260px]">
                                            <p className="text-slate-300 text-xs truncate" title={entry.description}>
                                                {entry.description}
                                            </p>
                                            {entry.comments && (
                                                <p className="text-xs text-slate-500 italic truncate mt-0.5">
                                                    "{entry.comments}"
                                                </p>
                                            )}
                                        </td>

                                        {/* User */}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                {user?.avatar ? (
                                                    <img src={user.avatar} alt={entry.actorName} className="w-6 h-6 rounded-full flex-shrink-0" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                                        <User size={11} className="text-slate-400" />
                                                    </div>
                                                )}
                                                <span className="text-slate-300 text-xs whitespace-nowrap">{entry.actorName}</span>
                                            </div>
                                        </td>

                                        {/* BU */}
                                        <td className="px-5 py-3">
                                            <span className="text-xs text-slate-400">
                                                {entry.businessUnitName || businesses.find(b => b.id === entry.businessUnitId)?.name || entry.businessUnitId || '—'}
                                            </span>
                                        </td>

                                        {/* Entity */}
                                        <td className="px-5 py-3">
                                            {entry.entityId ? (
                                                <span className="text-xs text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded truncate block max-w-[120px]">
                                                    {entry.entityId}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-600">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredEntries.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500 italic">
                                        <Activity size={40} className="mx-auto mb-3 text-slate-600" />
                                        No activity entries found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default ActivityLogView;
