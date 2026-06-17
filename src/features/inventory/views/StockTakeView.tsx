import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Package,
    Search,
    Play,
    X,
    Check,
    AlertTriangle,
    Boxes,
    Factory,
    Wrench,
    MapPin,

    Upload,
    Download,
    ClipboardList,
    TrendingUp,
    TrendingDown,
    Minus,
    Tag,
    ChevronDown,
    ChevronRight,
    User2,
    Calendar,
    Save,
    Wine,
    UtensilsCrossed,
    ShoppingCart,
    LayoutGrid,
    Briefcase
} from 'lucide-react';
import type { InventoryItem, InventoryItemType, InventoryDepartment, StockCountSession, StocktakeAuditLog } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';
import * as XLSX from 'xlsx';
import VisualCountRow from '../components/VisualCountRow';
import type { User, Business } from '../../procurement/types';
import { UI_CONSTANTS } from '../../../config/constants';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { GeminiVisionService } from '../../../shared/services/gemini-vision.service';
import { exportToCSV } from '../../../shared/utils/exportUtils';

// ============================================================
// PROPS
// ============================================================

interface StockTakeViewProps {
    currentUser: User;
    businesses: Business[];
}

interface CountItemState {
    itemId: string;
    count: number;
    partialCount: number;
    unit: string;
}

// Type tab configuration
// NOTE: FINISHED_GOOD is intentionally excluded — FGs are sold items managed
// via BOM explosion from POS imports and must NOT be physically counted.
const TYPE_TABS: { key: InventoryItemType | 'ALL'; label: string; icon: React.ElementType }[] = [
    { key: 'ALL', label: 'All Items', icon: Package },
    { key: 'RAW_MATERIAL', label: 'Raw Materials', icon: Boxes },
    { key: 'PRODUCTION', label: 'Production', icon: Factory },
    { key: 'ASSET', label: 'Assets', icon: Wrench }
];

const DEPARTMENT_TABS: { key: InventoryDepartment | 'ALL'; label: string; icon: React.ElementType }[] = [
    { key: 'ALL', label: 'All Departments', icon: LayoutGrid },
    { key: 'Bar', label: 'Bar', icon: Wine },
    { key: 'Kitchen', label: 'Kitchen', icon: UtensilsCrossed },
    { key: 'Retail', label: 'Retail', icon: ShoppingCart },
    { key: 'Office', label: 'Office', icon: Briefcase }
];

// ============================================================
// CALCULATOR POPUP
// ============================================================

const CalculatorPopup: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: number) => void;
    currentValue: number;
    itemName: string;
    unit: string;
}> = ({ isOpen, onClose, onSubmit, currentValue, itemName, unit }) => {
    const [value, setValue] = useState(currentValue.toString());

    const evaluateExpression = (expr: string): string => {
        try {
            const sanitized = expr.replace(/[^0-9+\-*/.]/g, '');
            if (!sanitized) return '0';
            // eslint-disable-next-line no-new-func
            const result = new Function(`return ${sanitized}`)();
            return Number.isFinite(result) ? String(Number(result.toFixed(4))) : '0';
        } catch {
            return expr;
        }
    };

    const handleKeyPress = (key: string) => {
        if (key === 'C') setValue('0');
        else if (key === '⌫') setValue(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        else if (key === '=') setValue(prev => evaluateExpression(prev));
        else if (['+', '-', '*', '/'].includes(key)) setValue(prev => prev + key);
        else if (key === '.') setValue(prev => prev + '.');
        else if (/[0-9]/.test(key)) setValue(prev => prev === '0' ? key : prev + key);
    };

    const handleSubmit = () => {
        const evaluated = evaluateExpression(value);
        onSubmit(parseFloat(evaluated) || 0);
        onClose();
    };

    // ── Keyboard support ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            // Prevent default for keys we handle so the browser doesn't scroll etc.
            const handled = [
                'Backspace', 'Delete', 'Enter', 'NumpadEnter', 'Escape',
                'Decimal', 'Period',
                '0','1','2','3','4','5','6','7','8','9',
                'Numpad0','Numpad1','Numpad2','Numpad3','Numpad4',
                'Numpad5','Numpad6','Numpad7','Numpad8','Numpad9',
                '+', '-', '*', '/', '=', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEqual'
            ];
            if (handled.includes(e.key) || handled.includes(e.code)) {
                e.preventDefault();
            }

            if (e.key === 'Escape') { onClose(); return; }
            if (e.key === 'Enter' || e.code === 'NumpadEnter') { handleSubmit(); return; }
            if (e.key === 'Backspace') { handleKeyPress('⌫'); return; }
            if (e.key === 'Delete') { handleKeyPress('C'); return; }
            if (e.key === '+' || e.code === 'NumpadAdd') { handleKeyPress('+'); return; }
            if (e.key === '-' || e.code === 'NumpadSubtract') { handleKeyPress('-'); return; }
            if (e.key === '*' || e.code === 'NumpadMultiply') { handleKeyPress('*'); return; }
            if (e.key === '/' || e.code === 'NumpadDivide') { handleKeyPress('/'); return; }
            if (e.key === '=' || e.code === 'NumpadEqual') { handleKeyPress('='); return; }
            if (e.key === '.' || e.key === ',' || e.code === 'Decimal') { handleKeyPress('.'); return; }
            // Digit row (0-9) and numpad (Numpad0-Numpad9)
            if (/^[0-9]$/.test(e.key)) { handleKeyPress(e.key); return; }
            if (/^Numpad[0-9]$/.test(e.code)) { handleKeyPress(e.code.replace('Numpad', '')); return; }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, value]);
    // ─────────────────────────────────────────────────────────────────────────

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{itemName}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Enter count in {unit}s</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-right overflow-x-auto whitespace-nowrap">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">{value}</span>
                        <span className="text-xl text-slate-400 ml-2">{unit}s</span>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 p-4 pt-0">
                    {['C', '/', '*', '⌫', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '00', '.', ''].map((key, idx) => (
                        <button
                            key={idx}
                            onClick={() => key && handleKeyPress(key)}
                            className={`h-14 rounded-xl font-semibold text-lg transition-all flex items-center justify-center ${key === 'C' ? 'bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400'
                                : key === '⌫' ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 dark:text-amber-400'
                                : ['+', '-', '*', '/', '='].includes(key) ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50'
                                : key === '' ? 'invisible'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                        >
                            {key}
                        </button>
                    ))}
                </div>

                <div className="p-4 pt-0">
                    <button
                        onClick={handleSubmit}
                        className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center justify-center gap-2"
                    >
                        <Check size={20} />
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// REVIEW UPLOAD MODAL
// ============================================================

const ReviewUploadModal: React.FC<{
    isOpen: boolean;
    pendingCounts: { itemId: string; name: string; count: number; partialCount: number; unit: string }[] | null;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ isOpen, pendingCounts, onConfirm, onCancel }) => {
    if (!isOpen || !pendingCounts) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">Review Uploaded Counts</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Found {pendingCounts.length} items</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {pendingCounts.map((pc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">{pc.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">ID: {pc.itemId}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {pc.count}{pc.partialCount > 0 ? `.${pc.partialCount.toString().split('.')[1] || pc.partialCount}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{pc.unit}s</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2">
                        <Check size={18} /> Apply Counts
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// STOCKTAKE LOGS PANEL — Grouped accordion by session
// ============================================================

interface SessionGroup {
    sessionId: string;
    date: Date;
    countedByName: string;
    logs: StocktakeAuditLog[];
    totalItems: number;
    decreases: number;
    increases: number;
    unchanged: number;
}

const StocktakeLogsPanel: React.FC<{
    logs: StocktakeAuditLog[];
    isLoading: boolean;
}> = ({ logs, isLoading }) => {
    const [search, setSearch] = useState('');
    const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

    // Group logs by sessionId
    const sessionGroups = useMemo(() => {
        const groupMap = new Map<string, SessionGroup>();

        logs.forEach(log => {
            const ts = log.submittedAt?.toDate?.();
            if (!groupMap.has(log.sessionId)) {
                groupMap.set(log.sessionId, {
                    sessionId: log.sessionId,
                    date: ts || new Date(),
                    countedByName: log.countedByName || 'Unknown',
                    logs: [],
                    totalItems: 0,
                    decreases: 0,
                    increases: 0,
                    unchanged: 0
                });
            }
            const group = groupMap.get(log.sessionId)!;
            // Use earliest timestamp
            if (ts && ts < group.date) group.date = ts;
            group.logs.push(log);
            group.totalItems++;
            if (log.variance < 0) group.decreases++;
            else if (log.variance > 0) group.increases++;
            else group.unchanged++;
        });

        return Array.from(groupMap.values())
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [logs]);

    // Search filter: filter groups that have matching items
    const filteredGroups = useMemo(() => {
        if (!search) return sessionGroups;
        const q = search.toLowerCase();
        return sessionGroups.map(group => ({
            ...group,
            logs: group.logs.filter(l => l.itemName.toLowerCase().includes(q))
        })).filter(g => g.logs.length > 0);
    }, [sessionGroups, search]);

    const toggleSession = (sessionId: string) => {
        setExpandedSessions(prev => {
            const next = new Set(prev);
            if (next.has(sessionId)) next.delete(sessionId);
            else next.add(sessionId);
            return next;
        });
    };

    const formatGroupDate = (date: Date) =>
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const formatGroupTime = (date: Date) =>
        date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const typeLabel: Record<string, string> = {
        RAW_MATERIAL: 'Raw Material',
        PRODUCTION: 'Production',
        ASSET: 'Asset',
        FINISHED_GOOD: 'Finished Good'
    };
    const typeBadge: Record<string, string> = {
        RAW_MATERIAL: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        PRODUCTION: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        ASSET: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
        FINISHED_GOOD: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search item name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                />
            </div>

            {/* Summary */}
            <div className="flex gap-3 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {filteredGroups.length} sessions
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {logs.length} total entries
                </span>
            </div>

            {/* Session Groups */}
            {filteredGroups.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <ClipboardList size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No stocktake logs yet.</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Logs are created when you submit a counting session.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredGroups.map(group => {
                        const isExpanded = expandedSessions.has(group.sessionId);
                        return (
                            <div key={group.sessionId} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm dark:shadow-none transition-all">
                                {/* Session Header — clickable */}
                                <button
                                    onClick={() => toggleSession(group.sessionId)}
                                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                                >
                                    {/* Expand icon */}
                                    <div className="text-slate-400 dark:text-slate-500 flex-shrink-0">
                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>

                                    {/* Date & Time */}
                                    <div className="flex-shrink-0">
                                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-semibold text-sm">
                                            <Calendar size={14} className="text-cyan-500 dark:text-cyan-400" />
                                            {formatGroupDate(group.date)}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-5">
                                            {formatGroupTime(group.date)}
                                        </p>
                                    </div>

                                    {/* Submitted By */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        <User2 size={14} className="text-purple-500 dark:text-purple-400" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{group.countedByName}</span>
                                    </div>

                                    {/* Spacer */}
                                    <div className="flex-1" />

                                    {/* Stats badges */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            {group.totalItems} items
                                        </span>
                                        {group.decreases > 0 && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-1">
                                                <TrendingDown size={11} /> {group.decreases}
                                            </span>
                                        )}
                                        {group.increases > 0 && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center gap-1">
                                                <TrendingUp size={11} /> {group.increases}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {/* Expanded Detail Table */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 dark:border-slate-700">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item</th>
                                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                                                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Before</th>
                                                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">After</th>
                                                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Variance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                    {group.logs.map(log => {
                                                        const varianceColor = log.variance > 0
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : log.variance < 0
                                                                ? 'text-red-500 dark:text-red-400'
                                                                : 'text-slate-400 dark:text-slate-500';
                                                        return (
                                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                                <td className="px-4 py-3">
                                                                    <span className="font-medium text-slate-900 dark:text-white">{log.itemName}</span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge[log.itemType] ?? ''}`}>
                                                                        {typeLabel[log.itemType] ?? log.itemType}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                                    {log.stockBefore.toFixed(2)} {log.unit}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                                                                    {log.stockAfter.toFixed(2)} {log.unit}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <span className={`inline-flex items-center gap-1 font-semibold ${varianceColor}`}>
                                                                        {log.variance > 0 ? <TrendingUp size={13} /> : log.variance < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                                                                        {log.variance > 0 ? '+' : ''}{log.variance.toFixed(2)}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ============================================================
// REVIEW PANEL
// ============================================================

const STOCK_COUNT_TYPES = ['Cycle Count', 'Daily Count', 'Spot Count'] as const;

const ReviewPanel: React.FC<{
    session: StockCountSession | null;
    countStates: Map<string, CountItemState>;
    items: InventoryItem[];
    onSubmit: (sessionName: string) => void;
    onSaveDraft: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
    isSavingDraft: boolean;
    activeDepartmentTab: InventoryDepartment | 'ALL';
}> = ({ session, countStates, items, onSubmit, onSaveDraft, onCancel, isSubmitting, isSavingDraft, activeDepartmentTab }) => {
    const [selectedCountType, setSelectedCountType] = useState<string>('');
    const countedItemsCount = countStates.size;
    const totalItems = items.length;

    // Build the full session name: "Cycle Count [06-4-2026]"
    const buildSessionName = () => {
        if (!selectedCountType) return '';
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const d = now.getDate();
        const y = now.getFullYear();
        
        const departmentLabel = activeDepartmentTab === 'ALL' ? 'All Departments' : activeDepartmentTab;
        return `${selectedCountType} - ${departmentLabel} [${mm}-${d}-${y}]`;
    };

    let totalValue = 0;
    countStates.forEach((state, itemId) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            const conversion = item.units.conversion > 0 ? item.units.conversion : 1;
            const totalCountUnits = (state.count + state.partialCount) * conversion;
            totalValue += totalCountUnits * item.costPerUnit;
        }
    });

    return (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700 p-6 sticky top-4 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Check size={20} className="text-cyan-500 dark:text-cyan-400" />
                Review & Submit
            </h3>

            {/* Count Type Selector */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                    Count Type <span className="text-red-500">*</span>
                </label>
                <select
                    value={selectedCountType}
                    onChange={(e) => setSelectedCountType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                >
                    <option value="">Select count type...</option>
                    {STOCK_COUNT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
                {selectedCountType && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                        Will be saved as: <span className="text-cyan-600 dark:text-cyan-400 font-medium">{buildSessionName()}</span>
                    </p>
                )}
            </div>

            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Items Counted</span>
                    <span className="text-slate-900 dark:text-white font-medium">{countedItemsCount} / {totalItems}</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
                        style={{ width: `${totalItems > 0 ? (countedItemsCount / totalItems) * 100 : 0}%` }}
                    />
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Total Value</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        ₱{totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                </div>

                {session && (
                    <div className="text-xs text-slate-500">
                        Session started: {session.startedAt?.toDate?.()?.toLocaleString() || 'Just now'}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <button
                    onClick={() => onSubmit(buildSessionName())}
                    disabled={countedItemsCount === 0 || isSubmitting || isSavingDraft || !selectedCountType}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Check size={18} />
                    )}
                    Submit Stock Count
                </button>

                <button
                    onClick={onSaveDraft}
                    disabled={countedItemsCount === 0 || isSubmitting || isSavingDraft}
                    className="w-full py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold rounded-xl hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                    {isSavingDraft ? (
                        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    Save Draft
                </button>

                <button
                    onClick={onCancel}
                    disabled={isSubmitting || isSavingDraft}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-2 transition-colors"
                >
                    <X size={18} />
                    Cancel Session
                </button>
            </div>
        </div>
    );
};

// ============================================================
// ROLE-BASED ACCESS: Only these roles can view Stocktake Logs
// ============================================================
const LOGS_ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BOARD_OF_DIRECTOR'];

// ============================================================
// MAIN COMPONENT
// ============================================================

const StockTakeView: React.FC<StockTakeViewProps> = ({ currentUser, businesses }) => {
    // Business unit selection
    const { selectedBusinessUnit } = useBusinessUnit();
    const { hasPermission } = usePermissions();

    // Role-based access for Logs tab
    const canViewLogs = LOGS_ALLOWED_ROLES.includes(currentUser.role);

    // Main view tab: 'count' | 'logs'
    const [mainTab, setMainTab] = useState<'count' | 'logs'>('count');

    // Type filter tab
    const [activeTypeTab, setActiveTypeTab] = useState<InventoryItemType | 'ALL'>('ALL');

    // Storage area filter
    const [storageAreas, setStorageAreas] = useState<string[]>([]);
    const [activeStorageArea, setActiveStorageArea] = useState<string>('ALL');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');
    const [activeDepartmentTab, setActiveDepartmentTab] = useState<InventoryDepartment | 'ALL'>('ALL');

    // Data state
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [session, setSession] = useState<StockCountSession | null>(null);
    const [hasActiveDraft, setHasActiveDraft] = useState(false);
    const [countStates, setCountStates] = useState<Map<string, CountItemState>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [calculatorItem, setCalculatorItem] = useState<InventoryItem | null>(null);

    // Logs state
    const [auditLogs, setAuditLogs] = useState<StocktakeAuditLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Import/Export state
    const [isUploadingCountSheet, setIsUploadingCountSheet] = useState(false);
    const [pendingCounts, setPendingCounts] = useState<{ itemId: string; name: string; count: number; partialCount: number; unit: string }[] | null>(null);
    const [showUncountedOnly, setShowUncountedOnly] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);

    const countSheetInputRef = useRef<HTMLInputElement>(null);

    // Load inventory when BU or type changes
    useEffect(() => {
        const loadData = async () => {
            if (!selectedBusinessUnit) return;

            setIsLoading(true);
            try {
                const typeFilter = activeTypeTab === 'ALL' ? undefined : activeTypeTab;
                const [fetchedItems, fetchedAreas] = await Promise.all([
                    InventoryService.getInventory(selectedBusinessUnit, typeFilter),
                    InventoryService.getStorageAreas()
                ]);

                // CRITICAL: Always exclude FINISHED_GOOD from the stock-take list.
                // Finished Goods are managed virtually via BOM explosion from POS sales.
                // They must never appear in a physical counting session.
                const countableItems = fetchedItems.filter(
                    item => item.type !== 'FINISHED_GOOD'
                );
                setItems(countableItems);
                setStorageAreas(fetchedAreas);

                const openSession = await InventoryService.getOpenSession(selectedBusinessUnit, currentUser.id);
                if (openSession) {
                    setHasActiveDraft(true);
                } else {
                    setHasActiveDraft(false);
                }
            } catch (err) {
                console.error('Error loading data:', err);
                setError('Failed to load inventory');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [selectedBusinessUnit, activeTypeTab, currentUser.id]);

    // Load audit logs when Logs tab is opened or BU changes
    useEffect(() => {
        if (mainTab !== 'logs' || !selectedBusinessUnit || !canViewLogs) return;
        const loadLogs = async () => {
            setIsLoadingLogs(true);
            try {
                const logs = await InventoryService.getStocktakeAuditLogs(selectedBusinessUnit);
                setAuditLogs(logs);
            } catch (err) {
                console.error('Error loading audit logs:', err);
            } finally {
                setIsLoadingLogs(false);
            }
        };
        loadLogs();
    }, [mainTab, selectedBusinessUnit]);

    // Derive unique categories from loaded items for dynamic filter pills
    const availableCategories = React.useMemo(() => {
        const cats = new Set<string>();
        items.forEach(item => { if (item.category) cats.add(item.category); });
        return Array.from(cats).sort();
    }, [items]);

    // Filter items
    const filteredItems = items.filter(item => {
        const matchesSearch = searchQuery === '' ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStorageArea = activeStorageArea === 'ALL' ||
            item.storageAreas.includes(activeStorageArea);
        const matchesCategory = activeCategoryFilter === 'ALL' ||
            item.category === activeCategoryFilter;
        const matchesDepartment = activeDepartmentTab === 'ALL' ||
            (item.department || 'Unassigned') === activeDepartmentTab;
        const matchesUncounted = !showUncountedOnly || !countStates.has(item.id);
        return matchesSearch && matchesStorageArea && matchesCategory && matchesDepartment && matchesUncounted;
    });

    // Session handlers
    const startSession = async () => {
        if (!selectedBusinessUnit) return;
        try {
            const selectedBU = businesses.find(b => b.id === selectedBusinessUnit);
            await InventoryService.startSession({
                businessUnitId: selectedBusinessUnit,
                location: selectedBU?.name || 'All Areas',
                performedBy: currentUser.id,
                performedByName: currentUser.name
            });
            const openSession = await InventoryService.getOpenSession(selectedBusinessUnit, currentUser.id);
            setSession(openSession);
        } catch (err) {
            console.error('Error starting session:', err);
            setError('Failed to start session');
        }
    };

    const handleCountChange = useCallback((itemId: string, count: number, partialCount: number, unit: string) => {
        setCountStates(prev => {
            const newStates = new Map(prev);
            newStates.set(itemId, { itemId, count, partialCount, unit });
            return newStates;
        });
    }, []);

    const saveDraft = async () => {
        if (!session) return;
        setIsSavingDraft(true);
        try {
            for (const [itemId, state] of countStates) {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    await InventoryService.saveCountItem({
                        sessionId: session.id,
                        itemId,
                        itemName: item.name,
                        count: state.count,
                        unit: state.unit,
                        partialCount: state.partialCount
                    });
                }
            }
            setSession(null);
            setCountStates(new Map());
            setHasActiveDraft(true);
            alert('Draft saved successfully!');
        } catch (err) {
            console.error('Error saving draft:', err);
            setError('Failed to save draft');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const submitSession = async (sessionName: string) => {
        if (!session) return;
        setIsSubmitting(true);
        try {
            for (const [itemId, state] of countStates) {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    await InventoryService.saveCountItem({
                        sessionId: session.id,
                        itemId,
                        itemName: item.name,
                        count: state.count,
                        unit: state.unit,
                        partialCount: state.partialCount
                    });
                }
            }
            await InventoryService.submitSession(session.id, sessionName);
            setSession(null);
            setCountStates(new Map());
            setHasActiveDraft(false);
            alert('Stock count submitted successfully!');
            // Refresh logs if on logs tab
            if (mainTab === 'logs') {
                const logs = await InventoryService.getStocktakeAuditLogs(selectedBusinessUnit);
                setAuditLogs(logs);
            }
        } catch (err) {
            console.error('Error submitting:', err);
            setError('Failed to submit stock count');
        } finally {
            setIsSubmitting(false);
        }
    };

    const cancelSession = async () => {
        if (!session) return;
        if (confirm('Cancel this session? All counts will be lost.')) {
            await InventoryService.cancelSession(session.id);
            setSession(null);
            setCountStates(new Map());
            setHasActiveDraft(false);
        }
    };

    const resumeSession = async () => {
        if (!selectedBusinessUnit) return;
        setIsLoading(true);
        try {
            const openSession = await InventoryService.getOpenSession(selectedBusinessUnit, currentUser.id);
            if (openSession) {
                setSession(openSession);
                const states = new Map<string, CountItemState>();
                openSession.items.forEach(item => {
                    states.set(item.itemId, {
                        itemId: item.itemId,
                        count: item.count,
                        partialCount: item.partialCount,
                        unit: item.unit
                    });
                });
                setCountStates(states);
            }
        } catch (err) {
            console.error('Error resuming session:', err);
            setError('Failed to resume session');
        } finally {
            setIsLoading(false);
        }
    };

    // Calculator handlers
    const openCalculator = (item: InventoryItem) => setCalculatorItem(item);
    const handleCalculatorSubmit = (value: number) => {
        if (calculatorItem) {
            const state = countStates.get(calculatorItem.id);
            handleCountChange(
                calculatorItem.id,
                value,
                state?.partialCount ?? 0,
                state?.unit ?? calculatorItem.units.recipeUnit
            );
        }
        setCalculatorItem(null);
    };

    const handleDownloadCountSheetTemplate = (targetDept: InventoryDepartment | 'ALL' = activeDepartmentTab) => {
        const deptFilter = targetDept === 'ALL' ? undefined : targetDept;
        const countableItems = items.filter(i => {
            if (i.type === 'FINISHED_GOOD') return false;
            if (deptFilter && (i.department || 'Unassigned') !== deptFilter) return false;
            return true;
        });

        if (countableItems.length === 0) {
            setError('No items available for this department.');
            setTimeout(() => setError(null), UI_CONSTANTS.TOAST_DURATION_SHORT);
            return;
        }

        const deptName = targetDept === 'ALL' ? 'All_Departments' : targetDept;
        const filename = `Count_Sheet_${deptName}_${new Date().toISOString().split('T')[0]}`;

        exportToCSV(
            countableItems,
            [
                { header: 'SKU', accessor: (item) => item.sku || '' },
                { header: 'Name', accessor: (item) => item.name },
                { header: 'Current Stock', accessor: (item) => item.currentStock },
                { header: 'Counted Stock', accessor: () => '' },
                { header: 'Unit', accessor: (item) => item.units.recipeUnit },
                { header: 'Discrepancy', accessor: () => '' }
            ],
            filename
        );
    };

    const handleUploadCountSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !session) return;
        setIsUploadingCountSheet(true);
        try {
            // Read file and convert to CSV string
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const csvText = XLSX.utils.sheet_to_csv(worksheet);

            // Pass to Gemini
            const availableItems = items.map(i => ({ 
                id: i.id, 
                name: i.name,
                recipeUnit: i.units.recipeUnit,
                buyUnit: i.units.buyUnit,
                conversion: i.units.conversion || 1
            }));
            const extractedCounts = await GeminiVisionService.extractManualCounts(csvText, availableItems);

            const newPending: { itemId: string; name: string; count: number; partialCount: number; unit: string }[] = [];
            for (const [itemId, countVal] of Object.entries(extractedCounts)) {
                if (typeof countVal === 'number' && !isNaN(countVal)) {
                    const item = items.find(i => i.id === itemId);
                    if (item) {
                        newPending.push({
                            itemId,
                            name: item.name,
                            count: Math.floor(countVal),
                            partialCount: Number((countVal % 1).toFixed(3)),
                            unit: item.units.recipeUnit
                        });
                    }
                }
            }

            if (newPending.length > 0) {
                setPendingCounts(newPending);
            } else {
                setError('No valid counts could be extracted from the file.');
                setTimeout(() => setError(null), UI_CONSTANTS.TOAST_DURATION_SHORT);
            }
        } catch (err) {
            console.error('Failed to parse count sheet:', err);
            setError('Failed to process count sheet');
            setTimeout(() => setError(null), UI_CONSTANTS.TOAST_DURATION_SHORT);
        } finally {
            setIsUploadingCountSheet(false);
            if (countSheetInputRef.current) countSheetInputRef.current.value = '';
        }
    };

    const confirmPendingCounts = () => {
        if (!pendingCounts) return;
        setCountStates(prev => {
            const next = new Map(prev);
            pendingCounts.forEach(pc => {
                next.set(pc.itemId, {
                    itemId: pc.itemId,
                    count: pc.count,
                    partialCount: pc.partialCount,
                    unit: pc.unit
                });
            });
            return next;
        });
        setPendingCounts(null);
    };

    const currentBusiness = businesses.find(b => b.id === selectedBusinessUnit);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading inventory...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Side: Title & Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Package className="text-purple-600 dark:text-purple-400" />
                            Stock Take
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Count and reconcile physical inventory
                        </p>
                    </div>

                    {/* Main Tab Toggle */}
                    <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                            onClick={() => setMainTab('count')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                mainTab === 'count'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <Package size={16} />
                            Count
                        </button>
                        {canViewLogs && (
                        <button
                            onClick={() => setMainTab('logs')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                mainTab === 'logs'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <ClipboardList size={16} />
                            Logs
                        </button>
                        )}
                    </div>
                </div>

                {/* Right Side: Actions & Session Status */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Session Status (Count tab only) */}
                    {mainTab === 'count' && (
                        <div className="flex items-center gap-3">
                            {!session ? (
                                hasActiveDraft ? (
                                    <button
                                        onClick={resumeSession}
                                        className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center gap-2"
                                    >
                                        <Play size={18} />
                                        Resume Draft
                                    </button>
                                ) : (
                                    <button
                                        onClick={startSession}
                                        className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center gap-2"
                                    >
                                        <Play size={18} />
                                        Start Session
                                    </button>
                                )
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl font-medium border border-purple-200 dark:border-purple-800/50">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                        Active Session
                                    </div>
                                    <input
                                        type="file"
                                        ref={countSheetInputRef}
                                        onChange={handleUploadCountSheet}
                                        accept=".csv, .xlsx, .xls"
                                        className="hidden"
                                    />
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                            onBlur={() => setTimeout(() => setShowDownloadMenu(false), 200)}
                                            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-colors"
                                        >
                                            <Download size={16} />
                                            Download Template
                                            <ChevronDown size={14} className="ml-1" />
                                        </button>
                                        {showDownloadMenu && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                                                <button
                                                    onClick={() => { handleDownloadCountSheetTemplate('ALL'); setShowDownloadMenu(false); }}
                                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                                                >
                                                    All Departments
                                                </button>
                                                {DEPARTMENT_TABS.filter(tab => tab.key !== 'ALL').map(tab => (
                                                    <button
                                                        key={tab.key}
                                                        onClick={() => { handleDownloadCountSheetTemplate(tab.key); setShowDownloadMenu(false); }}
                                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                                                    >
                                                        {tab.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => countSheetInputRef.current?.click()}
                                        disabled={isUploadingCountSheet}
                                        className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                                    >
                                        {isUploadingCountSheet ? (
                                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Upload size={16} />
                                        )}
                                        Upload Counts
                                    </button>
                                </div>
                            )}
                        </div>
                    )}


                </div>
            </div>

            {/* LOGS TAB (role-gated) */}
            {mainTab === 'logs' && canViewLogs && (
                <StocktakeLogsPanel logs={auditLogs} isLoading={isLoadingLogs} />
            )}

            {/* COUNT TAB */}
            {mainTab === 'count' && (
                <>
                    {/* Department Tabs — Primary Navigation */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {DEPARTMENT_TABS.map(tab => {
                            const TabIcon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveDepartmentTab(tab.key)}
                                    className={`px-5 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeDepartmentTab === tab.key
                                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-purple-500/20'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    <TabIcon size={18} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {TYPE_TABS.map(tab => {
                            const TabIcon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTypeTab(tab.key)}
                                    className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-2 ${activeTypeTab === tab.key ? 'bg-purple-600 dark:bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                                >
                                    <TabIcon size={16} />{tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {storageAreas.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            <MapPin size={16} className="text-slate-400 flex-shrink-0" />
                            <button onClick={() => setActiveStorageArea('ALL')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeStorageArea === 'ALL' ? 'bg-cyan-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>All Areas</button>
                            {storageAreas.map(area => (
                                <button key={area} onClick={() => setActiveStorageArea(area)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeStorageArea === area ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}>{area}</button>
                            ))}
                        </div>
                    )}

                    {/* Category Filter */}
                    {availableCategories.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            <Tag size={16} className="text-slate-400 flex-shrink-0" />
                            <button
                                onClick={() => setActiveCategoryFilter('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategoryFilter === 'ALL' ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                            >
                                All Categories
                            </button>
                            {availableCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategoryFilter(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategoryFilter === cat ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {session ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="relative flex-1 w-full">
                                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                                        <input type="text" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" />
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer w-full sm:w-auto bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <input 
                                            type="checkbox" 
                                            checked={showUncountedOnly} 
                                            onChange={(e) => setShowUncountedOnly(e.target.checked)}
                                            className="w-5 h-5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 bg-slate-100 dark:bg-slate-900"
                                        />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Show Uncounted Only</span>
                                    </label>
                                </div>
                                <div className="space-y-4">
                                    {filteredItems.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Package size={48} className="text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                                            <p className="text-slate-500 dark:text-slate-400">No items found for {currentBusiness?.name || 'this business'}</p>
                                        </div>
                                    ) : (
                                        filteredItems.map(item => {
                                            const state = countStates.get(item.id);
                                            return (
                                                <VisualCountRow
                                                    key={item.id}
                                                    item={item}
                                                    count={state?.count ?? 0}
                                                    partialCount={state?.partialCount ?? 0}
                                                    onCountChange={(count, partial) => handleCountChange(item.id, count, partial, item.units.buyUnit)}
                                                    onCalculatorOpen={() => openCalculator(item)}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <div className="lg:col-span-1">
                                <ReviewPanel session={session} countStates={countStates} items={items} onSubmit={submitSession} onSaveDraft={saveDraft} onCancel={cancelSession} isSubmitting={isSubmitting} isSavingDraft={isSavingDraft} activeDepartmentTab={activeDepartmentTab} />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center shadow-sm dark:shadow-none">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6">
                                <Package size={36} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                {hasActiveDraft ? 'Draft Session Available' : 'Ready to Count?'}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                                {hasActiveDraft 
                                    ? `You have an active draft for ${currentBusiness?.name || 'selected business'}. Resume counting to finish it.` 
                                    : `Start a counting session for ${currentBusiness?.name || 'selected business'}. Items are filtered by type tabs above.`}
                            </p>
                            
                            {hasPermission('inventory:stock_take:create') && (
                                hasActiveDraft ? (
                                    <button onClick={resumeSession} className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center gap-3 mx-auto shadow-lg shadow-blue-500/20">
                                        <Play size={20} />Resume Draft
                                    </button>
                                ) : (
                                    <button onClick={startSession} className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 flex items-center gap-3 mx-auto shadow-lg shadow-purple-500/20">
                                        <Play size={20} />Start Counting Session
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </>
            )}

            {calculatorItem && (
                <CalculatorPopup
                    key={calculatorItem.id}
                    isOpen={true}
                    onClose={() => setCalculatorItem(null)}
                    onSubmit={handleCalculatorSubmit}
                    currentValue={countStates.get(calculatorItem.id)?.count ?? 0}
                    itemName={calculatorItem.name}
                    unit={calculatorItem.units.buyUnit}
                />
            )}


            <ReviewUploadModal 
                isOpen={!!pendingCounts} 
                pendingCounts={pendingCounts} 
                onConfirm={confirmPendingCounts} 
                onCancel={() => setPendingCounts(null)} 
            />

            {/* ERROR TOAST */}
            {error && (
                <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-bounce-short">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}
        </div>
    );
};

export default StockTakeView;
