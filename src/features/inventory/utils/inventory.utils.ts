import type { InventoryItem } from '../types/InventoryItem';

/**
 * Resolve the correct cost-per-unit for an inventory item.
 *
 * The system has three cost fields with different origins:
 *   - `baseCost`    — Cost per Base/Recipe Unit (updated by Goods Receiving, used by BOM explosion)
 *   - `costPerUnit` — Legacy cost per recipeUnit (kept for backward compatibility)
 *   - `buyCost`     — Cost per Buy Unit (e.g. per case) — not relevant for per-unit calcs
 *
 * `baseCost` takes precedence when available; fall back to `costPerUnit`.
 */
export function resolveItemCostPerUnit(
    item: Pick<InventoryItem, 'baseCost' | 'costPerUnit'>
): number {
    return item.baseCost ?? item.costPerUnit ?? 0;
}
