import { FirestoreService, where, Timestamp } from '../../../shared/services/firestore.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import type { InventoryItem, BomIngredient } from '../../inventory/types/InventoryItem';
import type {
    MenuItem,
    RecipeIngredient,
    CreateMenuItemInput,
    RecipeIngredientInput
} from '../types/menu.types';
import { UNIT_CONVERSIONS } from '../types/menu.types';
import { UOM_CONVERSIONS, UOM_CATEGORY_MAP } from '../../../shared/constants/uom.constants';
import {
    collection, doc, writeBatch, getDocs
} from 'firebase/firestore';
import { db } from '../../../config/firebase';

// Collection names
const COLLECTION = 'menu_items';
const INVENTORY_COLLECTION = 'inventory_items';

// ============================================================
// UNIT CONVERSION UTILITIES
// ============================================================

/**
 * Convert quantity from one unit to another
 * Returns the quantity in the target unit
 */
export function convertUnits(
    quantity: number,
    fromUnit: string | undefined | null,
    toUnit: string | undefined | null
): number {
    // If either unit is missing, or they are exactly the same, no conversion is possible/needed
    if (!fromUnit || !toUnit || fromUnit.toUpperCase() === toUnit.toUpperCase()) {
        return quantity;
    }

    const fromLower = fromUnit.toLowerCase();
    const toLower   = toUnit.toLowerCase();
    const fromUpper = fromUnit.toUpperCase();
    const toUpper   = toUnit.toUpperCase();

    // ── 1. New hardcoded UOM_CONVERSIONS (uppercase) ──────────
    if (UOM_CONVERSIONS[fromUpper]?.[toUpper]) {
        return quantity * UOM_CONVERSIONS[fromUpper][toUpper];
    }
    if (UOM_CONVERSIONS[toUpper]?.[fromUpper]) {
        return quantity / UOM_CONVERSIONS[toUpper][fromUpper];
    }
    // Via intermediate unit in UOM_CONVERSIONS
    const uomBridge = Object.keys(UOM_CONVERSIONS[fromUpper] ?? {}).find(
        mid => UOM_CONVERSIONS[mid]?.[toUpper]
    );
    if (uomBridge) {
        const toMid   = quantity * UOM_CONVERSIONS[fromUpper][uomBridge];
        return toMid * UOM_CONVERSIONS[uomBridge][toUpper];
    }

    // ── 2. Legacy UNIT_CONVERSIONS (lowercase) ────────────────
    if (UNIT_CONVERSIONS[fromLower]?.[toLower]) {
        return quantity * UNIT_CONVERSIONS[fromLower][toLower];
    }
    if (UNIT_CONVERSIONS[toLower]?.[fromLower]) {
        return quantity / UNIT_CONVERSIONS[toLower][fromLower];
    }
    // Via ml
    if (UNIT_CONVERSIONS[fromLower]?.['ml'] && UNIT_CONVERSIONS['ml']?.[toLower]) {
        const inMl = quantity * UNIT_CONVERSIONS[fromLower]['ml'];
        return inMl * UNIT_CONVERSIONS['ml'][toLower];
    }
    // Via g
    if (UNIT_CONVERSIONS[fromLower]?.['g'] && UNIT_CONVERSIONS['g']?.[toLower]) {
        const inG = quantity * UNIT_CONVERSIONS[fromLower]['g'];
        return inG * UNIT_CONVERSIONS['g'][toLower];
    }

    // No conversion found — only warn for same-category misses (real gaps).
    // Cross-category conversions (e.g. EA→L, G→L) are expected and 1:1 is by design.
    const fromCat = UOM_CATEGORY_MAP[fromUpper];
    const toCat   = UOM_CATEGORY_MAP[toUpper];
    if (fromCat && toCat && fromCat === toCat) {
        console.warn(`No conversion found from ${fromUnit} to ${toUnit} (both are ${fromCat})`);
    }
    return quantity;
}


/**
 * Get available recipe units for an inventory item's base unit.
 * Uses the canonical UOM_CONVERSIONS table (uppercase keys).
 */
export function getAvailableUnits(baseUnit: string | undefined | null): string[] {
    if (!baseUnit) return ['EA'];
    const baseUpper = baseUnit.toUpperCase();
    const available = new Set<string>([baseUpper]);

    // Add all units this base can convert TO (via UOM_CONVERSIONS)
    if (UOM_CONVERSIONS[baseUpper]) {
        Object.keys(UOM_CONVERSIONS[baseUpper]).forEach(unit => available.add(unit));
    }

    // Add all units that can convert TO this base
    Object.entries(UOM_CONVERSIONS).forEach(([unit, conversions]) => {
        if (conversions[baseUpper]) {
            available.add(unit);
        }
    });

    return Array.from(available);
}

// ============================================================
// COST CALCULATION
// ============================================================

/**
 * Calculate the cost of a single ingredient
 */
export function calculateIngredientCost(
    quantity: number,
    recipeUnit: string,
    inventoryItem: InventoryItem
): { baseQuantity: number; totalCost: number } {
    // Convert recipe quantity to inventory base unit
    const baseQuantity = convertUnits(quantity, recipeUnit, inventoryItem.units.recipeUnit);

    // Use baseCost (cost per base/recipe unit) if available.
    // If baseCost is missing (legacy items), derive it from buyCost/conversion.
    // NEVER use costPerUnit directly — it may be the buy-unit cost on legacy records.
    const costPerBaseUnit = inventoryItem.baseCost
        ?? (inventoryItem.buyCost != null && inventoryItem.units?.conversion > 0
            ? inventoryItem.buyCost / inventoryItem.units.conversion
            : inventoryItem.costPerUnit ?? 0);

    // Calculate cost
    const totalCost = baseQuantity * costPerBaseUnit;

    return { baseQuantity, totalCost };
}

// ============================================================
// BOM SYNC HELPER
// ============================================================

/**
 * Convert Menu Engineering RecipeIngredient[] → InventoryItem BomIngredient[]
 * This is the bridge that ensures POS BOM explosion has the right data.
 */
function convertToBomIngredients(
    ingredients: RecipeIngredient[],
    inventoryItems: InventoryItem[]
): BomIngredient[] {
    const itemMap = new Map(inventoryItems.map(i => [i.id, i]));

    return ingredients
        .filter(ri => {
            const inv = itemMap.get(ri.inventoryItemId);
            return inv && (inv.type === 'RAW_MATERIAL' || inv.type === 'PRODUCTION');
        })
        .map(ri => {
            const inv = itemMap.get(ri.inventoryItemId)!;
            return {
                ingredientId: ri.inventoryItemId,
                ingredientName: ri.inventoryItemName,
                quantityUsed: ri.baseQuantity,        // Already in base unit
                unit: inv.units.recipeUnit,              // Base unit from inventory
            };
        });
}

/**
 * Calculate total recipe cost from ingredients
 */
export async function calculateRecipeCost(
    ingredients: RecipeIngredientInput[],
    businessUnitId: string
): Promise<{ ingredients: RecipeIngredient[]; totalCost: number }> {
    // Fetch all inventory items for the business
    const inventoryItems = await InventoryService.getInventory(businessUnitId);
    const itemMap = new Map(inventoryItems.map(item => [item.id, item]));

    let totalCost = 0;
    const calculatedIngredients: RecipeIngredient[] = [];

    for (const input of ingredients) {
        const inventoryItem = itemMap.get(input.inventoryItemId);

        if (!inventoryItem) {
            console.warn(`Inventory item ${input.inventoryItemId} not found`);
            continue;
        }

        const { baseQuantity, totalCost: ingredientCost } = calculateIngredientCost(
            input.quantity,
            input.unit,
            inventoryItem
        );

        calculatedIngredients.push({
            inventoryItemId: input.inventoryItemId,
            inventoryItemName: inventoryItem.name,
            quantity: input.quantity,
            unit: input.unit,
            baseQuantity,
            // Stamp the correct per-base-unit cost (not the buy-unit cost)
            // Fallback chain: baseCost → costPerUnit → 0 (never undefined)
            costPerBaseUnit: inventoryItem.baseCost ?? inventoryItem.costPerUnit ?? 0,
            totalCost: ingredientCost
        });

        totalCost += ingredientCost;
    }

    return { ingredients: calculatedIngredients, totalCost };
}

/**
 * Calculate margins for a menu item
 */
export function calculateMargins(
    sellingPrice: number,
    calculatedCost: number
): { grossMargin: number; marginPercent: number; foodCostPercent: number } {
    const grossMargin = sellingPrice - calculatedCost;
    const marginPercent = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;
    const foodCostPercent = sellingPrice > 0 ? (calculatedCost / sellingPrice) * 100 : 0;

    return {
        grossMargin: Math.round(grossMargin * 100) / 100,
        marginPercent: Math.round(marginPercent * 10) / 10,
        foodCostPercent: Math.round(foodCostPercent * 10) / 10
    };
}

// ============================================================
// FIRESTORE SAFETY HELPER
// ============================================================

/**
 * Recursively removes `undefined` values from an object before writing to Firestore.
 * Firestore throws "Unsupported field value: undefined" if any field is undefined.
 */
function sanitizeDoc<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue; // Drop undefined fields
        if (Array.isArray(value)) {
            result[key] = value.map(item =>
                item !== null && typeof item === 'object' ? sanitizeDoc(item as Record<string, unknown>) : item
            );
        } else if (value !== null && typeof value === 'object' && !(value as any).toMillis) {
            // Recurse into plain objects (skip Timestamps which have toMillis)
            result[key] = sanitizeDoc(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }
    return result as T;
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

/**
 * Get all menu items for a business unit
 */
export async function getMenuItems(businessUnitId: string): Promise<MenuItem[]> {
    try {
        const items = await FirestoreService.getDocuments<MenuItem>(
            COLLECTION,
            [where('businessUnitId', '==', businessUnitId)]
        );

        return items
            .filter(item => item.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error fetching menu items:', error);
        return [];
    }
}

/**
 * Get a single menu item by ID
 */
export async function getMenuItem(id: string): Promise<MenuItem | null> {
    try {
        return await FirestoreService.getDocument<MenuItem>(COLLECTION, id);
    } catch (error) {
        console.error('Error fetching menu item:', error);
        return null;
    }
}

/**
 * Create a new menu item with calculated costs
 * Also creates a linked FINISHED_GOOD inventory item
 * Uses Firestore batch write to atomically sync the BOM recipe to the InventoryItem
 */
export async function createMenuItem(input: CreateMenuItemInput): Promise<string> {
    // Calculate costs
    const { ingredients, totalCost } = await calculateRecipeCost(
        input.ingredients.map(i => ({
            inventoryItemId: i.inventoryItemId,
            quantity: i.quantity,
            unit: i.unit
        })),
        input.businessUnitId
    );

    const margins = calculateMargins(input.sellingPrice, totalCost);

    // Fetch all inventory items so we can build the BOM
    const allInventoryItems = await InventoryService.getInventory(input.businessUnitId);
    const bomRecipe = convertToBomIngredients(ingredients, allInventoryItems);

    const now = Timestamp.now();

    // ================================================================
    // ATOMIC BATCH WRITE: MenuItem + linked FG InventoryItem + recipe
    // ================================================================
    const batch = writeBatch(db);

    // 1. Create the menu item doc
    const menuDocRef = doc(collection(db, COLLECTION));
    const menuItemId = menuDocRef.id;
    batch.set(menuDocRef, sanitizeDoc({
        businessUnitId: input.businessUnitId,
        name: input.name,
        category: input.category,
        ...(input.serviceType && { serviceType: input.serviceType }),
        description: input.description || '',
        sellingPrice: input.sellingPrice,
        ingredients,
        calculatedCost: totalCost,
        ...margins,
        imageUrl: input.imageUrl || '',
        isActive: true,
        createdAt: now,
        updatedAt: now,
    } as Record<string, unknown>));

    // 2. Create the linked FINISHED_GOOD inventory item doc
    const fgDocRef = doc(collection(db, INVENTORY_COLLECTION));
    const finishedGoodId = fgDocRef.id;
    batch.set(fgDocRef, sanitizeDoc({
        businessUnitId: input.businessUnitId,
        name: input.name,
        type: 'FINISHED_GOOD',
        category: 'Food',
        storageAreas: [],
        units: { recipeUnit: 'serving', buyUnit: 'serving', conversion: 1 },
        parLevel: 0,
        currentStock: 0,
        theoreticalStock: 0,
        costPerUnit: totalCost,
        menuItemId: menuItemId,
        recipe: bomRecipe,                      // ← BOM synced atomically
        notes: `Auto-created from Menu Engineering: ${input.name}`,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    } as Record<string, unknown>));

    // 3. Link the FG ID back to the menu item
    batch.update(menuDocRef, { linkedInventoryItemId: finishedGoodId });

    // Commit atomically — if any op fails, they all fail
    await batch.commit();

    console.log(`[RecipesService] Created MenuItem ${menuItemId} with linked FG ${finishedGoodId} (${bomRecipe.length} BOM ingredients synced)`);

    return menuItemId;
}

/**
 * Update an existing menu item
 * Uses Firestore batch write to atomically sync BOM recipe to the linked InventoryItem
 */
export async function updateMenuItem(
    id: string,
    input: Partial<CreateMenuItemInput>
): Promise<void> {
    const existing = await getMenuItem(id);
    if (!existing) {
        throw new Error('Menu item not found');
    }

    let updateData: Partial<MenuItem> = {};
    let ingredientsChanged = false;

    // If ingredients changed, recalculate costs
    if (input.ingredients) {
        const { ingredients, totalCost } = await calculateRecipeCost(
            input.ingredients.map(i => ({
                inventoryItemId: i.inventoryItemId,
                quantity: i.quantity,
                unit: i.unit
            })),
            existing.businessUnitId
        );

        const sellingPrice = input.sellingPrice ?? existing.sellingPrice;
        const margins = calculateMargins(sellingPrice, totalCost);

        updateData = {
            ...updateData,
            ingredients,
            calculatedCost: totalCost,
            sellingPrice,
            ...margins
        };

        ingredientsChanged = true;
    }

    // If price changed but not ingredients, recalculate margins
    if (input.sellingPrice !== undefined && !input.ingredients) {
        const margins = calculateMargins(input.sellingPrice, existing.calculatedCost);
        updateData = {
            ...updateData,
            sellingPrice: input.sellingPrice,
            ...margins
        };
    }

    // Copy other fields
    if (input.name) updateData.name = input.name;
    if (input.category) updateData.category = input.category;
    if (input.serviceType !== undefined) (updateData as any).serviceType = input.serviceType;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;

    // ================================================================
    // ATOMIC BATCH WRITE: MenuItem update + InventoryItem recipe sync
    // ================================================================
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // 1. Update the MenuItem doc
    const menuRef = doc(db, COLLECTION, id);
    batch.update(menuRef, { ...updateData, updatedAt: now });

    // 2. Sync to linked InventoryItem if it exists
    const currentItem = { ...existing, ...updateData };
    if (currentItem.linkedInventoryItemId) {
        const invRef = doc(db, INVENTORY_COLLECTION, currentItem.linkedInventoryItemId);
        const invUpdateData: Record<string, unknown> = {
            name: currentItem.name,
            costPerUnit: currentItem.calculatedCost,
            updatedAt: now,
        };

        // If ingredients changed, rebuild and sync the BOM recipe
        if (ingredientsChanged && updateData.ingredients) {
            const allInventoryItems = await InventoryService.getInventory(existing.businessUnitId);
            const bomRecipe = convertToBomIngredients(updateData.ingredients, allInventoryItems);
            invUpdateData.recipe = bomRecipe;
            console.log(`[RecipesService] Syncing ${bomRecipe.length} BOM ingredients to FG ${currentItem.linkedInventoryItemId}`);
        }

        batch.update(invRef, invUpdateData);
    }

    // Commit atomically
    await batch.commit();

    console.log(`[RecipesService] Atomically updated MenuItem ${id}${currentItem.linkedInventoryItemId ? ` + FG ${currentItem.linkedInventoryItemId}` : ''
        }`);
}

// ============================================================
// DATA MIGRATION
// ============================================================

/**
 * One-time migration to sync all existing MenuItem ingredients to InventoryItem recipes
 * Resolves the "single source of truth" gap for legacy records created before the sync was added.
 */
export async function migrateExistingRecipes(businessUnitId: string): Promise<string> {
    console.log(`[RecipesService] Starting recipe migration for BU: ${businessUnitId}`);

    // 1. Fetch all menu items for the BU
    const menuSnapshot = await getDocs(collection(db, COLLECTION));
    const menuItems = menuSnapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as MenuItem & { id: string })
        .filter((m: MenuItem & { id: string }) => m.businessUnitId === businessUnitId);

    // 2. Fetch all inventory items (we need this to format BomIngredient units)
    const inventoryItems = await InventoryService.getInventory(businessUnitId);
    const invMap = new Map(inventoryItems.map(i => [i.id, i]));

    // 3. Prepare Batch
    const batch = writeBatch(db);
    let count = 0;

    for (const menu of menuItems) {
        if (!menu.linkedInventoryItemId || !menu.ingredients || menu.ingredients.length === 0) {
            continue;
        }

        // Ensure the linked inventory item exists and is a FINISHED_GOOD
        const linkedInv = invMap.get(menu.linkedInventoryItemId);
        if (!linkedInv || linkedInv.type !== 'FINISHED_GOOD') {
            continue;
        }

        // Convert recipe
        const bomRecipe = convertToBomIngredients(menu.ingredients, inventoryItems);

        if (bomRecipe.length > 0) {
            const invRef = doc(db, INVENTORY_COLLECTION, linkedInv.id);
            batch.update(invRef, { recipe: bomRecipe });
            count++;
            console.log(`[Migration] Queued update for FG ${linkedInv.name} (${bomRecipe.length} ingredients)`);
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`[Migration] Successfully synced ${count} recipes to inventory!`);
        return `Successfully synced ${count} recipes!`;
    } else {
        console.log('[Migration] No legacy recipes needed migration.');
        return 'No recipes needed syncing. All up to date.';
    }
}

/**
 * Delete (deactivate) a menu item
 */
export async function deleteMenuItem(id: string): Promise<void> {
    await FirestoreService.updateDocument(COLLECTION, id, { isActive: false });
}

/**
 * Recalculate costs for all menu items (useful when inventory prices change)
 *
 * OPTIMIZED: Fetches inventory ONCE, computes all costs in-memory,
 * then commits all updates in a single Firestore batch.
 */
export async function recalculateAllCosts(businessUnitId: string): Promise<number> {
    const menuItems = await getMenuItems(businessUnitId);
    if (menuItems.length === 0) return 0;

    // ── Single fetch: build an O(1) lookup map ──────────────────
    const inventoryItems = await InventoryService.getInventory(businessUnitId);
    const itemMap = new Map(inventoryItems.map(item => [item.id, item]));

    // ── Compute new costs in-memory for every menu item ─────────
    const updates: Array<{
        menuItemId: string;
        ingredients: RecipeIngredient[];
        totalCost: number;
        margins: ReturnType<typeof calculateMargins>;
        linkedInventoryItemId?: string;
    }> = [];

    for (const item of menuItems) {
        try {
            let totalCost = 0;
            const calculatedIngredients: RecipeIngredient[] = [];

            for (const ing of item.ingredients) {
                const inventoryItem = itemMap.get(ing.inventoryItemId);
                if (!inventoryItem) {
                    // Keep existing ingredient data if item not found
                    calculatedIngredients.push(ing);
                    totalCost += ing.totalCost;
                    continue;
                }

                const { baseQuantity, totalCost: ingredientCost } = calculateIngredientCost(
                    ing.quantity,
                    ing.unit,
                    inventoryItem
                );

                calculatedIngredients.push({
                    inventoryItemId: ing.inventoryItemId,
                    inventoryItemName: inventoryItem.name,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    baseQuantity,
                    costPerBaseUnit: inventoryItem.baseCost ?? inventoryItem.costPerUnit ?? 0,
                    totalCost: ingredientCost,
                });

                totalCost += ingredientCost;
            }

            const margins = calculateMargins(item.sellingPrice, totalCost);

            updates.push({
                menuItemId: item.id,
                ingredients: calculatedIngredients,
                totalCost,
                margins,
                linkedInventoryItemId: item.linkedInventoryItemId,
            });
        } catch (error) {
            console.error(`Error recalculating costs for ${item.name}:`, error);
        }
    }

    // ── Batch write: menu items + linked inventory items ────────
    const BATCH_LIMIT = 450;
    const now = Timestamp.now();
    let updated = 0;

    for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
        const chunk = updates.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);

        for (const u of chunk) {
            // Update the menu item doc
            const menuRef = doc(db, COLLECTION, u.menuItemId);
            batch.update(menuRef, {
                ingredients: u.ingredients,
                calculatedCost: u.totalCost,
                ...u.margins,
                updatedAt: now,
            });

            // Update the linked inventory item (if any)
            if (u.linkedInventoryItemId) {
                const invRef = doc(db, INVENTORY_COLLECTION, u.linkedInventoryItemId);
                batch.update(invRef, {
                    costPerUnit: u.totalCost,
                    updatedAt: now,
                });
            }

            updated++;
        }

        await batch.commit();
    }

    console.log(`[RecipesService] Batch-recalculated ${updated} menu items for BU ${businessUnitId}`);
    return updated;
}

// Export as a service object for consistency
export const RecipesService = {
    getMenuItems,
    getMenuItem,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    calculateRecipeCost,
    calculateMargins,
    recalculateAllCosts,
    migrateExistingRecipes,
    convertUnits,
    getAvailableUnits
};

export default RecipesService;
