import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Monitor,
    Save,
    Loader2,
    Calendar,
    User,
    Hash,
    MapPin,
    TrendingDown
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { InventoryItem, AssetStatus, InventoryCategory } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';

// ============================================================
// PROPS
// ============================================================

interface FixedAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    asset: InventoryItem | null; // null = create new
    businessUnitId: string;
    allUsers?: { id: string; name: string }[];
}

// ============================================================
// CONSTANTS
// ============================================================

const ASSET_STATUSES: AssetStatus[] = ['Active', 'Broken', 'In Repair', 'Decommissioned'];

const ASSET_CATEGORIES: InventoryCategory[] = [
    'Equipment',
    'Furniture',
    'Glassware',
    'Supplies',
    'Other'
];

// Common useful life presets (in years)
const USEFUL_LIFE_PRESETS = [
    { label: '3 years (Electronics)', value: 3 },
    { label: '5 years (Equipment)', value: 5 },
    { label: '7 years (Furniture)', value: 7 },
    { label: '10 years (Heavy Machinery)', value: 10 },
    { label: 'Custom', value: 0 }
];

// ============================================================
// DEPRECIATION CALCULATION HELPER
// ============================================================

/**
 * Calculate straight-line depreciation
 * @param purchasePrice Original purchase price
 * @param purchaseDate Date of purchase (YYYY-MM-DD)
 * @param usefulLifeYears Useful life in years
 * @param salvageValue Estimated salvage value (default 0)
 * @returns Object with depreciation details
 */
const calculateDepreciation = (
    purchasePrice: number,
    purchaseDate: string,
    usefulLifeYears: number,
    salvageValue: number = 0
): {
    annualDepreciation: number;
    monthlyDepreciation: number;
    accumulatedDepreciation: number;
    currentBookValue: number;
    ageInMonths: number;
    percentDepreciated: number;
    isFullyDepreciated: boolean;
} => {
    if (!purchasePrice || !purchaseDate || !usefulLifeYears || usefulLifeYears <= 0) {
        return {
            annualDepreciation: 0,
            monthlyDepreciation: 0,
            accumulatedDepreciation: 0,
            currentBookValue: purchasePrice || 0,
            ageInMonths: 0,
            percentDepreciated: 0,
            isFullyDepreciated: false
        };
    }

    const depreciableAmount = purchasePrice - salvageValue;
    const annualDepreciation = depreciableAmount / usefulLifeYears;
    const monthlyDepreciation = annualDepreciation / 12;

    // Calculate age in months
    const purchaseDateObj = new Date(purchaseDate);
    const today = new Date();
    const ageInMonths = Math.max(0,
        (today.getFullYear() - purchaseDateObj.getFullYear()) * 12 +
        (today.getMonth() - purchaseDateObj.getMonth())
    );

    const totalMonths = usefulLifeYears * 12;
    const monthsDepreciated = Math.min(ageInMonths, totalMonths);
    const accumulatedDepreciation = monthlyDepreciation * monthsDepreciated;
    const currentBookValue = Math.max(salvageValue, purchasePrice - accumulatedDepreciation);
    const percentDepreciated = (accumulatedDepreciation / depreciableAmount) * 100;
    const isFullyDepreciated = ageInMonths >= totalMonths;

    return {
        annualDepreciation,
        monthlyDepreciation,
        accumulatedDepreciation,
        currentBookValue,
        ageInMonths,
        percentDepreciated: Math.min(100, percentDepreciated),
        isFullyDepreciated
    };
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const FixedAssetModal: React.FC<FixedAssetModalProps> = ({
    isOpen,
    onClose,
    onSave,
    asset,
    businessUnitId,
    allUsers = []
}) => {
    const isEditing = !!asset;

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        category: 'Equipment' as InventoryCategory,
        sku: '',
        currentStock: 1,
        costPerUnit: 0,
        notes: '',
        imageUrl: '',
        // Asset-specific fields
        serialNumber: '',
        purchaseDate: '',
        status: 'Active' as AssetStatus,
        assignedTo: '',
        assignedToId: '',
        location: '',
        warrantyExpiry: '',
        purchasePrice: 0,
        // Depreciation fields
        usefulLifeYears: 5,
        salvageValue: 0
    });

    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    // FIX: Replace alert() with inline error state
    const [saveError, setSaveError] = useState<string | null>(null);

    // Auto-compute depreciation
    const depreciation = useMemo(() => {
        return calculateDepreciation(
            formData.purchasePrice,
            formData.purchaseDate,
            formData.usefulLifeYears,
            formData.salvageValue
        );
    }, [formData.purchasePrice, formData.purchaseDate, formData.usefulLifeYears, formData.salvageValue]);

    // Initialize form when modal opens or asset changes
    useEffect(() => {
        if (isOpen) {
            if (asset) {
                // Edit mode - populate form
                setFormData({
                    name: asset.name,
                    category: asset.category,
                    sku: asset.sku || '',
                    currentStock: asset.currentStock,
                    costPerUnit: asset.costPerUnit,
                    notes: asset.notes || '',
                    imageUrl: asset.imageUrl || '',
                    serialNumber: asset.assetDetails?.serialNumber || '',
                    purchaseDate: asset.assetDetails?.purchaseDate || '',
                    status: asset.assetDetails?.status || 'Active',
                    assignedTo: asset.assetDetails?.assignedTo || '',
                    assignedToId: asset.assetDetails?.assignedToId || '',
                    location: asset.assetDetails?.location || '',
                    warrantyExpiry: asset.assetDetails?.warrantyExpiry || '',
                    purchasePrice: asset.assetDetails?.purchasePrice || asset.costPerUnit,
                    usefulLifeYears: asset.assetDetails?.depreciationRate
                        ? Math.round(100 / asset.assetDetails.depreciationRate)
                        : 5,
                    salvageValue: 0 // Could be stored in assetDetails if needed
                });
            } else {
                // Create mode - reset form
                setFormData({
                    name: '',
                    category: 'Equipment',
                    sku: '',
                    currentStock: 1,
                    costPerUnit: 0,
                    notes: '',
                    imageUrl: '',
                    serialNumber: '',
                    purchaseDate: new Date().toISOString().split('T')[0],
                    status: 'Active',
                    assignedTo: '',
                    assignedToId: '',
                    location: '',
                    warrantyExpiry: '',
                    purchasePrice: 0,
                    usefulLifeYears: 5,
                    salvageValue: 0
                });
            }
            setErrors({});
            setSaveError(null); // FIX: Also reset save error
        }
    }, [isOpen, asset]);

    // Validation
    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Asset name is required';
        }

        if (formData.currentStock < 0) {
            newErrors.currentStock = 'Quantity cannot be negative';
        }

        if (formData.purchasePrice < 0) {
            newErrors.purchasePrice = 'Purchase price cannot be negative';
        }

        if (formData.usefulLifeYears <= 0) {
            newErrors.usefulLifeYears = 'Useful life must be greater than 0';
        }

        if (formData.salvageValue < 0) {
            newErrors.salvageValue = 'Salvage value cannot be negative';
        }

        if (formData.salvageValue > formData.purchasePrice) {
            newErrors.salvageValue = 'Salvage value cannot exceed purchase price';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle save
    const handleSave = async () => {
        if (!validate()) return;

        setIsSaving(true);
        try {
            // Calculate depreciation rate as percentage per year
            const depreciationRate = formData.usefulLifeYears > 0
                ? 100 / formData.usefulLifeYears
                : 0;

            // Build assetDetails without undefined values (Firebase doesn't accept undefined)
            const assetDetails: Record<string, unknown> = {
                status: formData.status
            };

            if (formData.serialNumber) assetDetails.serialNumber = formData.serialNumber;
            if (formData.purchaseDate) assetDetails.purchaseDate = formData.purchaseDate;
            if (formData.assignedTo) assetDetails.assignedTo = formData.assignedTo;
            if (formData.assignedToId) assetDetails.assignedToId = formData.assignedToId;
            if (formData.location) assetDetails.location = formData.location;
            if (formData.warrantyExpiry) assetDetails.warrantyExpiry = formData.warrantyExpiry;
            if (formData.purchasePrice) assetDetails.purchasePrice = formData.purchasePrice;
            if (depreciationRate > 0) assetDetails.depreciationRate = depreciationRate;

            if (isEditing && asset) {
                // Update existing asset - build payload without undefined values
                const updatePayload: Record<string, unknown> = {
                    name: formData.name,
                    category: formData.category,
                    currentStock: formData.currentStock,
                    costPerUnit: depreciation.currentBookValue / Math.max(1, formData.currentStock),
                    assetDetails
                };

                if (formData.sku) updatePayload.sku = formData.sku;
                if (formData.notes) updatePayload.notes = formData.notes;
                if (formData.imageUrl) updatePayload.imageUrl = formData.imageUrl;

                await InventoryService.updateInventoryItem(asset.id, updatePayload as Parameters<typeof InventoryService.updateInventoryItem>[1]);
            } else {
                // Create new asset - build payload without undefined values
                const createPayload: Record<string, unknown> = {
                    businessUnitId,
                    name: formData.name,
                    type: 'ASSET',
                    category: formData.category,
                    storageAreas: formData.location ? [formData.location] : [],
                    units: {
                        countUnit: 'unit',
                        buyUnit: 'unit',
                        conversion: 1
                    },
                    parLevel: 1,
                    currentStock: formData.currentStock,
                    costPerUnit: formData.purchasePrice / Math.max(1, formData.currentStock),
                    assetDetails
                };

                // Only add optional fields if they have values
                if (formData.sku) createPayload.sku = formData.sku;
                if (formData.notes) createPayload.notes = formData.notes;
                if (formData.imageUrl) createPayload.imageUrl = formData.imageUrl;

                await InventoryService.createInventoryItem(createPayload as unknown as Parameters<typeof InventoryService.createInventoryItem>[0]);
            }

            onSave();
            onClose();
        } catch (err) {
            console.error('Error saving asset:', err);
            // FIX: Replace alert() with inline error state
            setSaveError('Failed to save asset. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle user selection for "Assigned To"
    const handleUserSelect = (userId: string) => {
        const user = allUsers.find(u => u.id === userId);
        setFormData(prev => ({
            ...prev,
            assignedToId: userId,
            assignedTo: user?.name || ''
        }));
    };

    if (!isOpen) return null;

    const inputClass = "w-full p-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-500";
    const labelClass = "block text-sm font-medium text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-500/20 rounded-lg">
                            <Monitor className="text-teal-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {isEditing ? 'Edit Asset' : 'Add New Asset'}
                            </h2>
                            <p className="text-sm text-slate-400">
                                {isEditing ? 'Update asset details' : 'Add equipment, machinery, or furniture'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Content */}
                <div className="p-6 space-y-6">
                    {/* Save Error Display */}
                    {saveError && (
                        <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm flex items-center justify-between">
                            <span>{saveError}</span>
                            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-300 ml-2">&times;</button>
                        </div>
                    )}
                    {/* Basic Info Section */}
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700 space-y-4">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Monitor size={16} className="text-teal-400" />
                            Basic Information
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Asset Name */}
                            <div className="md:col-span-2">
                                <label className={labelClass}>Asset Name *</label>
                                <input
                                    type="text"
                                    className={`${inputClass} ${errors.name ? 'border-red-500' : ''}`}
                                    placeholder="e.g., Commercial Blender"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                />
                                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                            </div>

                            {/* Category */}
                            <div>
                                <label className={labelClass}>Category</label>
                                <select
                                    className={inputClass}
                                    value={formData.category}
                                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as InventoryCategory }))}
                                >
                                    {ASSET_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className={labelClass}>Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    className={`${inputClass} ${errors.currentStock ? 'border-red-500' : ''}`}
                                    value={formData.currentStock}
                                    onChange={(e) => setFormData(prev => ({ ...prev, currentStock: parseInt(e.target.value) || 1 }))}
                                />
                                {errors.currentStock && <p className="text-red-400 text-xs mt-1">{errors.currentStock}</p>}
                            </div>

                            {/* Serial / Tag Number */}
                            <div>
                                <label className={labelClass}>
                                    <Hash size={14} className="inline mr-1" />
                                    Serial / Tag Number
                                </label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    placeholder="e.g., EQUIP-001"
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className={labelClass}>Status</label>
                                <select
                                    className={inputClass}
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as AssetStatus }))}
                                >
                                    {ASSET_STATUSES.map(status => (
                                        <option key={status} value={status} className="bg-slate-800">{status}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Purchase & Depreciation Section */}
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700 space-y-4">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <TrendingDown size={16} className="text-amber-400" />
                            Purchase & Depreciation
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Purchase Date */}
                            <div>
                                <label className={labelClass}>
                                    <Calendar size={14} className="inline mr-1" />
                                    Purchase Date
                                </label>
                                <input
                                    type="date"
                                    className={inputClass}
                                    value={formData.purchaseDate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                                />
                            </div>

                            {/* Purchase Price */}
                            <div>
                                <label className={labelClass}>Purchase Price (₱)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={`${inputClass} ${errors.purchasePrice ? 'border-red-500' : ''}`}
                                    placeholder="0.00"
                                    value={formData.purchasePrice || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                                />
                                {errors.purchasePrice && <p className="text-red-400 text-xs mt-1">{errors.purchasePrice}</p>}
                            </div>

                            {/* Useful Life */}
                            <div>
                                <label className={labelClass}>Useful Life (Years)</label>
                                <select
                                    className={inputClass}
                                    value={USEFUL_LIFE_PRESETS.some(p => p.value === formData.usefulLifeYears) ? formData.usefulLifeYears : 0}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (val > 0) {
                                            setFormData(prev => ({ ...prev, usefulLifeYears: val }));
                                        }
                                    }}
                                >
                                    {USEFUL_LIFE_PRESETS.map(preset => (
                                        <option key={preset.value} value={preset.value} className="bg-slate-800">
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                                {(!USEFUL_LIFE_PRESETS.some(p => p.value === formData.usefulLifeYears) || formData.usefulLifeYears === 0) && (
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        className={`${inputClass} mt-2 ${errors.usefulLifeYears ? 'border-red-500' : ''}`}
                                        placeholder="Enter custom years"
                                        value={formData.usefulLifeYears || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, usefulLifeYears: parseInt(e.target.value) || 0 }))}
                                    />
                                )}
                                {errors.usefulLifeYears && <p className="text-red-400 text-xs mt-1">{errors.usefulLifeYears}</p>}
                            </div>

                            {/* Salvage Value */}
                            <div>
                                <label className={labelClass}>Salvage Value (₱)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={`${inputClass} ${errors.salvageValue ? 'border-red-500' : ''}`}
                                    placeholder="0.00"
                                    value={formData.salvageValue || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, salvageValue: parseFloat(e.target.value) || 0 }))}
                                />
                                <p className="text-xs text-slate-500 mt-1">Estimated value at end of useful life</p>
                                {errors.salvageValue && <p className="text-red-400 text-xs mt-1">{errors.salvageValue}</p>}
                            </div>

                            {/* Warranty Expiry */}
                            <div>
                                <label className={labelClass}>Warranty Expiry</label>
                                <input
                                    type="date"
                                    className={inputClass}
                                    value={formData.warrantyExpiry}
                                    onChange={(e) => setFormData(prev => ({ ...prev, warrantyExpiry: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Depreciation Summary Card */}
                        {formData.purchasePrice > 0 && formData.purchaseDate && (
                            <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-xl p-4 border border-amber-700/30 mt-4">
                                <h4 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                                    <TrendingDown size={14} />
                                    Depreciation Summary (Straight-Line Method)
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-amber-200/70">Annual Depreciation</p>
                                        <p className="text-white font-bold flex items-center gap-1">
                                            <PesoSign size={14} />
                                            {depreciation.annualDepreciation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-amber-200/70">Accumulated</p>
                                        <p className="text-white font-bold flex items-center gap-1">
                                            <PesoSign size={14} />
                                            {depreciation.accumulatedDepreciation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-amber-200/70">Current Book Value</p>
                                        <p className={`font-bold flex items-center gap-1 ${depreciation.isFullyDepreciated ? 'text-red-400' : 'text-green-400'}`}>
                                            <PesoSign size={14} />
                                            {depreciation.currentBookValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-amber-200/70">% Depreciated</p>
                                        <p className="text-white font-bold">
                                            {depreciation.percentDepreciated.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                                {depreciation.isFullyDepreciated && (
                                    <div className="mt-3 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs">
                                        ⚠️ This asset is fully depreciated
                                    </div>
                                )}
                                <p className="text-xs text-amber-200/50 mt-3">
                                    Asset age: {Math.floor(depreciation.ageInMonths / 12)} years, {depreciation.ageInMonths % 12} months
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Assignment & Location Section */}
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700 space-y-4">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <User size={16} className="text-blue-400" />
                            Assignment & Location
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Assigned To */}
                            <div>
                                <label className={labelClass}>Assigned To</label>
                                {allUsers.length > 0 ? (
                                    <select
                                        className={inputClass}
                                        value={formData.assignedToId}
                                        onChange={(e) => handleUserSelect(e.target.value)}
                                    >
                                        <option value="" className="bg-slate-800">-- Not Assigned --</option>
                                        {allUsers.map(user => (
                                            <option key={user.id} value={user.id} className="bg-slate-800">
                                                {user.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Employee name"
                                        value={formData.assignedTo}
                                        onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                                    />
                                )}
                            </div>

                            {/* Location */}
                            <div>
                                <label className={labelClass}>
                                    <MapPin size={14} className="inline mr-1" />
                                    Location
                                </label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    placeholder="e.g., Kitchen, Office"
                                    value={formData.location}
                                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className={labelClass}>Notes</label>
                        <textarea
                            className={`${inputClass} h-20 resize-none`}
                            placeholder="Additional notes about this asset..."
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-gradient-to-r from-teal-600 to-cyan-500 hover:opacity-90 text-white rounded-lg font-semibold flex items-center gap-2 transition-opacity disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                {isEditing ? 'Update Asset' : 'Add Asset'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FixedAssetModal;
