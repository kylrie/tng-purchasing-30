import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { BlackBookRecipe, QualityCheckItem } from '../types/blackbook.types';

interface BlackBookQualityControlsProps {
    recipe: BlackBookRecipe;
    onChecklistChange: (updatedChecklist: QualityCheckItem[]) => void;
}

const BlackBookQualityControls: React.FC<BlackBookQualityControlsProps> = ({
    recipe,
    onChecklistChange
}) => {
    const handleCheckToggle = (idx: number) => {
        if (!onChecklistChange) return;
        const updated = recipe.qualityChecklist.map((item, i) =>
            i === idx ? { ...item, checked: !item.checked } : item
        );
        onChecklistChange(updated);
    };

    return (
        <div className="space-y-6">
            {/* Common Mistakes + Fixes */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Common Mistakes + Fixes</h2>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-full text-xs font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                        <ShieldAlert size={12} />
                        chef exit protection
                    </span>
                </div>

                <div className="p-6">
                    {/* Column headers */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mistake</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">How to Prevent</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Manager Check</span>
                    </div>

                    <div className="space-y-3">
                        {recipe.mistakesFixes.map((mf, idx) => (
                            <div key={idx} className="grid grid-cols-3 gap-4">
                                <div className="bg-[#faf8f5] dark:bg-slate-700/50 rounded-xl px-4 py-3 border border-[#e8e0d4] dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300">
                                    {mf.mistake}
                                </div>
                                <div className="bg-[#faf8f5] dark:bg-slate-700/50 rounded-xl px-4 py-3 border border-[#e8e0d4] dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300">
                                    {mf.howToPrevent}
                                </div>
                                <div className="bg-[#faf8f5] dark:bg-slate-700/50 rounded-xl px-4 py-3 border border-[#e8e0d4] dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300">
                                    {mf.managerCheck}
                                </div>
                            </div>
                        ))}
                        {recipe.mistakesFixes.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">No mistakes recorded yet.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Final Quality Checklist */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Final Quality Checklist</h2>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f5f0e8] dark:bg-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 border border-[#e8e0d4] dark:border-slate-600">
                        before serving
                    </span>
                </div>

                <div className="p-6 space-y-3">
                    {recipe.qualityChecklist.map((item, idx) => (
                        <label
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-3.5 bg-[#faf8f5] dark:bg-slate-700/50 rounded-xl border border-[#e8e0d4] dark:border-slate-600 cursor-pointer hover:bg-[#f5f0e8] dark:hover:bg-slate-700 transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={() => handleCheckToggle(idx)}
                                className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-500 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                            />
                            <span className={`text-sm ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                {item.label}
                            </span>
                            {item.checked && <CheckCircle2 size={16} className="text-emerald-500 ml-auto flex-shrink-0" />}
                        </label>
                    ))}
                    {recipe.qualityChecklist.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No checklist items defined.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlackBookQualityControls;
