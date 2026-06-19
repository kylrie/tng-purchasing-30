import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChefHat, AlertTriangle, CheckSquare } from 'lucide-react';
import type { 
    CreateBlackBookRecipeInput, 
    BlackBookIngredient, 
    PrepStation 
} from '../types/blackbook.types';
import { PREP_STATIONS } from '../types/blackbook.types';
import type { ProductionRecipe, MenuItem } from '../types/menu.types';
import { ProductionRecipeService } from '../services/production-recipe.service';
import { getMenuItems } from '../services/recipes.service';
import { BlackBookService } from '../services/blackbook.service';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';

interface CreateBlackBookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecipeCreated: () => void;
}

const INITIAL_FORM: CreateBlackBookRecipeInput = {
    businessUnitId: '',
    name: '',
    prepStation: 'Prep Station',
    productionRecipeId: '',
    menuItemId: '',
    batchYield: '',
    cookTempTime: '',
    costPerServing: '',
    ingredients: [],
    methodSteps: [{ stepNumber: 1, instruction: '' }],
    mistakesFixes: [],
    qualityChecklist: [],
    platingPhotoUrl: '',
    trainingVideoUrl: '',
    youtubeVideoUrl: ''
};

const CreateBlackBookModal: React.FC<CreateBlackBookModalProps> = ({ isOpen, onClose, onRecipeCreated }) => {
    const { selectedBusinessUnit } = useBusinessUnit();
    const [formData, setFormData] = useState<CreateBlackBookRecipeInput>(INITIAL_FORM);
    
    const [productionRecipes, setProductionRecipes] = useState<ProductionRecipe[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load available recipes and menu items for linking
    useEffect(() => {
        if (!isOpen || !selectedBusinessUnit || selectedBusinessUnit === 'all') return;
        
        const loadData = async () => {
            try {
                const [recipes, items] = await Promise.all([
                    ProductionRecipeService.getRecipes(selectedBusinessUnit),
                    getMenuItems(selectedBusinessUnit)
                ]);
                setProductionRecipes(recipes);
                setMenuItems(items);
                setFormData(prev => ({ ...prev, businessUnitId: selectedBusinessUnit }));
            } catch (err) {
                console.error("Failed to load linked data:", err);
                setError("Failed to load production recipes and menu items.");
            }
        };
        
        loadData();
    }, [isOpen, selectedBusinessUnit]);

    // Handle Production Recipe Selection -> Auto-fill ingredients
    const handleProductionRecipeChange = (recipeId: string) => {
        setFormData(prev => ({ ...prev, productionRecipeId: recipeId }));
        
        const recipe = productionRecipes.find(r => r.id === recipeId);
        if (recipe) {
            // Pre-fill Name if empty
            const updates: Partial<CreateBlackBookRecipeInput> = {};
            if (!formData.name) updates.name = recipe.name;
            if (!formData.batchYield) updates.batchYield = `${recipe.yieldQuantity} ${recipe.yieldUnit}`;
            if (!formData.costPerServing && recipe.costPerUnit) updates.costPerServing = `₱${recipe.costPerUnit.toFixed(2)}`;
            
            // Auto-populate ingredients
            const blackBookIngredients: BlackBookIngredient[] = recipe.ingredients.map(ing => ({
                ...ing,
                specStandard: '',
                allowedSubstitute: ''
            }));
            
            setFormData(prev => ({ 
                ...prev, 
                ...updates,
                ingredients: blackBookIngredients 
            }));
        }
    };

    const handleSave = async () => {
        try {
            setError(null);
            if (!formData.name) throw new Error("Recipe name is required");
            if (!formData.businessUnitId || formData.businessUnitId === 'all') throw new Error("Select a specific Business Unit first");

            setIsSaving(true);
            
            // Clean up empty steps/items
            const cleanData = {
                ...formData,
                methodSteps: formData.methodSteps.filter(s => s.instruction.trim()),
                mistakesFixes: formData.mistakesFixes.filter(m => m.mistake.trim()),
                qualityChecklist: formData.qualityChecklist.filter(q => q.label.trim())
            };
            
            // Ensure step numbers are sequential
            cleanData.methodSteps.forEach((step, idx) => {
                step.stepNumber = idx + 1;
            });

            await BlackBookService.createRecipe(cleanData);
            onRecipeCreated();
            setFormData(INITIAL_FORM); // Reset
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to save recipe");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    if (selectedBusinessUnit === 'all') {
        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Select Business Unit</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">Please select a specific business unit from the top navigation before creating a new recipe.</p>
                    <button onClick={onClose} className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg font-medium">Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
            <div className="bg-[#faf8f5] dark:bg-slate-900 w-full max-w-4xl h-full shadow-2xl flex flex-col animate-slide-in-right border-l border-[#e8e0d4] dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Create New Black Book Recipe</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Standardize your kitchen operations</p>
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
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                                    placeholder="e.g. Signature Beef Tapa"
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
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Link to Production Recipe</label>
                                <select
                                    value={formData.productionRecipeId}
                                    onChange={e => handleProductionRecipeChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                >
                                    <option value="">-- No linked production recipe --</option>
                                    {productionRecipes.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.yieldQuantity} {r.yieldUnit})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Link to Menu Item (POS)</label>
                                <select
                                    value={formData.menuItemId}
                                    onChange={e => setFormData(prev => ({ ...prev, menuItemId: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                >
                                    <option value="">-- No linked menu item --</option>
                                    {menuItems.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Operational Metrics */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">Operational Metrics</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Batch Yield / Servings</label>
                                <input
                                    type="text"
                                    value={formData.batchYield}
                                    onChange={e => setFormData(prev => ({ ...prev, batchYield: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    placeholder="e.g. 20 servings / 2.4 kg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cook Temp & Time</label>
                                <input
                                    type="text"
                                    value={formData.cookTempTime}
                                    onChange={e => setFormData(prev => ({ ...prev, cookTempTime: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    placeholder="e.g. Medium-high · 4-5 min"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cost Per Serving (Target)</label>
                                <input
                                    type="text"
                                    value={formData.costPerServing}
                                    onChange={e => setFormData(prev => ({ ...prev, costPerServing: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    placeholder="e.g. ₱86.40"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Ingredients */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Ingredients & Standards</h3>
                            <span className="text-xs text-amber-600 font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">Auto-filled from Production</span>
                        </div>
                        
                        {formData.ingredients.length === 0 ? (
                            <div className="text-center py-6 bg-[#faf8f5] dark:bg-slate-900 rounded-lg border border-dashed border-[#e8e0d4] dark:border-slate-700 text-slate-500 text-sm">
                                Select a Production Recipe above to populate ingredients, or add them manually.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {formData.ingredients.map((ing, idx) => (
                                    <div key={idx} className="p-3 bg-[#faf8f5] dark:bg-slate-900 rounded-lg border border-[#e8e0d4] dark:border-slate-700 grid grid-cols-12 gap-3 items-start">
                                        <div className="col-span-3">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{ing.inventoryItemName}</p>
                                            <p className="text-xs text-slate-500">{ing.baseQuantity} {ing.unit}</p>
                                        </div>
                                        <div className="col-span-4">
                                            <input
                                                type="text"
                                                placeholder="Spec Standard (e.g. 2mm slice)"
                                                value={ing.specStandard || ''}
                                                onChange={e => {
                                                    const newIngs = [...formData.ingredients];
                                                    newIngs[idx].specStandard = e.target.value;
                                                    setFormData(prev => ({ ...prev, ingredients: newIngs }));
                                                }}
                                                className="w-full text-xs px-2 py-1.5 bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded outline-none focus:border-amber-500"
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <input
                                                type="text"
                                                placeholder="Allowed Substitute"
                                                value={ing.allowedSubstitute || ''}
                                                onChange={e => {
                                                    const newIngs = [...formData.ingredients];
                                                    newIngs[idx].allowedSubstitute = e.target.value;
                                                    setFormData(prev => ({ ...prev, ingredients: newIngs }));
                                                }}
                                                className="w-full text-xs px-2 py-1.5 bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded outline-none focus:border-amber-500"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button 
                                                onClick={() => {
                                                    const newIngs = formData.ingredients.filter((_, i) => i !== idx);
                                                    setFormData(prev => ({ ...prev, ingredients: newIngs }));
                                                }}
                                                className="text-red-400 hover:text-red-600 p-1"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Section 4: Method Steps */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">Method Instructions</h3>
                        <div className="space-y-2">
                            {formData.methodSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <div className="w-8 h-10 shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold rounded-lg flex items-center justify-center">
                                        {idx + 1}
                                    </div>
                                    <textarea
                                        value={step.instruction}
                                        onChange={e => {
                                            const newSteps = [...formData.methodSteps];
                                            newSteps[idx].instruction = e.target.value;
                                            setFormData(prev => ({ ...prev, methodSteps: newSteps }));
                                        }}
                                        className="flex-1 px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none resize-none"
                                        rows={2}
                                        placeholder="Describe this step..."
                                    />
                                    <button 
                                        onClick={() => {
                                            const newSteps = formData.methodSteps.filter((_, i) => i !== idx);
                                            setFormData(prev => ({ ...prev, methodSteps: newSteps }));
                                        }}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0 h-10"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={() => setFormData(prev => ({ 
                                ...prev, 
                                methodSteps: [...prev.methodSteps, { stepNumber: prev.methodSteps.length + 1, instruction: '' }] 
                            }))}
                            className="text-sm font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 mt-2"
                        >
                            <Plus size={16} /> Add Step
                        </button>
                    </section>

                    {/* Section 5: Mistakes & Fixes */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-orange-500" />
                            Mistakes & Fixes
                        </h3>
                        <div className="space-y-3">
                            {formData.mistakesFixes.map((mf, idx) => (
                                <div key={idx} className="p-4 bg-orange-50/50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30 grid grid-cols-3 gap-3 relative">
                                    <button 
                                        onClick={() => {
                                            const newMF = formData.mistakesFixes.filter((_, i) => i !== idx);
                                            setFormData(prev => ({ ...prev, mistakesFixes: newMF }));
                                        }}
                                        className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div>
                                        <label className="block text-xs font-medium text-orange-800 dark:text-orange-400 mb-1">Common Mistake</label>
                                        <input
                                            type="text"
                                            value={mf.mistake}
                                            onChange={e => {
                                                const newMF = [...formData.mistakesFixes];
                                                newMF[idx].mistake = e.target.value;
                                                setFormData(prev => ({ ...prev, mistakesFixes: newMF }));
                                            }}
                                            className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/50 rounded-lg outline-none focus:border-orange-500"
                                            placeholder="e.g. Overcooking the beef"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">How to Prevent</label>
                                        <input
                                            type="text"
                                            value={mf.howToPrevent}
                                            onChange={e => {
                                                const newMF = [...formData.mistakesFixes];
                                                newMF[idx].howToPrevent = e.target.value;
                                                setFormData(prev => ({ ...prev, mistakesFixes: newMF }));
                                            }}
                                            className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 rounded-lg outline-none focus:border-emerald-500"
                                            placeholder="e.g. Keep heat exactly at medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Manager Check</label>
                                        <input
                                            type="text"
                                            value={mf.managerCheck}
                                            onChange={e => {
                                                const newMF = [...formData.mistakesFixes];
                                                newMF[idx].managerCheck = e.target.value;
                                                setFormData(prev => ({ ...prev, mistakesFixes: newMF }));
                                            }}
                                            className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900/50 rounded-lg outline-none focus:border-blue-500"
                                            placeholder="e.g. Spot check internal temp"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={() => setFormData(prev => ({ 
                                ...prev, 
                                mistakesFixes: [...prev.mistakesFixes, { mistake: '', howToPrevent: '', managerCheck: '' }] 
                            }))}
                            className="text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 mt-2"
                        >
                            <Plus size={16} /> Add Mistake/Fix
                        </button>
                    </section>

                    {/* Section 6: Quality Checklist */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <CheckSquare size={16} className="text-emerald-500" />
                            Quality Checklist
                        </h3>
                        <div className="space-y-2">
                            {formData.qualityChecklist.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <div className="w-5 h-5 rounded border-2 border-emerald-500 flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={item.label}
                                        onChange={e => {
                                            const newItems = [...formData.qualityChecklist];
                                            newItems[idx].label = e.target.value;
                                            setFormData(prev => ({ ...prev, qualityChecklist: newItems }));
                                        }}
                                        className="flex-1 px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                        placeholder="e.g. Meat is tender and slices easily"
                                    />
                                    <button 
                                        onClick={() => {
                                            const newItems = formData.qualityChecklist.filter((_, i) => i !== idx);
                                            setFormData(prev => ({ ...prev, qualityChecklist: newItems }));
                                        }}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={() => setFormData(prev => ({ 
                                ...prev, 
                                qualityChecklist: [...prev.qualityChecklist, { id: Date.now().toString() + Math.random().toString(), label: '', checked: false }] 
                            }))}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-2"
                        >
                            <Plus size={16} /> Add Checklist Item
                        </button>
                    </section>

                    {/* Section 7: Media Links */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#e8e0d4] dark:border-slate-700 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">Media Links</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Plating Photo URL (Imgur, etc)</label>
                                <input
                                    type="text"
                                    value={formData.platingPhotoUrl}
                                    onChange={e => setFormData(prev => ({ ...prev, platingPhotoUrl: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    placeholder="https://i.imgur.com/..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Training Video (Google Drive Link)</label>
                                <input
                                    type="text"
                                    value={formData.trainingVideoUrl}
                                    onChange={e => setFormData(prev => ({ ...prev, trainingVideoUrl: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none mb-3"
                                    placeholder="https://drive.google.com/file/d/..."
                                />
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Training Video (YouTube Link)</label>
                                <input
                                    type="text"
                                    value={formData.youtubeVideoUrl}
                                    onChange={e => setFormData(prev => ({ ...prev, youtubeVideoUrl: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-slate-900 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    placeholder="https://youtube.com/watch?v=..."
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#e8e0d4] dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !formData.name}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white rounded-lg font-semibold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isSaving ? 'Saving...' : 'Create Recipe'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateBlackBookModal;
