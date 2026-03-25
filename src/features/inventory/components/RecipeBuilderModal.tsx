import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, FlaskConical, Save } from 'lucide-react';
import type { InventoryItem, BomIngredient } from '../types/InventoryItem';
import InventoryService from '../services/inventory.service';

// ============================================================
// PROPS
// ============================================================

interface RecipeBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem;                       // The Finished Good being edited
    rawMaterials: (InventoryItem & { id: string })[];  // All RAW_MATERIAL items for dropdown
    onSaved: () => void;                       // Callback after save
}

// ============================================================
// COMPONENT
// ============================================================

const RecipeBuilderModal: React.FC<RecipeBuilderModalProps> = ({
    isOpen,
    onClose,
    item,
    rawMaterials,
    onSaved,
}) => {
    const initialRecipe = item.recipe ?? [];
    const [recipe, setRecipe] = useState<BomIngredient[]>(
        initialRecipe.length > 0 ? [...initialRecipe] : []
    );
    const [saving, setSaving] = useState(false);

    // Reset recipe state when a different item opens
    const [prevItemId, setPrevItemId] = useState(item.id);
    if (item.id !== prevItemId) {
        setPrevItemId(item.id);
        setRecipe(item.recipe?.length ? [...item.recipe] : []);
    }

    // Common units for recipe ingredients
    const RECIPE_UNITS = ['g', 'kg', 'ml', 'liter', 'piece', 'unit', 'oz', 'shot', 'bottle', 'cup', 'tbsp', 'tsp'];

    // Filter out already-used ingredients
    const availableRawMaterials = useMemo(() => {
        const usedIds = new Set(recipe.map(r => r.ingredientId));
        return rawMaterials.filter(rm => !usedIds.has(rm.id));
    }, [rawMaterials, recipe]);

    const handleAddIngredient = () => {
        if (availableRawMaterials.length === 0) return;
        const rm = availableRawMaterials[0];
        setRecipe(prev => [
            ...prev,
            {
                ingredientId: rm.id,
                ingredientName: rm.name,
                quantityUsed: 0,
                unit: rm.units?.countUnit || 'g',
            },
        ]);
    };

    const handleRemoveIngredient = (index: number) => {
        setRecipe(prev => prev.filter((_, i) => i !== index));
    };

    const handleIngredientChange = (index: number, field: keyof BomIngredient, value: string | number) => {
        setRecipe(prev =>
            prev.map((ing, i) => {
                if (i !== index) return ing;
                if (field === 'ingredientId') {
                    const rm = rawMaterials.find(r => r.id === value);
                    return {
                        ...ing,
                        ingredientId: value as string,
                        ingredientName: rm?.name || '',
                        unit: rm?.units?.countUnit || ing.unit,
                    };
                }
                return { ...ing, [field]: value };
            })
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Filter out ingredients with zero quantity
            const validRecipe = recipe.filter(r => r.quantityUsed > 0 && r.ingredientId);
            await InventoryService.updateInventoryItem(item.id, {
                recipe: validRecipe.length > 0 ? validRecipe : undefined,
            } as Partial<InventoryItem>);
            onSaved();
            onClose();
        } catch (err) {
            console.error('Failed to save recipe:', err);
            alert('Failed to save recipe. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div
                style={{
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(30,41,59,0.97))',
                    border: '1px solid rgba(148,163,184,0.15)',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '720px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px 24px',
                        borderBottom: '1px solid rgba(148,163,184,0.1)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <FlaskConical size={20} color="#fff" />
                        </div>
                        <div>
                            <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                                Recipe Builder
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                                {item.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: '1px solid rgba(148,163,184,0.2)', background: 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                    >
                        <X size={16} color="#94a3b8" />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {/* Info banner */}
                    <div style={{
                        background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                        borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
                        fontSize: '13px', color: '#c4b5fd', lineHeight: '1.5',
                    }}>
                        Define the raw materials consumed when <strong>1 unit</strong> of "<strong>{item.name}</strong>" is sold via POS.
                        During POS imports, each ingredient's theoretical stock will be automatically deducted.
                    </div>

                    {/* Ingredients list */}
                    {recipe.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '40px 20px', color: '#64748b',
                            border: '2px dashed rgba(100,116,139,0.2)', borderRadius: '12px',
                        }}>
                            <FlaskConical size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                            <p style={{ fontSize: '14px', margin: 0 }}>No ingredients yet. Click "Add Ingredient" to start building the recipe.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Header row */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px',
                                gap: '10px', padding: '0 4px', fontSize: '11px', fontWeight: 600,
                                color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>
                                <span>Ingredient</span>
                                <span>Qty / Unit Sold</span>
                                <span>Unit</span>
                                <span></span>
                            </div>

                            {recipe.map((ing, idx) => (
                                <div key={idx} style={{
                                    display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px',
                                    gap: '10px', alignItems: 'center',
                                    background: 'rgba(30,41,59,0.6)', borderRadius: '10px',
                                    padding: '10px 12px', border: '1px solid rgba(148,163,184,0.08)',
                                }}>
                                    {/* Ingredient selector */}
                                    <select
                                        value={ing.ingredientId}
                                        onChange={(e) => handleIngredientChange(idx, 'ingredientId', e.target.value)}
                                        style={{
                                            background: 'rgba(15,23,42,0.6)', color: '#e2e8f0',
                                            border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px',
                                            padding: '8px 10px', fontSize: '13px', width: '100%',
                                        }}
                                    >
                                        {/* Keep current selection visible */}
                                        <option value={ing.ingredientId}>{ing.ingredientName}</option>
                                        {availableRawMaterials
                                            .filter(rm => rm.id !== ing.ingredientId)
                                            .map(rm => (
                                                <option key={rm.id} value={rm.id}>{rm.name}</option>
                                            ))}
                                    </select>

                                    {/* Quantity input */}
                                    <input
                                        type="number"
                                        min={0}
                                        step="any"
                                        value={ing.quantityUsed || ''}
                                        onChange={(e) =>
                                            handleIngredientChange(idx, 'quantityUsed', parseFloat(e.target.value) || 0)
                                        }
                                        placeholder="Qty"
                                        style={{
                                            background: 'rgba(15,23,42,0.6)', color: '#e2e8f0',
                                            border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px',
                                            padding: '8px 10px', fontSize: '13px', width: '100%',
                                            textAlign: 'right',
                                        }}
                                    />

                                    {/* Unit selector */}
                                    <select
                                        value={ing.unit}
                                        onChange={(e) => handleIngredientChange(idx, 'unit', e.target.value)}
                                        style={{
                                            background: 'rgba(15,23,42,0.6)', color: '#e2e8f0',
                                            border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px',
                                            padding: '8px 10px', fontSize: '13px', width: '100%',
                                        }}
                                    >
                                        {RECIPE_UNITS.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>

                                    {/* Remove button */}
                                    <button
                                        onClick={() => handleRemoveIngredient(idx)}
                                        title="Remove ingredient"
                                        style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            border: 'none', background: 'rgba(239,68,68,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Trash2 size={14} color="#ef4444" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Ingredient button */}
                    <button
                        onClick={handleAddIngredient}
                        disabled={availableRawMaterials.length === 0}
                        style={{
                            marginTop: '16px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 16px', borderRadius: '10px',
                            border: '1px dashed rgba(139,92,246,0.3)',
                            background: 'rgba(139,92,246,0.06)', color: '#a78bfa',
                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                            opacity: availableRawMaterials.length === 0 ? 0.4 : 1,
                            width: '100%', justifyContent: 'center',
                        }}
                    >
                        <Plus size={16} />
                        Add Ingredient
                    </button>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex', justifyContent: 'flex-end', gap: '10px',
                        padding: '16px 24px',
                        borderTop: '1px solid rgba(148,163,184,0.1)',
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px', borderRadius: '10px',
                            border: '1px solid rgba(148,163,184,0.2)',
                            background: 'transparent', color: '#94a3b8',
                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '10px 24px', borderRadius: '10px',
                            border: 'none',
                            background: saving
                                ? 'rgba(139,92,246,0.3)'
                                : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            color: '#fff',
                            fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px',
                        }}
                    >
                        <Save size={14} />
                        {saving ? 'Saving...' : 'Save Recipe'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecipeBuilderModal;
