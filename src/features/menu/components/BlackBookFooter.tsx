import React from 'react';
import { Printer, ExternalLink, Lock, CheckCircle2, FileEdit } from 'lucide-react';
import type { BlackBookRecipe } from '../types/blackbook.types';

interface BlackBookFooterProps {
    recipe: BlackBookRecipe;
    canApprove: boolean;
    canEdit: boolean;
    onApprove: () => void;
    onUpdateVersion: () => void;
    onPrintStationCopy: () => void;
    onOpenTESChecklist: () => void;
}

const BlackBookFooter: React.FC<BlackBookFooterProps> = ({
    recipe,
    canApprove,
    canEdit,
    onApprove,
    onUpdateVersion,
    onPrintStationCopy,
    onOpenTESChecklist
}) => {
    return (
        <div className="space-y-6">
            {/* Version Control + Approval */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Version Control + Approval</h2>
                    {recipe.isLocked && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            <Lock size={12} />
                            owner locked
                        </span>
                    )}
                </div>

                <div className="p-6">
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-amber-300 dark:bg-amber-600/50" />

                        <div className="space-y-6">
                            {[...recipe.versionHistory].reverse().map((entry, idx) => (
                                <div key={idx} className="relative flex items-start gap-4 pl-8">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 ${
                                        entry.status === 'Approved'
                                            ? 'border-amber-500 bg-white dark:bg-slate-800'
                                            : entry.status === 'Archived'
                                            ? 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                                            : 'border-amber-300 bg-white dark:border-amber-700 dark:bg-slate-800'
                                    }`} />

                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                            {entry.version} · {entry.status}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {entry.description}
                                            {entry.approvedBy && `. Approved by ${entry.approvedBy}.`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Footer Actions */}
            <div className="sticky bottom-0 bg-[#faf8f5]/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-[#e8e0d4] dark:border-slate-700 px-6 py-4 -mx-6 -mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {canApprove && (recipe.approvalStatus === 'Draft' || recipe.approvalStatus === 'Pending') && (
                        <button
                            onClick={onApprove}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 rounded-lg text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                            <CheckCircle2 size={16} />
                            Approve Recipe
                        </button>
                    )}
                    {canEdit && (
                        <button
                            onClick={onUpdateVersion}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 border border-amber-300 dark:border-amber-700/50 rounded-lg text-sm font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors shadow-sm"
                        >
                            <FileEdit size={16} />
                            Update Version (Edit)
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onPrintStationCopy}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <Printer size={16} />
                        Print Station Copy
                    </button>
                    <button
                        onClick={onOpenTESChecklist}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2c2520] dark:bg-amber-600 rounded-lg text-sm font-semibold text-white hover:bg-[#3d3530] dark:hover:bg-amber-700 transition-colors shadow-sm"
                    >
                        <ExternalLink size={16} />
                        Open TES Training Checklist
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlackBookFooter;

