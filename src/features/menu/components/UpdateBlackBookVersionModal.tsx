import React, { useState } from 'react';
import { X, Plus, Trash2, ChefHat, AlertTriangle, CheckSquare, FileEdit } from 'lucide-react';
import type { 
    BlackBookRecipe,
    PrepStation 
} from '../types/blackbook.types';
import { PREP_STATIONS } from '../types/blackbook.types';
import { BlackBookService } from '../services/blackbook.service';
import type { User } from '../../procurement/types';

interface UpdateBlackBookVersionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecipeUpdated: () => void;
    recipe: BlackBookRecipe;
    currentUser: User;
}

const UpdateBlackBookVersionModal: React.FC<UpdateBlackBookVersionModalProps> = ({ 
    isOpen, 
    onClose, 
    onRecipeUpdated,
    recipe,
    currentUser
}) => {
    // We only need fields that are editable, omitting id, createdAt, version, approvalStatus, etc.
    const [formData, setFormData] = useState<Partial<Omit<BlackBookRecipe, 'id' | 'createdAt'>>>({
        name: recipe.name,
        prepStation: recipe.prepStation,
        batchYield: recipe.batchYield,
        cookTempTime: recipe.cookTempTime,
        costPerServing: recipe.costPerServing,
        ingredients: recipe.ingredients,
        methodSteps: recipe.methodSteps,
        mistakesFixes: recipe.mistakesFixes,
        qualityChecklist: recipe.qualityChecklist,
        platingPhotoUrl: recipe.platingPhotoUrl || '',
        trainingVideoUrl: recipe.trainingVideoUrl || '',
        youtubeVideoUrl: recipe.youtubeVideoUrl || ''
    });

    const [versionDescription, setVersionDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        try {
            setError(null);
            if (!formData.name) throw new Error("Recipe name is required");
            if (!versionDescription.trim()) throw new Error("Reason for update is required for the version log.");

            setIsSaving(true);
            
            // Clean up empty steps/items
            const cleanData = {
                ...formData,
                methodSteps: (formData.methodSteps || []).filter(s => s.instruction.trim()),
                mistakesFixes: (formData.mistakesFixes || []).filter(m => m.mistake.trim()),
                qualityChecklist: (formData.qualityChecklist || []).filter(q => q.label.trim())
            };
            
            // Ensure step numbers are sequential
            cleanData.methodSteps.forEach((step, idx) => {
                step.stepNumber = idx + 1;
            });

            await BlackBookService.updateRecipe(
                recipe.id, 
                cleanData, 
                versionDescription, 
                currentUser.name
            );
            
            onRecipeUpdated();
            onClose();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message || "Failed to update recipe");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
            <div className="bg-[#faf8f5] dark:bg-slate-900 w-full max-w-4xl h-full shadow-2xl flex flex-col animate-slide-in-right border-l border-[#e8e0d4] dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Update Recipe Version</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Create a new version of {recipe.recipeId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Version Reason (Required) */}
                    <section className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-700/50 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                            <FileEdit size={16} />
                            Version Update Log
                        </h3>
                        <div>
                            <label className="block text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Reason for update / What's new? *</label>
                            <textarea
                                value={versionDescription}
                                onChange={e => setVersionDescription(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/50 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                rows={2}
                                placeholder="e.g. Adjusted batch yield from 10 to 12 portions, updated cooking time."
                            />
                        </div>
                    </section>

                    {/* Section 1: Core Details */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ChefHat size={16} className="text-amber-500" />
                            Core Details
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Recipe Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Prep Station</label>
                                <select
                                    value={formData.prepStation}
                                    onChange={e => setFormData(prev => ({ ...prev, prepStation: e.target.value as PrepStation }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                >
                                    {PREP_STATIONS.map(station => (
                                        <option key={station} value={station}>{station}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Metrics */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Batch Yield</label>
                                <input
                                    type="text"
                                    value={formData.batchYield}
                                    onChange={e => setFormData(prev => ({ ...prev, batchYield: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cook Temp + Time</label>
                                <input
                                    type="text"
                                    value={formData.cookTempTime}
                                    onChange={e => setFormData(prev => ({ ...prev, cookTempTime: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cost Per Serving</label>
                                <input
                                    type="text"
                                    value={formData.costPerServing}
                                    onChange={e => setFormData(prev => ({ ...prev, costPerServing: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Ingredients */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Exact Ingredients & Standards</h3>
                        </div>
                        <div className="space-y-3">
                            {formData.ingredients?.map((ing, idx) => (
                                <div key={idx} className="p-4 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-800 dark:text-white text-sm">{ing.inventoryItemName}</span>
                                        <span className="text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded font-medium">
                                            {ing.quantity} {ing.unit}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Spec Standard</label>
                                            <input
                                                type="text"
                                                value={ing.specStandard}
                                                onChange={e => {
                                                    const newIng = [...(formData.ingredients || [])];
                                                    newIng[idx].specStandard = e.target.value;
                                                    setFormData(prev => ({ ...prev, ingredients: newIng }));
                                                }}
                                                className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                                                placeholder="e.g. 2mm slice"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Allowed Substitute</label>
                                            <input
                                                type="text"
                                                value={ing.allowedSubstitute}
                                                onChange={e => {
                                                    const newIng = [...(formData.ingredients || [])];
                                                    newIng[idx].allowedSubstitute = e.target.value;
                                                    setFormData(prev => ({ ...prev, ingredients: newIng }));
                                                }}
                                                className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                                                placeholder="e.g. Monterey brand only"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Section 3: Method Steps */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Method</h3>
                            <button
                                onClick={() => setFormData(prev => ({
                                    ...prev,
                                    methodSteps: [...(prev.methodSteps || []), { stepNumber: prev.methodSteps?.length ? prev.methodSteps.length + 1 : 1, instruction: '' }]
                                }))}
                                className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-500 hover:text-amber-700 font-medium"
                            >
                                <Plus size={16} /> Add Step
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.methodSteps?.map((step, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                                        {idx + 1}
                                    </div>
                                    <textarea
                                        value={step.instruction}
                                        onChange={e => {
                                            const newSteps = [...(formData.methodSteps || [])];
                                            newSteps[idx].instruction = e.target.value;
                                            setFormData(prev => ({ ...prev, methodSteps: newSteps }));
                                        }}
                                        className="flex-1 px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none min-h-[60px]"
                                        placeholder={`Step ${idx + 1} instruction...`}
                                    />
                                    <button
                                        onClick={() => {
                                            const newSteps = [...(formData.methodSteps || [])];
                                            newSteps.splice(idx, 1);
                                            setFormData(prev => ({ ...prev, methodSteps: newSteps }));
                                        }}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors mt-0.5"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Section 4: Mistakes & Checklists */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Mistakes */}
                        <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-red-500" />
                                    Common Mistakes
                                </h3>
                                <button
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        mistakesFixes: [...(prev.mistakesFixes || []), { mistake: '', howToPrevent: '', managerCheck: '' }]
                                    }))}
                                    className="text-amber-600 hover:text-amber-700"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                {formData.mistakesFixes?.map((m, idx) => (
                                    <div key={idx} className="p-4 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg space-y-3 relative group">
                                        <button
                                            onClick={() => {
                                                const newM = [...(formData.mistakesFixes || [])];
                                                newM.splice(idx, 1);
                                                setFormData(prev => ({ ...prev, mistakesFixes: newM }));
                                            }}
                                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">The Mistake</label>
                                            <input
                                                type="text"
                                                value={m.mistake}
                                                onChange={e => {
                                                    const newM = [...(formData.mistakesFixes || [])];
                                                    newM[idx].mistake = e.target.value;
                                                    setFormData(prev => ({ ...prev, mistakesFixes: newM }));
                                                }}
                                                className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded outline-none"
                                                placeholder="e.g. Overcooking the tapa"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">How to Prevent</label>
                                            <input
                                                type="text"
                                                value={m.howToPrevent}
                                                onChange={e => {
                                                    const newM = [...(formData.mistakesFixes || [])];
                                                    newM[idx].howToPrevent = e.target.value;
                                                    setFormData(prev => ({ ...prev, mistakesFixes: newM }));
                                                }}
                                                className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded outline-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Checklist */}
                        <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <CheckSquare size={16} className="text-emerald-500" />
                                    Quality Checklist
                                </h3>
                                <button
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        qualityChecklist: [...(prev.qualityChecklist || []), { id: Date.now().toString(), label: '', checked: false }]
                                    }))}
                                    className="text-amber-600 hover:text-amber-700"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.qualityChecklist?.map((q, idx) => (
                                    <div key={q.id} className="flex gap-2 items-center">
                                        <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 shrink-0" />
                                        <input
                                            type="text"
                                            value={q.label}
                                            onChange={e => {
                                                const newQ = [...(formData.qualityChecklist || [])];
                                                newQ[idx].label = e.target.value;
                                                setFormData(prev => ({ ...prev, qualityChecklist: newQ }));
                                            }}
                                            className="flex-1 px-2 py-1.5 text-sm bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded outline-none"
                                            placeholder="e.g. Meat is tender but not mushy"
                                        />
                                        <button
                                            onClick={() => {
                                                const newQ = [...(formData.qualityChecklist || [])];
                                                newQ.splice(idx, 1);
                                                setFormData(prev => ({ ...prev, qualityChecklist: newQ }));
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Section 5: Media URLs */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">Media Links</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Plating Photo URL</label>
                                <input
                                    type="text"
                                    value={formData.platingPhotoUrl}
                                    onChange={e => setFormData(prev => ({ ...prev, platingPhotoUrl: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none"
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Training Video URL (Drive/YouTube)</label>
                                <input
                                    type="text"
                                    value={formData.youtubeVideoUrl || formData.trainingVideoUrl}
                                    onChange={e => {
                                        const url = e.target.value;
                                        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            youtubeVideoUrl: isYouTube ? url : '',
                                            trainingVideoUrl: !isYouTube ? url : ''
                                        }));
                                    }}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-[#e8e0d4] dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? 'Updating...' : 'Save New Version'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateBlackBookVersionModal;
