import React, { useState } from 'react';
import {
    ShieldAlert,
    Clock,
    User,
    Plus,
    CheckCircle2,
    AlertTriangle,
    Eye,
    MessageSquare,
    Calendar,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

import type { InvestigationCase, TimelineEvent } from '../services/investigations.service';

export interface InvestigationsTabProps {
    investigations: InvestigationCase[];
    onResolve: (caseId: string, resolutionNote: string) => Promise<void>;
}

// MOCK DATA REMOVED

// ============================================================
// CASE CARD
// ============================================================

const CaseCard: React.FC<{ c: InvestigationCase; onResolve: (caseId: string, notes: string) => Promise<void> }> = ({ c, onResolve }) => {
    const [expanded, setExpanded] = useState(c.status === 'active');
    const [isResolving, setIsResolving] = useState(false);
    const isResolved = c.status === 'resolved';

    const handleResolve = async () => {
        const notes = window.prompt("Enter resolution notes:", "");
        if (!notes || !notes.trim()) return;
        setIsResolving(true);
        try {
            await onResolve(c.id!, notes);
        } catch (error) {
            console.error('Failed to resolve:', error);
        } finally {
            setIsResolving(false);
        }
    };

    // Format date/time from Timestamp or string
    let dateStr = "Recently";
    let timeStr = "";
    if (c.createdAt) {
        if (typeof c.createdAt.toDate === 'function') {
            const d = c.createdAt.toDate();
            dateStr = d.toLocaleDateString();
            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    return (
        <div className={`relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:-translate-y-1 group ${isResolved
            ? 'shadow-lg shadow-emerald-500/10 dark:shadow-emerald-900/20'
            : 'shadow-xl shadow-slate-200/20 dark:shadow-black/40 hover:shadow-2xl'
            }`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-slate-800/40 dark:to-slate-900/0 pointer-events-none" />
            {/* Top accent */}
            <div className={`absolute top-0 left-0 right-0 h-1 opacity-80 ${isResolved ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : c.priority === 'urgent' ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} />

            {/* Header */}
            <div className="px-6 py-5 relative z-10">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white truncate">{c.itemName}</h3>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">{c.category}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-wrap">
                            <span className="inline-flex items-center gap-1.5"><Calendar size={12} /> {dateStr}</span>
                            {timeStr && <span className="inline-flex items-center gap-1.5"><Clock size={12} /> {timeStr}</span>}
                            <span className="inline-flex items-center gap-1.5"><User size={12} /> {c.assignee}</span>
                        </div>
                    </div>

                    {/* Loss */}
                    <div className="text-right flex-shrink-0">
                        <p className={`text-2xl font-black tracking-tighter ${isResolved ? 'text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-500' : 'text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-rose-600'}`}>
                            {isResolved ? '✓ ' : ''}₱{c.totalLoss.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-3 mt-5 flex-wrap">
                    {/* Priority pill */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border backdrop-blur-md shadow-inner ${isResolved
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : c.priority === 'urgent'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                        {isResolved ? (
                            <><CheckCircle2 size={12} /> Resolved</>
                        ) : c.priority === 'urgent' ? (
                            <><ShieldAlert size={12} /> Urgent</>
                        ) : (
                            <><Eye size={12} /> Watch</>
                        )}
                    </span>

                    {/* Timeline count badge */}
                    {!isResolved && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border backdrop-blur-md shadow-inner ${c.priority === 'urgent'
                            ? 'bg-red-500/5 text-red-500/80 border-red-500/10'
                            : 'bg-slate-500/5 text-slate-500 border-slate-500/10 dark:text-slate-400 dark:border-slate-500/20'
                            }`}>
                            ⏱️ {c.timeline.length} updates
                        </span>
                    )}

                    {isResolved && c.resolvedAt && (
                        <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-extrabold ml-auto">
                            Resolved successfully
                        </span>
                    )}
                </div>

                {/* Initial note */}
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-5 leading-relaxed bg-slate-50/50 dark:bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/30">
                    <span className="font-bold text-slate-800 dark:text-white">Note:</span> {c.initialNote}
                </p>

                {/* Resolution note if present */}
                {isResolved && c.timeline.length > 0 && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-3 leading-relaxed bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl px-4 py-3 border border-emerald-200/50 dark:border-emerald-800/30 shadow-inner">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">Resolution:</span> {c.timeline[c.timeline.length - 1].action}
                    </p>
                )}

                {/* Actions (active only) */}
                {!isResolved && (
                    <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100/50 dark:border-slate-700/30">
                        <button className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 hover:-translate-y-px shadow-sm active:scale-95">
                            <Plus size={14} /> Add Note
                        </button>
                        <button
                            onClick={handleResolve}
                            disabled={isResolving}
                            className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all duration-200 hover:-translate-y-px shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            {isResolving ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" /> Resolving
                                </div>
                            ) : (
                                <><CheckCircle2 size={14} /> Mark Resolved</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Timeline toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-6 py-3.5 bg-slate-50/40 dark:bg-slate-800/40 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition-colors relative z-10"
            >
                <span className="flex items-center gap-2">
                    <MessageSquare size={14} />
                    View Timeline ({c.timeline.length} Events)
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Timeline body */}
            {expanded && (
                <div className="px-6 py-5 bg-white/40 dark:bg-slate-900/40 border-t border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md relative z-10 shadow-inner">
                    <div className="space-y-1">
                        {c.timeline.map((event: TimelineEvent, idx) => (
                            <div key={event.id || idx} className="flex gap-4">
                                {/* Timeline line + dot */}
                                <div className="flex flex-col items-center">
                                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ring-4 ring-white/50 dark:ring-slate-900/50 shadow-sm ${idx === c.timeline.length - 1 && isResolved
                                        ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                                        : idx === 0
                                            ? 'bg-gradient-to-br from-blue-400 to-indigo-500'
                                            : 'bg-slate-300 dark:bg-slate-600'
                                        }`} />
                                    {idx < c.timeline.length - 1 && (
                                        <div className="w-px flex-1 bg-gradient-to-b from-slate-200 to-slate-200/50 dark:from-slate-700 dark:to-slate-700/50 min-h-[24px] rounded-full my-1" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="pb-4 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{event.action}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">{event.timestamp} · {event.actor}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const InvestigationsTab: React.FC<InvestigationsTabProps> = ({ investigations, onResolve }) => {
    const activeCases = investigations.filter(c => c.status === 'active');
    const resolvedCases = investigations.filter(c => c.status === 'resolved');

    return (
        <div className="space-y-10">
            {/* Active Investigations */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 flex items-center justify-center backdrop-blur-md shadow-inner">
                        <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Active Investigations</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">{activeCases.length} open cases requiring attention</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {activeCases.map((c) => (
                        <CaseCard key={c.id} c={c} onResolve={onResolve} />
                    ))}
                </div>
            </div>

            {/* Resolved */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center backdrop-blur-md shadow-inner">
                        <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Resolved Cases</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">{resolvedCases.length} cases closed with documented root cause</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {resolvedCases.map((c) => (
                        <CaseCard key={c.id} c={c} onResolve={onResolve} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InvestigationsTab;
