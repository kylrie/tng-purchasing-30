import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import type { BlackBookRecipe } from '../types/blackbook.types';

interface BlackBookRecipeCardProps {
    recipe: BlackBookRecipe;
    isAdmin: boolean;
}

const BlackBookRecipeCard: React.FC<BlackBookRecipeCardProps> = ({ recipe, isAdmin }) => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{recipe.name}</h1>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            recipe.approvalStatus === 'Approved'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : recipe.approvalStatus === 'Pending'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                            {recipe.approvalStatus}
                        </span>
                        {!isAdmin && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                View Only
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Recipe ID: {recipe.recipeId} · Station: {recipe.prepStation}
                        {recipe.lastApprovedDate && ` · Last approved by ${recipe.lastApprovedBy} · ${new Date(recipe.lastApprovedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                    </p>
                </div>
                {recipe.isLocked && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-sm font-medium">
                        <Lock size={16} />
                        Locked
                    </div>
                )}
            </div>

            {/* View-only Warning Banner */}
            {!isAdmin && (
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl">
                    <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        <span className="font-semibold">View-only mode.</span> Kitchen staff can follow the recipe, checklist, photo, and video, but cannot change the Black Book. Edits require Owner/Admin access.
                    </p>
                </div>
            )}

            {/* 3-Column Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#f5f0e8] dark:bg-slate-700/50 rounded-xl px-5 py-4 border border-[#e8e0d4] dark:border-slate-600">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Batch Yield</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{recipe.batchYield}</p>
                </div>
                <div className="bg-[#f5f0e8] dark:bg-slate-700/50 rounded-xl px-5 py-4 border border-[#e8e0d4] dark:border-slate-600">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cook Temp + Time</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{recipe.cookTempTime}</p>
                </div>
                <div className="bg-[#f5f0e8] dark:bg-slate-700/50 rounded-xl px-5 py-4 border border-[#e8e0d4] dark:border-slate-600">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cost Per Serving</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{recipe.costPerServing}</p>
                </div>
            </div>

            {/* Exact Recipe Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Exact Recipe Card</h2>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">grams / ml controlled</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#e8e0d4] dark:border-slate-700">
                                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ingredient</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Exact Amount</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Spec / Brand Standard</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Allowed Substitute</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0ebe3] dark:divide-slate-700/50">
                            {recipe.ingredients.map((ing, idx) => (
                                <tr key={idx} className="hover:bg-[#faf8f5] dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-3.5 text-sm font-medium text-slate-800 dark:text-white">{ing.inventoryItemName}</td>
                                    <td className="px-6 py-3.5">
                                        <span className="inline-flex items-center px-3 py-1 bg-[#f5f0e8] dark:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 border border-[#e8e0d4] dark:border-slate-600">
                                            {ing.quantity} {ing.unit}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span className="inline-flex items-center px-3 py-1 bg-[#f5f0e8] dark:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 border border-[#e8e0d4] dark:border-slate-600">
                                            {ing.specStandard || '—'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span className="inline-flex items-center px-3 py-1 bg-[#f5f0e8] dark:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 border border-[#e8e0d4] dark:border-slate-600">
                                            {ing.allowedSubstitute || 'None'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BlackBookRecipeCard;
