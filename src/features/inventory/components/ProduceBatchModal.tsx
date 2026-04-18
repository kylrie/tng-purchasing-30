import React, { useState, useMemo } from 'react';
import { X, Layers, CheckCircle, AlertTriangle, Package2, Flame } from 'lucide-react';
import type { InventoryItem, ProductionBatchResult } from '../types/InventoryItem';
import InventoryService from '../services/inventory.service';

// ============================================================
// PROPS
// ============================================================

interface ProduceBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem;                            // The PRODUCTION item
    allItems: (InventoryItem & { id: string })[];   // Full inventory for stock checks
    businessUnitId: string;
    performedBy: { id: string; name: string };
    onProduced: () => void;
}

// ============================================================
// COMPONENT
// ============================================================

const ProduceBatchModal: React.FC<ProduceBatchModalProps> = ({
    isOpen,
    onClose,
    item,
    allItems,
    businessUnitId,
    performedBy,
    onProduced,
}) => {
    const [multiplier, setMultiplier] = useState(1);
    const [notes, setNotes] = useState('');
    const [producing, setProducing] = useState(false);
    const [result, setResult] = useState<ProductionBatchResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // ── Pre-flight calculations ──────────────────────────────────
    const preview = useMemo(() => {
        if (!item.recipe || item.recipe.length === 0) return null;

        return item.recipe.map(ing => {
            const raw = allItems.find(i => i.id === ing.ingredientId);
            const totalNeeded = ing.quantityUsed * multiplier;
            const wasteQty = ing.wastagePercent
                ? parseFloat((totalNeeded * (ing.wastagePercent / 100)).toFixed(4))
                : 0;
            const costPerUnit = raw?.baseCost ?? raw?.costPerUnit ?? 0;
            const wastageCost = wasteQty * costPerUnit;
            const hasEnough = (raw?.currentStock ?? 0) >= totalNeeded;

            return {
                ingredientId: ing.ingredientId,
                ingredientName: ing.ingredientName,
                unit: ing.unit,
                totalNeeded,
                wasteQty,
                wastagePercent: ing.wastagePercent ?? 0,
                wastageCost,
                hasEnough,
                currentStock: raw?.currentStock ?? 0,
                stockUnit: raw?.units?.recipeUnit ?? ing.unit,
            };
        });
    }, [item.recipe, allItems, multiplier]);

    const canProduce = preview?.every(p => p.hasEnough) ?? false;
    const outputAdded = (item.units?.conversion ?? 1) * multiplier;
    const totalWastageCost = preview?.reduce((s, p) => s + p.wastageCost, 0) ?? 0;

    const handleProduce = async () => {
        setError(null);
        setProducing(true);
        try {
            const res = await InventoryService.produceProductionBatch({
                businessUnitId,
                productionItemId: item.id,
                batchMultiplier: multiplier,
                performedBy,
                notes: notes.trim() || undefined,
            });
            setResult(res);
            onProduced();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Production failed. Please try again.');
        } finally {
            setProducing(false);
        }
    };

    const handleClose = () => {
        setResult(null);
        setError(null);
        setMultiplier(1);
        setNotes('');
        onClose();
    };

    if (!isOpen) return null;

    // ── Success screen ───────────────────────────────────────────
    if (result) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(30,41,59,0.97))',
                    border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '16px',
                    width: '100%', maxWidth: '520px',
                    padding: '32px', textAlign: 'center',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'rgba(16,185,129,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                    }}>
                        <CheckCircle size={32} color="#10b981" />
                    </div>
                    <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
                        Production Complete!
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
                        {result.batchesProduced}&times; batch of <strong style={{ color: '#e2e8f0' }}>{result.productionItem}</strong> produced
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div style={{
                            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                            borderRadius: '10px', padding: '14px',
                        }}>
                            <p style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', margin: 0 }}>
                                +{result.outputAdded}
                            </p>
                            <p style={{ fontSize: '12px', color: '#6ee7b7', margin: 0 }}>Units produced</p>
                        </div>
                        <div style={{
                            background: result.totalWastageCost > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(100,116,139,0.08)',
                            border: `1px solid ${result.totalWastageCost > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.15)'}`,
                            borderRadius: '10px', padding: '14px',
                        }}>
                            <p style={{ fontSize: '22px', fontWeight: 700, color: result.totalWastageCost > 0 ? '#f59e0b' : '#64748b', margin: 0 }}>
                                ₱{result.totalWastageCost.toFixed(2)}
                            </p>
                            <p style={{ fontSize: '12px', color: result.totalWastageCost > 0 ? '#fcd34d' : '#94a3b8', margin: 0 }}>
                                Wastage cost
                            </p>
                        </div>
                    </div>

                    {/* Wastage breakdown */}
                    {result.wastageRecorded.length > 0 && (
                        <div style={{
                            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                            borderRadius: '10px', padding: '12px', marginBottom: '20px', textAlign: 'left',
                        }}>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                Prep Wastage Recorded
                            </p>
                            {result.wastageRecorded.map((w, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', paddingBottom: '4px' }}>
                                    <span>{w.name} — {w.qty} {w.unit}</span>
                                    <span style={{ color: '#fbbf24' }}>₱{w.cost.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleClose}
                        style={{
                            width: '100%', padding: '12px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none', borderRadius: '10px',
                            color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // ── Main modal ───────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(30,41,59,0.97))',
                border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: '16px',
                width: '100%', maxWidth: '620px',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Layers size={20} color="#fff" />
                        </div>
                        <div>
                            <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                                Produce Batch
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{item.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: '1px solid rgba(148,163,184,0.2)',
                            background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <X size={16} color="#94a3b8" />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                    {/* No recipe warning */}
                    {(!item.recipe || item.recipe.length === 0) && (
                        <div style={{
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#fca5a5',
                            fontSize: '14px',
                        }}>
                            <AlertTriangle size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                            This item has no recipe defined.<br />
                            <span style={{ fontSize: '12px', color: '#f87171' }}>
                                Please configure the recipe using the Recipe Builder first.
                            </span>
                        </div>
                    )}

                    {item.recipe && item.recipe.length > 0 && (
                        <>
                            {/* Batch multiplier */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    Number of Batches
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        onClick={() => setMultiplier(m => Math.max(1, m - 1))}
                                        style={{
                                            width: '36px', height: '36px', borderRadius: '8px',
                                            border: '1px solid rgba(148,163,184,0.2)',
                                            background: 'rgba(30,41,59,0.6)', color: '#e2e8f0',
                                            fontSize: '18px', cursor: 'pointer',
                                        }}
                                    >−</button>
                                    <input
                                        type="number" min={1}
                                        value={multiplier}
                                        onChange={e => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
                                        style={{
                                            width: '80px', textAlign: 'center', fontSize: '18px',
                                            fontWeight: 700, color: '#f1f5f9',
                                            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)',
                                            borderRadius: '8px', padding: '6px 10px',
                                        }}
                                    />
                                    <button
                                        onClick={() => setMultiplier(m => m + 1)}
                                        style={{
                                            width: '36px', height: '36px', borderRadius: '8px',
                                            border: '1px solid rgba(148,163,184,0.2)',
                                            background: 'rgba(30,41,59,0.6)', color: '#e2e8f0',
                                            fontSize: '18px', cursor: 'pointer',
                                        }}
                                    >+</button>
                                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                                        → <span style={{ color: '#10b981', fontWeight: 600 }}>+{outputAdded} {item.units?.recipeUnit}</span> will be added to stock
                                    </span>
                                </div>
                            </div>

                            {/* Ingredient preview table */}
                            <div style={{ marginBottom: '20px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                                    Ingredients to Consume
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {/* Header */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '1fr 110px 100px 90px',
                                        gap: '8px', padding: '0 12px',
                                        fontSize: '11px', fontWeight: 600, color: '#475569',
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                    }}>
                                        <span>Ingredient</span>
                                        <span style={{ textAlign: 'right' }}>Need</span>
                                        <span style={{ textAlign: 'right' }}>In Stock</span>
                                        <span style={{ textAlign: 'right', color: '#f59e0b' }}>Waste</span>
                                    </div>

                                    {preview?.map((p, i) => (
                                        <div key={i} style={{
                                            display: 'grid', gridTemplateColumns: '1fr 110px 100px 90px',
                                            gap: '8px', alignItems: 'center',
                                            background: p.hasEnough
                                                ? 'rgba(30,41,59,0.5)'
                                                : 'rgba(239,68,68,0.08)',
                                            border: `1px solid ${p.hasEnough ? 'rgba(148,163,184,0.08)' : 'rgba(239,68,68,0.2)'}`,
                                            borderRadius: '8px', padding: '10px 12px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {!p.hasEnough && <AlertTriangle size={13} color="#ef4444" />}
                                                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{p.ingredientName}</span>
                                            </div>
                                            <span style={{
                                                fontSize: '13px', fontWeight: 600, textAlign: 'right',
                                                color: p.hasEnough ? '#e2e8f0' : '#ef4444',
                                            }}>
                                                {p.totalNeeded} {p.unit}
                                            </span>
                                            <span style={{
                                                fontSize: '13px', textAlign: 'right',
                                                color: p.hasEnough ? '#94a3b8' : '#fca5a5',
                                            }}>
                                                {p.currentStock} {p.stockUnit}
                                            </span>
                                            <span style={{
                                                fontSize: '13px', textAlign: 'right',
                                                color: p.wasteQty > 0 ? '#fbbf24' : '#475569',
                                            }}>
                                                {p.wastagePercent > 0
                                                    ? `${p.wasteQty} ${p.unit}`
                                                    : '—'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Wastage cost summary */}
                            {totalWastageCost > 0 && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                                    borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
                                }}>
                                    <Flame size={16} color="#f59e0b" />
                                    <p style={{ fontSize: '13px', color: '#fcd34d', margin: 0 }}>
                                        Estimated prep wastage cost: <strong>₱{totalWastageCost.toFixed(2)}</strong> — this will be logged as a wastage record.
                                    </p>
                                </div>
                            )}

                            {/* Insufficient stock warning */}
                            {!canProduce && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
                                }}>
                                    <AlertTriangle size={16} color="#ef4444" />
                                    <p style={{ fontSize: '13px', color: '#fca5a5', margin: 0 }}>
                                        Insufficient stock for one or more ingredients. Reduce batch count or restock first.
                                    </p>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    Notes (optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="e.g. Morning production run — Batch A"
                                    style={{
                                        width: '100%', background: 'rgba(15,23,42,0.6)', color: '#e2e8f0',
                                        border: '1px solid rgba(148,163,184,0.15)', borderRadius: '8px',
                                        padding: '10px 12px', fontSize: '13px',
                                        resize: 'vertical', boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    marginTop: '12px', background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    borderRadius: '10px', padding: '12px 14px',
                                    fontSize: '13px', color: '#fca5a5',
                                }}>
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: '10px',
                    padding: '16px 24px', borderTop: '1px solid rgba(148,163,184,0.1)',
                }}>
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '10px 20px', borderRadius: '10px',
                            border: '1px solid rgba(148,163,184,0.2)',
                            background: 'transparent', color: '#94a3b8',
                            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    {item.recipe && item.recipe.length > 0 && (
                        <button
                            onClick={handleProduce}
                            disabled={!canProduce || producing}
                            style={{
                                padding: '10px 24px', borderRadius: '10px', border: 'none',
                                background: !canProduce || producing
                                    ? 'rgba(16,185,129,0.3)'
                                    : 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff', fontSize: '13px', fontWeight: 600,
                                cursor: !canProduce || producing ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}
                        >
                            <Package2 size={14} />
                            {producing ? 'Producing...' : `Produce ${multiplier}× Batch`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProduceBatchModal;
