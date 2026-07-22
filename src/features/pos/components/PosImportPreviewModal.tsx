import React, { useState, useMemo } from 'react';
import type { SimulatedDeduction } from '../types/pos-import.types';
import {
    AlertCircle, CheckCircle2, CornerDownRight, X, Package, AlertTriangle,
    ChevronDown, ChevronRight, Search, ShieldAlert, Box, Layers, Info
} from 'lucide-react';

interface PosImportPreviewModalProps {
    isOpen: boolean;
    simulatedDeductions: SimulatedDeduction[];
    onConfirm: () => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    readOnly?: boolean; // If true, hides the Confirm/Cancel buttons and changes title
}

// Group deductions by parent FG for a tree view
interface FGGroup {
    fg: SimulatedDeduction;
    children: SimulatedDeduction[];
    hasNegativeStock: boolean;
}

export const PosImportPreviewModal: React.FC<PosImportPreviewModalProps> = ({
    isOpen,
    simulatedDeductions,
    onConfirm,
    onCancel,
    isSubmitting = false,
    readOnly = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [showOnlyWarnings, setShowOnlyWarnings] = useState(false);

    // ================================================================
    // DATA AGGREGATION (hooks must run before any conditional returns)
    // ================================================================

    const fgItems = simulatedDeductions.filter(d => d.type === 'FG' || d.type === 'FG_DIRECT');
    const rmItems = simulatedDeductions.filter(d => d.type === 'RM');
    const productionItems = simulatedDeductions.filter(d => d.type === 'PRODUCTION');
    const negativeItems = simulatedDeductions.filter(d => d.newTheoreticalStock < 0);

    // Group deductions into a tree: FG → [PRODUCTION?, RM...]
    const groupedData = useMemo((): FGGroup[] => {
        const groups: FGGroup[] = [];

        fgItems.forEach(fg => {
            const children = simulatedDeductions.filter(d =>
                d.parentItemId === fg.itemId && d.type !== 'FG' && d.type !== 'FG_DIRECT'
            );
            const hasNegativeStock = fg.newTheoreticalStock < 0 || children.some(c => c.newTheoreticalStock < 0);
            groups.push({ fg, children, hasNegativeStock });
        });

        return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simulatedDeductions]);

    // Filter groups based on search and warning filter
    const filteredGroups = useMemo(() => {
        return groupedData.filter(group => {
            if (showOnlyWarnings && !group.hasNegativeStock) return false;
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                group.fg.itemName.toLowerCase().includes(term) ||
                group.children.some(c => c.itemName.toLowerCase().includes(term))
            );
        });
    }, [groupedData, searchTerm, showOnlyWarnings]);

    // Early return AFTER all hooks to satisfy Rules of Hooks
    if (!isOpen) return null;

    const toggleGroup = (itemId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const expandAll = () => {
        setExpandedGroups(new Set(filteredGroups.map(g => g.fg.itemId)));
    };

    const collapseAll = () => {
        setExpandedGroups(new Set());
    };

    // ================================================================
    // FORMATTERS
    // ================================================================

    const formatStock = (val: number) => {
        const num = Number.isFinite(val) ? val : 0;
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getTypeConfig = (type: SimulatedDeduction['type']) => {
        switch (type) {
            case 'FG':
                return { label: 'Finished Good', icon: Box, color: 'bg-blue-500/15 text-blue-600 border-blue-200' };
            case 'FG_DIRECT':
                return { label: 'FG (Direct)', icon: Box, color: 'bg-emerald-500/15 text-emerald-600 border-emerald-200' };
            case 'PRODUCTION':
                return { label: 'Production', icon: Layers, color: 'bg-purple-500/15 text-purple-600 border-purple-200' };
            case 'RM':
                return { label: 'Raw Material', icon: Package, color: 'bg-amber-500/15 text-amber-600 border-amber-200' };
        }
    };

    // ================================================================
    // RENDER
    // ================================================================

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
                 style={{ animation: 'fadeInScale 0.2s ease-out' }}>

                {/* ── HEADER ── */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-blue-500" />
                            {readOnly ? 'Sales Deductions Breakdown' : 'Import Preview — Dry Run'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {readOnly 
                                ? 'Review the exact BOM explosion and raw material deductions for this sales upload.'
                                : 'Review all stock deductions before committing. This preview does not affect your inventory.'}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── SUMMARY CARDS ── */}
                <div className="px-6 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SummaryCard
                        icon={<Box className="w-4 h-4 text-blue-500" />}
                        label="Menu Items"
                        value={fgItems.length}
                        color="blue"
                    />
                    <SummaryCard
                        icon={<Package className="w-4 h-4 text-amber-500" />}
                        label="Raw Materials"
                        value={rmItems.length}
                        color="amber"
                    />
                    <SummaryCard
                        icon={<Layers className="w-4 h-4 text-purple-500" />}
                        label="Production Items"
                        value={productionItems.length}
                        color="purple"
                    />
                    <SummaryCard
                        icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
                        label="Negative Stock"
                        value={negativeItems.length}
                        color={negativeItems.length > 0 ? 'red' : 'green'}
                        highlight={negativeItems.length > 0}
                    />
                </div>

                {/* ── TOOLBAR: Search + Filters ── */}
                <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        />
                    </div>
                    <button
                        onClick={() => setShowOnlyWarnings(p => !p)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                            showOnlyWarnings
                                ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30'
                                : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {showOnlyWarnings ? 'Showing Warnings Only' : 'Show Warnings Only'}
                    </button>
                    <div className="flex gap-1">
                        <button onClick={expandAll} className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            Expand All
                        </button>
                        <button onClick={collapseAll} className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            Collapse All
                        </button>
                    </div>
                </div>

                {/* ── LEGEND ── */}
                <div className="px-6 py-2 flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Finished Good</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Raw Material</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Production</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Negative Stock</span>
                </div>

                {/* ── DEDUCTION TABLE (Grouped Tree View) ── */}
                <div className="flex-1 overflow-auto px-6 py-3">
                    {filteredGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            {showOnlyWarnings ? (
                                <>
                                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                                    <p className="text-lg font-medium text-emerald-600">No Stock Warnings</p>
                                    <p className="text-sm mt-1">All items have sufficient stock for this import.</p>
                                </>
                            ) : searchTerm ? (
                                <>
                                    <Search className="w-10 h-10 mb-3 text-slate-300" />
                                    <p className="text-sm">No items match "{searchTerm}"</p>
                                </>
                            ) : (
                                <>
                                    <Package className="w-10 h-10 mb-3 text-slate-300" />
                                    <p className="text-sm">No deductions found. Ensure items are matched with recipes.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredGroups.map(group => {
                                const isExpanded = expandedGroups.has(group.fg.itemId);
                                const fgConfig = getTypeConfig(group.fg.type);
                                const fgNegative = group.fg.newTheoreticalStock < 0;

                                return (
                                    <div key={group.fg.itemId} className={`rounded-xl border transition-all ${
                                        group.hasNegativeStock
                                            ? 'border-red-200 dark:border-red-500/30 bg-red-50/30 dark:bg-red-500/5'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'
                                    }`}>
                                        {/* FG Header Row */}
                                        <button
                                            onClick={() => toggleGroup(group.fg.itemId)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors rounded-xl"
                                        >
                                            <div className="flex items-center justify-center w-6 h-6">
                                                {isExpanded
                                                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                                                }
                                            </div>
                                            <fgConfig.icon className={`w-4 h-4 ${group.fg.type === 'FG_DIRECT' ? 'text-emerald-500' : 'text-blue-500'}`} />
                                            <span className="flex-1 font-semibold text-sm text-slate-900 dark:text-white">
                                                {group.fg.itemName}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${fgConfig.color}`}>
                                                {fgConfig.label}
                                            </span>
                                            {group.children.length > 0 && (
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                                                    {group.children.length} ingredient{group.children.length !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {/* Stock columns for FG */}
                                            <div className="flex items-center gap-6 ml-4 text-sm tabular-nums">
                                                <span className="w-20 text-right text-slate-500 dark:text-slate-400">
                                                    {formatStock(group.fg.currentTheoreticalStock)}
                                                </span>
                                                <span className="w-20 text-right text-red-500 font-medium">
                                                    {group.fg.type === 'PRODUCTION' ? '—' : `−${formatStock(group.fg.deductionAmount)}`}
                                                </span>
                                                <span className={`w-20 text-right font-bold ${fgNegative ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                                    {formatStock(group.fg.newTheoreticalStock)}
                                                    {fgNegative && <AlertCircle className="inline w-3.5 h-3.5 ml-1 text-red-500" />}
                                                </span>
                                            </div>
                                        </button>

                                        {/* Children (RM / PRODUCTION) */}
                                        {isExpanded && group.children.length > 0 && (
                                            <div className="border-t border-slate-100 dark:border-slate-700/60">
                                                {group.children.map((child, ci) => {
                                                    const childConfig = getTypeConfig(child.type);
                                                    const childNegative = child.newTheoreticalStock < 0;

                                                    return (
                                                        <React.Fragment key={`${child.itemId}-${ci}`}>
                                                            <div
                                                                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                                                                    (ci < group.children.length - 1 && !child.alert) ? 'border-b border-slate-50 dark:border-slate-700/40' : ''
                                                                } ${childNegative ? 'bg-red-50/50 dark:bg-red-500/5' : ''}`}
                                                            >
                                                                <div className="w-6" /> {/* Spacer for expand icon alignment */}
                                                                <CornerDownRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                                                                <childConfig.icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                <span className="flex-1 text-slate-700 dark:text-slate-300">
                                                                    {child.itemName}
                                                                </span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${childConfig.color}`}>
                                                                    {childConfig.label}
                                                                </span>
                                                                <div className="flex items-center gap-6 ml-4 tabular-nums">
                                                                    <span className="w-20 text-right text-slate-400 dark:text-slate-500">
                                                                        {formatStock(child.currentTheoreticalStock)}
                                                                    </span>
                                                                    <span className="w-20 text-right font-medium text-red-500">
                                                                        {`−${formatStock(child.deductionAmount)}`}
                                                                    </span>
                                                                    <span className={`w-20 text-right font-bold ${childNegative ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                        {formatStock(child.newTheoreticalStock)}
                                                                        {childNegative && <AlertCircle className="inline w-3.5 h-3.5 ml-1 text-red-500" />}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {child.alert && (
                                                                <div className={`flex items-center gap-2 pl-12 pr-4 py-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 ${ci < group.children.length - 1 ? 'border-b border-slate-50 dark:border-slate-700/40' : ''}`}>
                                                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                                    <span>{child.alert}</span>
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── COLUMN LABELS (Sticky reference) ── */}
                <div className="px-6 py-1.5 flex items-center justify-end gap-6 text-[10px] uppercase tracking-wider font-medium text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                     style={{ paddingRight: 'calc(1.5rem + 16px)' }}>
                    <span className="w-20 text-right">Current</span>
                    <span className="w-20 text-right">Deduction</span>
                    <span className="w-20 text-right">After Import</span>
                </div>

                {/* ── WARNING BANNER (if any negative stock) ── */}
                {negativeItems.length > 0 && (
                    <div className="mx-6 mb-3 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                {negativeItems.length} item{negativeItems.length !== 1 ? 's' : ''} will go negative after this import
                            </p>
                            <p className="text-xs text-red-500 dark:text-red-400/70 mt-0.5">
                                {negativeItems.map(i => i.itemName).slice(0, 5).join(', ')}
                                {negativeItems.length > 5 && ` and ${negativeItems.length - 5} more...`}
                            </p>
                        </div>
                    </div>
                )}

                {/* ── FOOTER ── */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <Info className="w-3.5 h-3.5" />
                        Click any menu item to expand its ingredient breakdown
                    </div>
                    {!readOnly ? (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={isSubmitting || simulatedDeductions.length === 0}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Processing Import...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Confirm & Update Inventory
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.96); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

// ================================================================
// SUMMARY CARD SUB-COMPONENT
// ================================================================

interface SummaryCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: 'blue' | 'amber' | 'purple' | 'red' | 'green';
    highlight?: boolean;
}

const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20',
    purple: 'bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20',
    red: 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
};

const valueColorMap = {
    blue: 'text-blue-700 dark:text-blue-400',
    amber: 'text-amber-700 dark:text-amber-400',
    purple: 'text-purple-700 dark:text-purple-400',
    red: 'text-red-700 dark:text-red-400',
    green: 'text-emerald-700 dark:text-emerald-400',
};

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, color, highlight }) => (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${colorMap[color]} ${highlight ? 'ring-2 ring-red-400/40 animate-pulse' : ''}`}>
        <div className="shrink-0">{icon}</div>
        <div>
            <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`text-lg font-bold tabular-nums ${valueColorMap[color]}`}>{value}</p>
        </div>
    </div>
);
