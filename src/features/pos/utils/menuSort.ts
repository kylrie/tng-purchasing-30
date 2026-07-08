// POS menu ordering — available items first (Phase 4).
//
// Operationally, out-of-stock items must never push sellable items down the grid.
// These helpers are PURE and deterministic so they are unit-testable and never
// reorder products on every render.

/**
 * True when a menu item is currently out of stock, per the sellable-stock map.
 * Matches ProductGrid's rule EXACTLY: an item is out of stock ONLY when it has a
 * KNOWN sellable quantity that is <= 0. Items with no entry in the map (e.g. no
 * linked inventory → unlimited) are treated as available.
 */
export function isOutOfStock(itemId: string, sellableStockMap?: Map<string, number>): boolean {
    if (!sellableStockMap) return false;
    const stock = sellableStockMap.get(itemId);
    return stock !== undefined && stock <= 0;
}

/**
 * Stable partition: available items first (preserving their existing relative
 * order), out-of-stock items last (also preserving their relative order).
 *
 * Deterministic by construction — it NEVER reorders within a group, so whatever
 * ordering the caller already applied (category order, configured sort, or
 * alphabetical) is preserved inside each of the two groups. Returns a NEW array;
 * the input is not mutated.
 */
export function sortByAvailability<T extends { id: string }>(
    items: T[],
    sellableStockMap?: Map<string, number>,
): T[] {
    const available: T[] = [];
    const unavailable: T[] = [];
    for (const item of items) {
        if (isOutOfStock(item.id, sellableStockMap)) unavailable.push(item);
        else available.push(item);
    }
    return [...available, ...unavailable];
}
