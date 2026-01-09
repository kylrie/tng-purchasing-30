import React, { useState, useEffect } from 'react';
import {
    Building2, Plus, Trash2, Save, Loader2, ToggleLeft, ToggleRight,
    AlertCircle, Check, Percent
} from 'lucide-react';
import { useBusinesses } from '../hooks/useBusinesses';
import { useAuth } from '../../../contexts/AuthContext';
import { SettingsService, type AllocationRule, type ExpenseSharingSettings as ExpenseSharingSettingsType, type ExpenseAllocation } from '../../../shared/services/settings.service';

interface ExpenseSharingSettingsProps {
    className?: string;
}

/**
 * ExpenseSharingSettings - Configuration component for Corporate Expense Allocation
 * Allows admins to define which "Head Office" BUs should have their expenses shared
 * across other branches based on configurable percentages
 */
const ExpenseSharingSettings: React.FC<ExpenseSharingSettingsProps> = ({ className }) => {
    const { businesses, loading: businessesLoading } = useBusinesses();
    const { currentUser } = useAuth();

    const [rules, setRules] = useState<AllocationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Load existing rules on mount
    useEffect(() => {
        const loadRules = async () => {
            try {
                setLoading(true);
                const settings = await SettingsService.getExpenseSharingRules();
                setRules(settings.rules || []);
            } catch (err) {
                console.error('Error loading expense sharing rules:', err);
                setError('Failed to load expense sharing rules');
            } finally {
                setLoading(false);
            }
        };
        loadRules();
    }, []);

    // Add a new empty rule
    const addRule = () => {
        const newRule: AllocationRule = {
            sourceBuId: '',
            sourceBuName: '',
            isEnabled: true,
            allocations: []
        };
        setRules([...rules, newRule]);
    };

    // Remove a rule
    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    // Update a rule's source BU
    const updateSourceBu = (index: number, buId: string) => {
        const bu = businesses.find(b => b.id === buId);
        const updatedRules = [...rules];
        updatedRules[index] = {
            ...updatedRules[index],
            sourceBuId: buId,
            sourceBuName: bu?.name || ''
        };
        setRules(updatedRules);
    };

    // Toggle rule enabled state
    const toggleRuleEnabled = (index: number) => {
        const updatedRules = [...rules];
        updatedRules[index] = {
            ...updatedRules[index],
            isEnabled: !updatedRules[index].isEnabled
        };
        setRules(updatedRules);
    };

    // Add allocation to a rule
    const addAllocation = (ruleIndex: number) => {
        const newAllocation: ExpenseAllocation = {
            targetBuId: '',
            targetBuName: '',
            percentage: 0
        };
        const updatedRules = [...rules];
        updatedRules[ruleIndex] = {
            ...updatedRules[ruleIndex],
            allocations: [...updatedRules[ruleIndex].allocations, newAllocation]
        };
        setRules(updatedRules);
    };

    // Remove allocation from a rule
    const removeAllocation = (ruleIndex: number, allocIndex: number) => {
        const updatedRules = [...rules];
        updatedRules[ruleIndex] = {
            ...updatedRules[ruleIndex],
            allocations: updatedRules[ruleIndex].allocations.filter((_, i) => i !== allocIndex)
        };
        setRules(updatedRules);
    };

    // Update allocation target BU
    const updateAllocationBu = (ruleIndex: number, allocIndex: number, buId: string) => {
        const bu = businesses.find(b => b.id === buId);
        const updatedRules = [...rules];
        updatedRules[ruleIndex].allocations[allocIndex] = {
            ...updatedRules[ruleIndex].allocations[allocIndex],
            targetBuId: buId,
            targetBuName: bu?.name || ''
        };
        setRules(updatedRules);
    };

    // Update allocation percentage
    const updateAllocationPercentage = (ruleIndex: number, allocIndex: number, percentage: number) => {
        const updatedRules = [...rules];
        updatedRules[ruleIndex].allocations[allocIndex] = {
            ...updatedRules[ruleIndex].allocations[allocIndex],
            percentage: Math.max(0, Math.min(100, percentage))
        };
        setRules(updatedRules);
    };

    // Calculate total percentage for a rule
    const getTotalPercentage = (rule: AllocationRule): number => {
        return rule.allocations.reduce((sum, a) => sum + a.percentage, 0);
    };

    // Validate all rules
    const validateRules = (): string | null => {
        // Check for duplicate source BUs across all rules
        const sourceBuIds = rules.map(r => r.sourceBuId).filter(Boolean);
        const duplicateSources = sourceBuIds.filter((id, idx) => sourceBuIds.indexOf(id) !== idx);
        if (duplicateSources.length > 0) {
            const duplicateBuName = rules.find(r => r.sourceBuId === duplicateSources[0])?.sourceBuName || duplicateSources[0];
            return `Duplicate source Business Unit detected: "${duplicateBuName}" is used in multiple rules. Each source BU can only have one allocation rule.`;
        }

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (!rule.sourceBuId) {
                return `Rule ${i + 1}: Please select a source Business Unit`;
            }
            if (rule.allocations.length === 0) {
                return `Rule ${i + 1}: Please add at least one allocation`;
            }

            // Check for duplicate target BUs within this rule
            const targetBuIds = rule.allocations.map(a => a.targetBuId).filter(Boolean);
            const duplicateTargets = targetBuIds.filter((id, idx) => targetBuIds.indexOf(id) !== idx);
            if (duplicateTargets.length > 0) {
                const duplicateBuName = rule.allocations.find(a => a.targetBuId === duplicateTargets[0])?.targetBuName || duplicateTargets[0];
                return `Rule ${i + 1}: Duplicate target Business Unit "${duplicateBuName}". Each target can only appear once per rule.`;
            }

            for (let j = 0; j < rule.allocations.length; j++) {
                if (!rule.allocations[j].targetBuId) {
                    return `Rule ${i + 1}, Allocation ${j + 1}: Please select a target Business Unit`;
                }
                // Check if target BU is same as source BU
                if (rule.allocations[j].targetBuId === rule.sourceBuId) {
                    return `Rule ${i + 1}, Allocation ${j + 1}: Target cannot be the same as the source Business Unit`;
                }
                if (rule.allocations[j].percentage <= 0) {
                    return `Rule ${i + 1}, Allocation ${j + 1}: Percentage must be greater than 0`;
                }
            }
            const total = getTotalPercentage(rule);
            if (total !== 100) {
                return `Rule ${i + 1}: Allocations must total 100% (currently ${total}%)`;
            }
        }
        return null;
    };

    // Save rules
    const saveRules = async () => {
        const validationError = validateRules();
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const settings: ExpenseSharingSettingsType = { rules };
            await SettingsService.updateExpenseSharingRules(settings, currentUser?.id, currentUser?.name);

            setSuccess('Expense sharing rules saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error saving expense sharing rules:', err);
            setError('Failed to save expense sharing rules');
        } finally {
            setSaving(false);
        }
    };

    if (loading || businessesLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="animate-spin text-purple-400" size={24} />
                <span className="ml-2 text-slate-400">Loading...</span>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className || ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Expense Allocation Rules</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Configure how corporate expenses are shared across branches
                    </p>
                </div>
                <button
                    onClick={addRule}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    Add Rule
                </button>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
                    <Check size={20} />
                    <span>{success}</span>
                </div>
            )}

            {/* Rules List */}
            {rules.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl">
                    <Building2 className="mx-auto text-slate-600 mb-3" size={48} />
                    <p className="text-slate-400">No expense sharing rules configured</p>
                    <p className="text-sm text-slate-500 mt-1">Click "Add Rule" to create your first allocation rule</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {rules.map((rule, ruleIndex) => (
                        <div
                            key={ruleIndex}
                            className={`border rounded-xl p-4 transition-colors ${rule.isEnabled
                                ? 'bg-slate-800/50 border-purple-500/30'
                                : 'bg-slate-900/50 border-slate-700/50 opacity-60'
                                }`}
                        >
                            {/* Rule Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-medium rounded">
                                        Rule {ruleIndex + 1}
                                    </span>
                                    <button
                                        onClick={() => toggleRuleEnabled(ruleIndex)}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        {rule.isEnabled ? (
                                            <>
                                                <ToggleRight size={24} className="text-emerald-400" />
                                                <span className="text-emerald-400">Enabled</span>
                                            </>
                                        ) : (
                                            <>
                                                <ToggleLeft size={24} className="text-slate-500" />
                                                <span className="text-slate-500">Disabled</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <button
                                    onClick={() => removeRule(ruleIndex)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Source BU Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Source Business Unit (Head Office)
                                </label>
                                <select
                                    value={rule.sourceBuId}
                                    onChange={(e) => updateSourceBu(ruleIndex, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="">Select Business Unit...</option>
                                    {businesses.map(bu => (
                                        <option key={bu.id} value={bu.id}>{bu.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Allocations */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-slate-300">
                                        Expense Allocations
                                    </label>
                                    <button
                                        onClick={() => addAllocation(ruleIndex)}
                                        className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
                                    >
                                        <Plus size={16} />
                                        Add Branch
                                    </button>
                                </div>

                                {rule.allocations.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic py-2">
                                        No allocations defined. Add branches that will share the expense.
                                    </p>
                                ) : (
                                    rule.allocations.map((alloc, allocIndex) => (
                                        <div
                                            key={allocIndex}
                                            className="flex items-center gap-3 p-3 bg-slate-900/70 rounded-lg"
                                        >
                                            <select
                                                value={alloc.targetBuId}
                                                onChange={(e) => updateAllocationBu(ruleIndex, allocIndex, e.target.value)}
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="">Select Branch...</option>
                                                {businesses
                                                    .filter(bu => bu.id !== rule.sourceBuId)
                                                    .map(bu => (
                                                        <option key={bu.id} value={bu.id}>{bu.name}</option>
                                                    ))}
                                            </select>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={alloc.percentage}
                                                    onChange={(e) => updateAllocationPercentage(ruleIndex, allocIndex, Number(e.target.value))}
                                                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:ring-2 focus:ring-purple-500"
                                                />
                                                <Percent size={16} className="text-slate-400" />
                                            </div>
                                            <button
                                                onClick={() => removeAllocation(ruleIndex, allocIndex)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}

                                {/* Total Percentage Indicator */}
                                {rule.allocations.length > 0 && (
                                    <div className={`flex items-center justify-end gap-2 text-sm ${getTotalPercentage(rule) === 100
                                        ? 'text-emerald-400'
                                        : 'text-amber-400'
                                        }`}>
                                        {getTotalPercentage(rule) === 100 ? (
                                            <Check size={16} />
                                        ) : (
                                            <AlertCircle size={16} />
                                        )}
                                        Total: {getTotalPercentage(rule)}%
                                        {getTotalPercentage(rule) !== 100 && (
                                            <span className="text-xs">(must be 100%)</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Save Button */}
            {rules.length > 0 && (
                <div className="flex justify-end pt-4 border-t border-slate-700">
                    <button
                        onClick={saveRules}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Rules
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExpenseSharingSettings;
