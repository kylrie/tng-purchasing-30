/**
 * ============================================================
 * BOM Explosion Service (Shared)
 * ============================================================
 *
 * Centralised Bill-of-Materials (BOM) explosion logic used by
 * both POS Import and Event Import services.
 *
 * Previously, identical recursive explosion code was duplicated
 * in pos-import.service.ts AND event-import.service.ts (DRY violation).
 * This shared service is the single source of truth.
 *
 * SECURITY NOTE: This module performs NO Firestore reads/writes.
 * It is a pure in-memory calculation engine, which makes it safe
 * to unit-test in isolation.
 */

import type { InventoryItem } from '../../inventory/types/InventoryItem';
import type { SimulatedDeduction } from '../types/pos-import.types';
import type { EventSimulatedDeduction } from '../types/event-sales.types';

// ============================================================
// SHARED TYPES
// ============================================================

/**
 * Log entry generated when a PRODUCTION item has insufficient
 * stock and is auto-exploded into raw materials.
 */
export interface AutoProductionLog {
    productionItemId: string;
    productionItemName: string;
    shortageQty: number;
    finishedGoodName: string;
    rawMaterialsExploded: {
        itemId: string;
        itemName: string;
        qty: number;
        unit: string;
    }[];
}

// ============================================================
// SAFE NUMBER UTILITY
// ============================================================

/**
 * Safely coerce an unknown value to a finite number, returning 0
 * for NaN, Infinity, null, undefined, or non-numeric types.
 */
export const safeNum = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

// ============================================================
// COMMIT-TIME BOM EXPLOSION
// ============================================================

/**
 * Recursively explode a recipe item into raw material deductions.
 *
 * This is the WRITE-PATH version used during commitImport.
 * It aggregates deduction quantities into `rmDeductionMap` and
 * tracks auto-production fallbacks.
 *
 * @param item           The inventory item whose recipe to explode
 * @param multiplier     How many units of `item` are being consumed
 * @param rootFgName     Display name of the originating Finished Good (for audit notes)
 * @param allItemsMap    Full inventory lookup map
 * @param prodRunningStock  Running stock tracker for PRODUCTION items
 * @param rmDeductionMap Accumulated raw material deductions
 * @param autoProductionLogs  Collects auto-explode fallback alerts
 */
export function recursiveExplosion(
    item: InventoryItem & { id: string },
    multiplier: number,
    rootFgName: string,
    allItemsMap: Map<string, InventoryItem & { id: string }>,
    prodRunningStock: Map<string, number>,
    rmDeductionMap: Map<string, { totalQty: number; fgName: string }>,
    autoProductionLogs: AutoProductionLog[]
): void {
    if (!item.recipe || item.recipe.length === 0) return;

    for (const ingredient of item.recipe) {
        const iItem = allItemsMap.get(ingredient.ingredientId);
        if (!iItem) continue;

        const ded = ingredient.quantityUsed * multiplier;

        if (iItem.type === 'RAW_MATERIAL' || iItem.type === 'FINISHED_GOOD') {
            // Accumulate raw material deduction
            const prev = rmDeductionMap.get(ingredient.ingredientId);
            rmDeductionMap.set(ingredient.ingredientId, {
                totalQty: (prev?.totalQty ?? 0) + ded,
                fgName: prev?.fgName ?? rootFgName,
            });
        } else if (iItem.type === 'PRODUCTION') {
            // ── AUTO-EXPLODE FALLBACK ──
            // Check if we have enough prepped stock to fulfill the demand
            const currentPrepStock = prodRunningStock.get(iItem.id) ?? 0;
            const availablePrep = Math.max(0, currentPrepStock);
            const deductedFromPrep = Math.min(availablePrep, ded);
            const shortfall = ded - deductedFromPrep;

            if (deductedFromPrep > 0) {
                // Deduct from existing prep stock
                prodRunningStock.set(iItem.id, currentPrepStock - deductedFromPrep);
                const prev = rmDeductionMap.get(ingredient.ingredientId);
                rmDeductionMap.set(ingredient.ingredientId, {
                    totalQty: (prev?.totalQty ?? 0) + deductedFromPrep,
                    fgName: prev?.fgName ?? rootFgName,
                });
            }

            if (shortfall > 0) {
                // Not enough prep — auto-explode shortfall into raw materials
                if (deductedFromPrep === 0) {
                    prodRunningStock.set(iItem.id, currentPrepStock); // unchanged
                }

                const explodedRMs: AutoProductionLog['rawMaterialsExploded'] = [];

                if (iItem.recipe && iItem.recipe.length > 0) {
                    for (const subIng of iItem.recipe) {
                        const subItem = allItemsMap.get(subIng.ingredientId);
                        if (!subItem) continue;

                        const explodedQty = subIng.quantityUsed * shortfall;
                        const prev = rmDeductionMap.get(subIng.ingredientId);
                        rmDeductionMap.set(subIng.ingredientId, {
                            totalQty: (prev?.totalQty ?? 0) + explodedQty,
                            fgName: prev?.fgName ?? `${rootFgName} (auto-produced ${iItem.name})`,
                        });

                        explodedRMs.push({
                            itemId: subItem.id,
                            itemName: subItem.name,
                            qty: explodedQty,
                            unit: subIng.unit || subItem.units?.recipeUnit || '',
                        });
                    }
                }

                // Queue the unrecorded production log
                autoProductionLogs.push({
                    productionItemId: iItem.id,
                    productionItemName: iItem.name,
                    shortageQty: shortfall,
                    finishedGoodName: rootFgName,
                    rawMaterialsExploded: explodedRMs,
                });
            }
        }
    }
}

// ============================================================
// SIMULATION-TIME BOM EXPLOSION (DRY RUN / PREVIEW)
// ============================================================

/**
 * Recursively simulate BOM explosion for the dry-run preview modal.
 *
 * Unlike `recursiveExplosion`, this produces individual SimulatedDeduction
 * rows (one per ingredient) with running stock calculations, so the UI
 * can render a line-by-line preview.
 *
 * @param item             The recipe item to explode
 * @param multiplier       Units consumed
 * @param parentItemId     ID of the parent FG or PRODUCTION item
 * @param parentItemName   Display name of the parent
 * @param allItemsMap      Full inventory lookup map
 * @param runningStock     Shared running stock tracker across all rows
 * @param simulatedDeductions  Output array to append preview rows to
 */
export function simulateRecursiveBOM(
    item: InventoryItem & { id: string },
    multiplier: number,
    parentItemId: string,
    parentItemName: string,
    allItemsMap: Map<string, InventoryItem & { id: string }>,
    runningStock: Map<string, number>,
    simulatedDeductions: SimulatedDeduction[]
): void {
    if (!item.recipe || item.recipe.length === 0) return;

    for (const ingredient of item.recipe) {
        const ingredientItem = allItemsMap.get(ingredient.ingredientId);
        if (!ingredientItem) continue;

        const totalDeduction = ingredient.quantityUsed * multiplier;
        const currentStock = runningStock.has(ingredientItem.id)
            ? runningStock.get(ingredientItem.id)!
            : safeNum(ingredientItem.theoreticalStock) || safeNum(ingredientItem.currentStock);

        if (ingredientItem.type === 'RAW_MATERIAL' || ingredientItem.type === 'FINISHED_GOOD') {
            // Direct deduction — allow negative stock
            const newStock = currentStock - totalDeduction;
            runningStock.set(ingredientItem.id, newStock);

            simulatedDeductions.push({
                itemId: ingredientItem.id,
                itemName: ingredientItem.name,
                type: ingredientItem.type === 'FINISHED_GOOD' ? 'FG_DIRECT' : 'RM',
                currentTheoreticalStock: currentStock,
                deductionAmount: totalDeduction,
                newTheoreticalStock: newStock,
                parentItemId,
                parentItemName,
            });
        } else if (ingredientItem.type === 'PRODUCTION') {
            // ── AUTO-EXPLODE FALLBACK (SIMULATION) ──
            const availablePrep = Math.max(0, currentStock);
            const deductedFromPrep = Math.min(availablePrep, totalDeduction);
            const shortfall = totalDeduction - deductedFromPrep;

            if (deductedFromPrep > 0) {
                const newPrepStock = currentStock - deductedFromPrep;
                runningStock.set(ingredientItem.id, newPrepStock);

                simulatedDeductions.push({
                    itemId: ingredientItem.id,
                    itemName: ingredientItem.name,
                    type: 'PRODUCTION',
                    currentTheoreticalStock: currentStock,
                    deductionAmount: deductedFromPrep,
                    newTheoreticalStock: newPrepStock,
                    parentItemId,
                    parentItemName,
                });
            }

            if (shortfall > 0) {
                if (deductedFromPrep === 0) {
                    // Zero stock — show the prep item with 0 deduction + alert
                    simulatedDeductions.push({
                        itemId: ingredientItem.id,
                        itemName: ingredientItem.name,
                        type: 'PRODUCTION',
                        currentTheoreticalStock: currentStock,
                        deductionAmount: 0,
                        newTheoreticalStock: currentStock,
                        parentItemId,
                        parentItemName,
                        alert: `⚠️ No production stock available. ${shortfall} units auto-exploded to raw materials below.`,
                    });
                } else {
                    // Partial stock — update the existing deduction's alert
                    const lastDed = simulatedDeductions[simulatedDeductions.length - 1];
                    lastDed.alert = `⚠️ Only ${deductedFromPrep} of ${totalDeduction} available. ${shortfall} units auto-exploded to raw materials below.`;
                }

                // Recurse into the production item's recipe for the shortfall quantity
                if (ingredientItem.recipe && ingredientItem.recipe.length > 0) {
                    for (const subIng of ingredientItem.recipe) {
                        const subItem = allItemsMap.get(subIng.ingredientId);
                        if (!subItem) continue;

                        const explodedQty = subIng.quantityUsed * shortfall;
                        const subCurrentStock = runningStock.has(subItem.id)
                            ? runningStock.get(subItem.id)!
                            : safeNum(subItem.theoreticalStock) || safeNum(subItem.currentStock);
                        const subNewStock = subCurrentStock - explodedQty;
                        runningStock.set(subItem.id, subNewStock);

                        simulatedDeductions.push({
                            itemId: subItem.id,
                            itemName: subItem.name,
                            type: 'RM',
                            currentTheoreticalStock: subCurrentStock,
                            deductionAmount: explodedQty,
                            newTheoreticalStock: subNewStock,
                            parentItemId,
                            parentItemName,
                            alert: `Auto-produced from ${ingredientItem.name} — no production record found`,
                        });
                    }
                }
            }
        }
    }
}

// ============================================================
// EVENT SIMULATION BOM EXPLOSION
// ============================================================

/**
 * Event-specific simulation variant that adds the `eventName` field
 * to each deduction row. Delegates to the same auto-explode fallback
 * logic as the POS simulation.
 */
export function simulateRecursiveBOMForEvent(
    item: InventoryItem & { id: string },
    multiplier: number,
    parentItemId: string,
    parentItemName: string,
    eventName: string,
    allItemsMap: Map<string, InventoryItem & { id: string }>,
    runningStock: Map<string, number>,
    deductions: EventSimulatedDeduction[]
): void {
    if (!item.recipe || item.recipe.length === 0) return;

    for (const ingredient of item.recipe) {
        const iItem = allItemsMap.get(ingredient.ingredientId);
        if (!iItem) continue;

        const totalDed = ingredient.quantityUsed * multiplier;
        const currentStock = runningStock.get(iItem.id)
            ?? (safeNum(iItem.theoreticalStock) || safeNum(iItem.currentStock));

        if (iItem.type === 'RAW_MATERIAL' || iItem.type === 'FINISHED_GOOD') {
            const newStock = currentStock - totalDed;
            runningStock.set(iItem.id, newStock);
            deductions.push({
                itemId: iItem.id,
                itemName: iItem.name,
                type: iItem.type === 'FINISHED_GOOD' ? 'FG_DIRECT' : 'RM',
                currentTheoreticalStock: currentStock,
                deductionAmount: totalDed,
                newTheoreticalStock: newStock,
                parentItemId,
                parentItemName,
                eventName,
            });
        } else if (iItem.type === 'PRODUCTION') {
            // ── AUTO-EXPLODE FALLBACK ──
            const availablePrep = Math.max(0, currentStock);
            const deductedFromPrep = Math.min(availablePrep, totalDed);
            const shortfall = totalDed - deductedFromPrep;

            if (deductedFromPrep > 0) {
                const newPrepStock = currentStock - deductedFromPrep;
                runningStock.set(iItem.id, newPrepStock);
                deductions.push({
                    itemId: iItem.id,
                    itemName: iItem.name,
                    type: 'PRODUCTION',
                    currentTheoreticalStock: currentStock,
                    deductionAmount: deductedFromPrep,
                    newTheoreticalStock: newPrepStock,
                    parentItemId,
                    parentItemName,
                    eventName,
                });
            }

            if (shortfall > 0) {
                if (deductedFromPrep === 0) {
                    deductions.push({
                        itemId: iItem.id,
                        itemName: iItem.name,
                        type: 'PRODUCTION',
                        currentTheoreticalStock: currentStock,
                        deductionAmount: 0,
                        newTheoreticalStock: currentStock,
                        parentItemId,
                        parentItemName,
                        eventName,
                        alert: `⚠️ No production stock available. ${shortfall} units auto-exploded to raw materials below.`,
                    });
                } else {
                    const lastDed = deductions[deductions.length - 1];
                    lastDed.alert = `⚠️ Only ${deductedFromPrep} of ${totalDed} available. ${shortfall} units auto-exploded to raw materials below.`;
                }

                if (iItem.recipe && iItem.recipe.length > 0) {
                    for (const subIng of iItem.recipe) {
                        const subItem = allItemsMap.get(subIng.ingredientId);
                        if (!subItem) continue;

                        const explodedQty = subIng.quantityUsed * shortfall;
                        const subCurrentStock = runningStock.get(subItem.id)
                            ?? (safeNum(subItem.theoreticalStock) || safeNum(subItem.currentStock));
                        const subNewStock = subCurrentStock - explodedQty;
                        runningStock.set(subItem.id, subNewStock);

                        deductions.push({
                            itemId: subItem.id,
                            itemName: subItem.name,
                            type: 'RM',
                            currentTheoreticalStock: subCurrentStock,
                            deductionAmount: explodedQty,
                            newTheoreticalStock: subNewStock,
                            parentItemId,
                            parentItemName,
                            eventName,
                            alert: `Auto-produced from ${iItem.name} — no production record found`,
                        });
                    }
                }
            }
        }
    }
}
