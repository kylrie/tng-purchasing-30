import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import type {
    MenuItem,
    RecipeIngredient,
    CreateMenuItemInput,
    RecipeIngredientInput
} from '../types/menu.types';
import { UNIT_CONVERSIONS } from '../types/menu.types';

// Collection name
const COLLECTION = 'menu_items';

// ============================================================
// UNIT CONVERSION UTILITIES
// ============================================================

/**
 * Convert quantity from one unit to another
 * Returns the quantity in the target unit
 */
export function convertUnits(
    quantity: number,
    fromUnit: string,
    toUnit: string
): number {
    // Same unit - no conversion needed
    if (fromUnit.toLowerCase() === toUnit.toLowerCase()) {
        return quantity;
    }

    const fromLower = fromUnit.toLowerCase();
    const toLower = toUnit.toLowerCase();

    // Direct conversion
    if (UNIT_CONVERSIONS[fromLower]?.[toLower]) {
        return quantity * UNIT_CONVERSIONS[fromLower][toLower];
    }

    // Reverse conversion
    if (UNIT_CONVERSIONS[toLower]?.[fromLower]) {
        return quantity / UNIT_CONVERSIONS[toLower][fromLower];
    }

    // Try via ml for volume conversions
    if (UNIT_CONVERSIONS[fromLower]?.['ml'] && UNIT_CONVERSIONS['ml']?.[toLower]) {
        const inMl = quantity * UNIT_CONVERSIONS[fromLower]['ml'];
        return inMl * UNIT_CONVERSIONS['ml'][toLower];
    }

    // Try via g for weight conversions
    if (UNIT_CONVERSIONS[fromLower]?.['g'] && UNIT_CONVERSIONS['g']?.[toLower]) {
        const inG = quantity * UNIT_CONVERSIONS[fromLower]['g'];
        return inG * UNIT_CONVERSIONS['g'][toLower];
    }

    // No conversion found - return original
    console.warn(`No conversion found from ${fromUnit} to ${toUnit}`);
    return quantity;
}

/**
 * Get available recipe units for an inventory item's base unit
 */
export function getAvailableUnits(baseUnit: string): string[] {
    const baseLower = baseUnit.toLowerCase();
    const available = new Set<string>([baseUnit]);

    // Add all units this base can convert to
    if (UNIT_CONVERSIONS[baseLower]) {
        Object.keys(UNIT_CONVERSIONS[baseLower]).forEach(unit => available.add(unit));
    }

    // Add all units that can convert to this base
    Object.entries(UNIT_CONVERSIONS).forEach(([unit, conversions]) => {
        if (conversions[baseLower]) {
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
    const baseQuantity = convertUnits(quantity, recipeUnit, inventoryItem.units.countUnit);

    // Calculate cost
    const totalCost = baseQuantity * inventoryItem.costPerUnit;

    return { baseQuantity, totalCost };
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
            costPerBaseUnit: inventoryItem.costPerUnit,
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

    const menuItem: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'> = {
        businessUnitId: input.businessUnitId,
        name: input.name,
        category: input.category,
        description: input.description || '', // Fallback to empty string to prevent undefined
        sellingPrice: input.sellingPrice,
        ingredients,
        calculatedCost: totalCost,
        ...margins,
        imageUrl: input.imageUrl || '', // Fallback to empty string to prevent undefined
        isActive: true
    };

    // Create the menu item first
    const menuItemId = await FirestoreService.createDocument(COLLECTION, menuItem);

    // Create a linked FINISHED_GOOD inventory item
    try {
        const finishedGoodId = await InventoryService.createInventoryItem({
            businessUnitId: input.businessUnitId,
            name: input.name,
            type: 'FINISHED_GOOD',
            category: 'Food', // Use Food as default category for finished goods
            storageAreas: [], // Can be set by user later
            units: {
                countUnit: 'serving',
                buyUnit: 'serving',
                conversion: 1
            },
            parLevel: 0,
            currentStock: 0,
            costPerUnit: totalCost, // Recipe cost becomes the cost per unit
            menuItemId: menuItemId, // Link to the menu item
            notes: `Auto-created from Menu Engineering: ${input.name}`
        });

        // Update menu item with the linked inventory ID
        await FirestoreService.updateDocument(COLLECTION, menuItemId, {
            linkedInventoryItemId: finishedGoodId
        });
    } catch (error) {
        console.error('Error creating linked inventory item:', error);
        // Continue even if inventory creation fails - menu item is still valid
    }

    return menuItemId;
}

/**
 * Update an existing menu item
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
            sellingPrice, // FIX: Ensure sellingPrice is saved!
            ...margins
        };
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
    if (input.description !== undefined) updateData.description = input.description;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;

    try {
        await FirestoreService.updateDocument(COLLECTION, id, updateData);
        console.log(`[RecipesService] Successfully updated menu item ${id}`);

        // Sync with linked inventory item (Finished Good) if exists
        const currentItem = { ...existing, ...updateData };
        if (currentItem.linkedInventoryItemId) {
            try {
                await InventoryService.updateInventoryItem(currentItem.linkedInventoryItemId, {
                    name: currentItem.name,
                    costPerUnit: currentItem.calculatedCost
                });
                console.log(`[RecipesService] Synced inventory item ${currentItem.linkedInventoryItemId}`);
            } catch (invError) {
                console.error(`[RecipesService] Failed to sync inventory item:`, invError);
                // Don't throw here, the menu item update was successful
            }
        }
    } catch (err) {
        console.error(`[RecipesService] Error updating menu item ${id}:`, err);
        throw err;
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
 */
export async function recalculateAllCosts(businessUnitId: string): Promise<number> {
    const menuItems = await getMenuItems(businessUnitId);
    let updated = 0;

    for (const item of menuItems) {
        try {
            const { ingredients, totalCost } = await calculateRecipeCost(
                item.ingredients.map(i => ({
                    inventoryItemId: i.inventoryItemId,
                    quantity: i.quantity,
                    unit: i.unit
                })),
                businessUnitId
            );

            const margins = calculateMargins(item.sellingPrice, totalCost);

            await FirestoreService.updateDocument(COLLECTION, item.id, {
                ingredients,
                calculatedCost: totalCost,
                ...margins
            });

            updated++;
        } catch (error) {
            console.error(`Error recalculating costs for ${item.name}:`, error);
        }
    }

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
    convertUnits,
    getAvailableUnits
};

export default RecipesService;
