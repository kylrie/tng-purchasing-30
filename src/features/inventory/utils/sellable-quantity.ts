import type { InventoryItem } from '../types/InventoryItem';

// ============================================================
// SELLABLE QUANTITY CALCULATOR
// Determines the maximum number of Finished Goods that can be
// produced/sold based on the current raw material stock.
// ============================================================

/**
 * Calculate the maximum sellable quantity for a Finished Good
 * based on its recipe (BOM) and available raw material stock.
 *
 * @param item - The Finished Good inventory item
 * @param allItemsMap - Map of ALL inventory items by ID (includes RAW_MATERIAL + PRODUCTION)
 * @returns The maximum number of units that can be sold (floored to integer)
 *
 * Logic:
 *   - For each ingredient in the recipe, compute: floor(ingredient.theoreticalStock / quantityUsed)
 *   - Return the MINIMUM across all ingredients (bottleneck ingredient)
 *   - If recipe is empty/missing, fall back to the item's own theoreticalStock
 */
export function calculateSellableQuantity(
    item: InventoryItem,
    allItemsMap: Map<string, InventoryItem>
): number {
    // No recipe → use the item's own theoretical stock (bought-and-sold as-is)
    if (!item.recipe || item.recipe.length === 0) {
        return Math.floor(item.theoreticalStock ?? item.currentStock ?? 0);
    }

    let minYield = Infinity;

    for (const ingredient of item.recipe) {
        const rawMaterial = allItemsMap.get(ingredient.ingredientId);

        if (!rawMaterial) {
            // Ingredient not found in inventory → can't make any
            return 0;
        }

        const availableStock = rawMaterial.theoreticalStock ?? rawMaterial.currentStock ?? 0;
        const possibleUnits = ingredient.quantityUsed > 0
            ? Math.floor(availableStock / ingredient.quantityUsed)
            : Infinity;

        minYield = Math.min(minYield, possibleUnits);
    }

    return minYield === Infinity ? 0 : Math.max(0, minYield);
}
