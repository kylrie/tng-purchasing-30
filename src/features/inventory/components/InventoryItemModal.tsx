import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Package, AlertTriangle, Sparkles } from 'lucide-react';
import type {
    InventoryItem,
    InventoryItemType,
    InventoryCategory,
    CreateInventoryItemInput,
    UnitConversion,
    ServiceType,
    InventoryDepartment
} from '../types/InventoryItem';
import { SERVICE_TYPES, DEPARTMENTS } from '../types/InventoryItem';
import { GeminiVisionService } from '../../../shared/services/gemini-vision.service';

// ============================================================
// TYPES
// ============================================================

interface InventoryItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: CreateInventoryItemInput) => Promise<void>;
    item?: InventoryItem | null; // For editing
    businessUnitId: string;
    storageAreas: string[];
    uomOptions: string[];
}

interface FormData {
    name: string;
    type: InventoryItemType;
    department: InventoryDepartment;
    serviceType: ServiceType | '';
    category: InventoryCategory;
    sku: string;
    storageAreas: string[];
    recipeUnit: string;
    buyUnit: string;
    conversion: number;
    parLevel: number;
    currentStock: number;
    buyCost: number;
    supplier: string;
    notes: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const ITEM_TYPES: { value: InventoryItemType; label: string }[] = [
    { value: 'RAW_MATERIAL', label: 'Raw Material' },
    { value: 'FINISHED_GOOD', label: 'Finished Good' },
    { value: 'PRODUCTION', label: 'Production' },
    { value: 'ASSET', label: 'Asset' }
];

const CATEGORIES: InventoryCategory[] = [
    'Spirits', 'Wine', 'Beer', 'Mixers', 'Beverage', 'Food', 'Frozen Good',
    'Dry Goods', 'Equipment', 'Furniture', 'Supplies', 'Glassware', 'Souvenir', 'Other'
];

const INITIAL_FORM_DATA: FormData = {
    name: '',
    type: 'RAW_MATERIAL',
    department: 'Unassigned',
    serviceType: '',
    category: 'Other',
    sku: '',
    storageAreas: [],
    recipeUnit: 'piece',
    buyUnit: 'piece',
    conversion: 1,
    parLevel: 0,
    currentStock: 0,
    buyCost: 0,
    supplier: '',
    notes: ''
};

// ============================================================
// COMPONENT
// ============================================================

const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
    isOpen,
    onClose,
    onSave,
    item,
    businessUnitId,
    storageAreas,
    uomOptions
}) => {
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
    const [saving, setSaving] = useState(false);
    const [autoCategorizing, setAutoCategorizing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isEditing = !!item;

    // Derived state for base cost calculation
    const baseCost = formData.conversion > 0 ? (formData.buyCost / formData.conversion) : 0;

    // Auto-suggest department based on category (only for new items)
    const suggestDepartment = (category: InventoryCategory): InventoryDepartment | null => {
        const barCategories: InventoryCategory[] = ['Spirits', 'Wine', 'Beer', 'Mixers', 'Glassware', 'Alcohol Beverage'];
        const kitchenCategories: InventoryCategory[] = ['Food', 'Frozen Good', 'Dry Goods'];
        const retailCategories: InventoryCategory[] = ['Souvenir'];
        if (barCategories.includes(category)) return 'Bar';
        if (kitchenCategories.includes(category)) return 'Kitchen';
        if (retailCategories.includes(category)) return 'Retail';
        return null;
    };

    // Populate form when editing
    useEffect(() => {
        if (item) {
            const conversion = item.units?.conversion || 1;
            setFormData({
                name: item.name || '',
                type: item.type || 'RAW_MATERIAL',
                department: item.department || 'Unassigned',
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                serviceType: (item as any).serviceType || '',
                category: item.category || 'Other',
                sku: item.sku || '',
                storageAreas: item.storageAreas || [],
                // Guard against older records that may use 'countUnit' or have undefined units
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                recipeUnit: item.units?.recipeUnit || (item.units as any)?.countUnit || 'piece',
                buyUnit: item.units?.buyUnit || 'piece',
                conversion,
                parLevel: conversion > 0 ? (item.parLevel || 0) / conversion : (item.parLevel || 0),
                currentStock: item.currentStock || 0,
                buyCost: item.buyCost ?? item.costPerUnit ?? 0,
                supplier: item.supplier || '',
                notes: item.notes || ''
            });
        } else {
            setFormData(INITIAL_FORM_DATA);
        }
        setErrors({});
    }, [item, isOpen]);

    // Validation
    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!(formData.name || '').trim()) {
            newErrors.name = 'Name is required';
        }

        if ((formData.conversion || 0) <= 0) {
            newErrors.conversion = 'Conversion must be greater than 0';
        }

        if ((formData.buyCost || 0) < 0) {
            newErrors.buyCost = 'Cost cannot be negative';
        }

        if ((formData.parLevel || 0) < 0) {
            newErrors.parLevel = 'Par level cannot be negative';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setSaving(true);
        try {
            const units: UnitConversion = {
                recipeUnit: (formData.recipeUnit || '').trim() || 'piece',
                buyUnit: (formData.buyUnit || '').trim() || 'piece',
                conversion: formData.conversion || 1
            };

            const skuTrimmed = (formData.sku || '').trim();
            const supplierTrimmed = (formData.supplier || '').trim();
            const notesTrimmed = (formData.notes || '').trim();

            const itemData: CreateInventoryItemInput = {
                businessUnitId,
                name: (formData.name || '').trim(),
                type: formData.type,
                department: formData.department,
                ...(formData.serviceType && { serviceType: formData.serviceType as ServiceType }),
                category: formData.category,
                storageAreas: formData.storageAreas,
                units,
                parLevel: Math.round((formData.parLevel || 0) * (formData.conversion || 1)),
                currentStock: formData.currentStock || 0,
                costPerUnit: baseCost, // Legacy fallback
                buyCost: formData.buyCost || 0,
                baseCost: baseCost,    // Crucial: baseCost is the primary value used by POS BOM explosion and Recipe builder
                // Only include optional fields if they have values (avoid undefined)
                ...(skuTrimmed && { sku: skuTrimmed }),
                ...(supplierTrimmed && { supplier: supplierTrimmed }),
                ...(notesTrimmed && { notes: notesTrimmed })
            };

            await onSave(itemData);
            onClose();
        } catch (error) {
            console.error('Error saving item:', error);
            setErrors({ submit: 'Failed to save item. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    // Auto-categorize using Gemini
    const handleAutoCategorize = async () => {
        if (!formData.name.trim()) {
            setErrors({ ...errors, name: 'Please enter an item name first to auto-categorize.' });
            return;
        }
        
        setAutoCategorizing(true);
        try {
            const results = await GeminiVisionService.categorizeItems([{
                name: formData.name.trim(),
                type: formData.type
            }]);
            const category = results[formData.name.trim()];
            if (category && CATEGORIES.includes(category as InventoryCategory)) {
                setFormData(prev => ({ ...prev, category: category as InventoryCategory }));
                setErrors(prev => ({ ...prev, name: '' })); // clear name error if any
            }
        } catch (error) {
            console.error('Auto-categorize failed:', error);
        } finally {
            setAutoCategorizing(false);
        }
    };

    // Handle storage area toggle
    const handleStorageAreaToggle = (area: string) => {
        setFormData(prev => ({
            ...prev,
            storageAreas: prev.storageAreas.includes(area)
                ? prev.storageAreas.filter(a => a !== area)
                : [...prev.storageAreas, area]
        }));
    };

    if (!isOpen) return null;

    const inputClass = "w-full p-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";
    const errorClass = "text-xs text-red-400 mt-1";

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Package size={20} className="text-purple-600 dark:text-purple-400" />
                            {isEditing ? 'Edit Inventory Item' : 'Add New Item'}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-4 space-y-6">
                        {/* Global Error */}
                        {errors.submit && (
                            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} />
                                {errors.submit}
                            </div>
                        )}

                        {/* Basic Info Section */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                                Basic Information
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Name */}
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Item Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`${inputClass} ${errors.name ? 'border-red-500' : ''}`}
                                        placeholder="e.g., Jameson Irish Whiskey"
                                    />
                                    {errors.name && <p className={errorClass}>{errors.name}</p>}
                                </div>

                                {/* Type */}
                                <div>
                                    <label className={labelClass}>Item Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as InventoryItemType })}
                                        className={inputClass}
                                    >
                                        {ITEM_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Department */}
                                <div>
                                    <label className={labelClass}>Department</label>
                                    <select
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value as InventoryDepartment })}
                                        className={inputClass}
                                    >
                                        {DEPARTMENTS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">Bar, Kitchen, or Retail grouping</p>
                                </div>

                                {/* Category */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                                        <button
                                            type="button"
                                            onClick={handleAutoCategorize}
                                            disabled={autoCategorizing || !formData.name.trim()}
                                            className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50 transition-colors bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded"
                                            title="Auto-detect category from name"
                                        >
                                            {autoCategorizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            Auto
                                        </button>
                                    </div>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => {
                                            const newCategory = e.target.value as InventoryCategory;
                                            const updates: Partial<FormData> = { category: newCategory };
                                            // Auto-suggest department for new items when department is still Unassigned
                                            if (!isEditing && formData.department === 'Unassigned') {
                                                const suggested = suggestDepartment(newCategory);
                                                if (suggested) updates.department = suggested;
                                            }
                                            setFormData(prev => ({ ...prev, ...updates }));
                                        }}
                                        className={inputClass}
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Service Type (only for FINISHED_GOOD & PRODUCTION) */}
                                {(formData.type === 'FINISHED_GOOD' || formData.type === 'PRODUCTION') && (
                                    <div>
                                        <label className={labelClass}>Service Type</label>
                                        <select
                                            value={formData.serviceType}
                                            onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as ServiceType | '' })}
                                            className={inputClass}
                                        >
                                            <option value="">— Select —</option>
                                            {SERVICE_TYPES.map(st => (
                                                <option key={st} value={st}>{st}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1">Alacarte or Event classification</p>
                                    </div>
                                )}

                                {/* SKU */}
                                <div>
                                    <label className={labelClass}>SKU (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g., WHS-JAM-001"
                                    />
                                </div>

                                {/* Supplier */}
                                <div>
                                    <label className={labelClass}>Supplier (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.supplier}
                                        onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g., ABC Distributors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Storage Areas Section */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                                Storage Areas
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {storageAreas.map(area => (
                                    <button
                                        key={area}
                                        type="button"
                                        onClick={() => handleStorageAreaToggle(area)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${formData.storageAreas.includes(area)
                                            ? 'bg-purple-600 dark:bg-purple-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        {area}
                                    </button>
                                ))}
                                {storageAreas.length === 0 && (
                                    <p className="text-slate-500 text-sm">No storage areas defined</p>
                                )}
                            </div>
                        </div>

                        {/* Unit Configuration Section */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                                Unit Configuration
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Count Unit */}
                                <div>
                                    <label className={labelClass}>Recipe Unit (Base)</label>
                                    <select
                                        value={formData.recipeUnit}
                                        onChange={(e) => setFormData({ ...formData, recipeUnit: e.target.value })}
                                        className={inputClass}
                                    >
                                        {uomOptions.map((u: string) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">Unit used for recipes</p>
                                </div>

                                {/* Buy Unit */}
                                <div>
                                    <label className={labelClass}>Buy Unit</label>
                                    <select
                                        value={formData.buyUnit}
                                        onChange={(e) => setFormData({ ...formData, buyUnit: e.target.value })}
                                        className={inputClass}
                                    >
                                        {uomOptions.map((u: string) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">Unit for purchasing</p>
                                </div>

                                {/* Conversion */}
                                <div>
                                    <label className={labelClass}>Conversion Rate *</label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={formData.conversion}
                                        onChange={(e) => setFormData({ ...formData, conversion: parseFloat(e.target.value) || 0 })}
                                        className={`${inputClass} ${errors.conversion ? 'border-red-500' : ''}`}
                                        placeholder="e.g., 12"
                                    />
                                    {errors.conversion && <p className={errorClass}>{errors.conversion}</p>}
                                    <p className="text-xs text-slate-500 mt-1">
                                        {formData.conversion > 0 && formData.recipeUnit && formData.buyUnit
                                            ? `${formData.conversion} ${formData.recipeUnit}(s) = 1 ${formData.buyUnit}`
                                            : 'Recipe units per buy unit'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stock Settings Section */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                                Stock Settings
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Par Level */}
                                <div>
                                    <label className={labelClass}>Par Level ({formData.buyUnit || 'buy unit'})</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.parLevel}
                                        onChange={(e) => setFormData({ ...formData, parLevel: parseFloat(e.target.value) || 0 })}
                                        className={`${inputClass} ${errors.parLevel ? 'border-red-500' : ''}`}
                                        placeholder="Minimum stock in buy units"
                                    />
                                    {errors.parLevel && <p className={errorClass}>{errors.parLevel}</p>}
                                    <p className="text-xs text-slate-500 mt-1">
                                        = {Math.round(formData.parLevel * formData.conversion)} {formData.recipeUnit}(s)
                                    </p>
                                </div>

                                {/* Current Stock */}
                                <div>
                                    <label className={labelClass}>Current Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.currentStock}
                                        onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                                        className={inputClass}
                                        placeholder="0"
                                    />
                                </div>

                                {/* Cost per Buy Unit */}
                                <div>
                                    <label className={labelClass}>Cost per Buy Unit (₱)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.buyCost}
                                        onChange={(e) => setFormData({ ...formData, buyCost: parseFloat(e.target.value) || 0 })}
                                        className={`${inputClass} ${errors.buyCost ? 'border-red-500' : ''}`}
                                        placeholder="e.g., How much does 1 Buy Unit cost?"
                                    />
                                    {errors.buyCost && <p className={errorClass}>{errors.buyCost}</p>}
                                </div>

                                {/* Cost per Base Unit (Calculated) */}
                                <div>
                                    <label className={labelClass}>Cost per Base Unit (₱)</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={baseCost.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                        className={`${inputClass} bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed`}
                                        placeholder="0.0000"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        = {formData.buyCost || 0} / {formData.conversion || 1}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Notes Section */}
                        <div>
                            <label className={labelClass}>Notes (Optional)</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className={`${inputClass} min-h-[80px] resize-y`}
                                placeholder="Additional notes about this item..."
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90 text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                {saving ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default InventoryItemModal;
