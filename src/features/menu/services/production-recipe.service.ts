import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    writeBatch,
    query,
    where,
    orderBy,
    Timestamp,
    increment
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type {
    ProductionRecipe,
    CreateProductionRecipeInput,
    RecipeIngredient
} from '../types/menu.types';
import { InventoryService } from '../../inventory/services/inventory.service';

const COLLECTION = 'productionRecipes';

export class ProductionRecipeService {
    /**
     * Get all production recipes for a business unit
     */
    static async getRecipes(businessUnitId: string): Promise<ProductionRecipe[]> {
        const recipesRef = collection(db, COLLECTION);
        const q = query(
            recipesRef,
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true),
            orderBy('name', 'asc')
        );

        const snapshot = await getDocs(q);
        const recipes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ProductionRecipe[];

        console.log(`[ProductionRecipeService] Fetched ${recipes.length} recipes for BU ${businessUnitId}`);
        return recipes;
    }

    /**
     * Get a single production recipe by ID
     */
    static async getRecipe(recipeId: string): Promise<ProductionRecipe | null> {
        const docRef = doc(db, COLLECTION, recipeId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return {
            id: docSnap.id,
            ...docSnap.data()
        } as ProductionRecipe;
    }

    /**
     * Create a new production recipe
     */
    static async createRecipe(input: CreateProductionRecipeInput): Promise<ProductionRecipe> {
        // Calculate costs for each ingredient
        const ingredientsWithCost: RecipeIngredient[] = input.ingredients.map(ing => ({
            ...ing,
            totalCost: ing.baseQuantity * ing.costPerBaseUnit
        }));

        const totalCost = ingredientsWithCost.reduce((sum, ing) => sum + ing.totalCost, 0);
        const costPerUnit = input.yieldQuantity > 0 ? totalCost / input.yieldQuantity : 0;

        // Sanitize ingredients: remove keys with undefined values (Firestore rejects undefined)
        const sanitizedIngredients = ingredientsWithCost.map(ing => {
            const clean: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(ing)) {
                if (v !== undefined) clean[k] = v;
            }
            return clean;
        });

        const recipeData = {
            businessUnitId: input.businessUnitId,
            name: input.name,
            category: input.category,
            description: input.description ?? null,
            yieldQuantity: input.yieldQuantity,
            yieldUnit: input.yieldUnit,
            ingredients: sanitizedIngredients,
            calculatedCost: totalCost,
            costPerUnit,
            linkedInventoryItemId: null as string | null,
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, COLLECTION), recipeData);

        // Optionally create a linked PRODUCTION inventory item
        try {
            const inventoryItemId = await InventoryService.createInventoryItem({
                businessUnitId: input.businessUnitId,
                name: input.name,
                type: 'PRODUCTION',
                category: 'Mixers',
                sku: `PROD-${docRef.id.slice(0, 6).toUpperCase()}`,
                storageAreas: [],
                units: {
                    recipeUnit: input.yieldUnit,
                    buyUnit: input.yieldUnit,
                    conversion: 1
                },
                costPerUnit,
                parLevel: 0,
                currentStock: 0
            });

            // Link the inventory item to the recipe
            await updateDoc(doc(db, COLLECTION, docRef.id), {
                linkedInventoryItemId: inventoryItemId
            });

            return {
                id: docRef.id,
                ...recipeData,
                linkedInventoryItemId: inventoryItemId
            } as unknown as ProductionRecipe;
        } catch (err) {
            console.error('Error creating linked inventory item:', err);
            // Return recipe without linked inventory item
            return {
                id: docRef.id,
                ...recipeData
            } as unknown as ProductionRecipe;
        }
    }

    /**
     * Update an existing production recipe
     */
    static async updateRecipe(recipeId: string, input: CreateProductionRecipeInput): Promise<void> {
        // Calculate costs for each ingredient
        const ingredientsWithCost: RecipeIngredient[] = input.ingredients.map(ing => ({
            ...ing,
            totalCost: ing.baseQuantity * ing.costPerBaseUnit
        }));

        const totalCost = ingredientsWithCost.reduce((sum, ing) => sum + ing.totalCost, 0);
        const costPerUnit = input.yieldQuantity > 0 ? totalCost / input.yieldQuantity : 0;

        // Sanitize ingredients: remove keys with undefined values (Firestore rejects undefined)
        const sanitizedIngredients = ingredientsWithCost.map(ing => {
            const clean: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(ing)) {
                if (v !== undefined) clean[k] = v;
            }
            return clean;
        });

        const updateData = {
            name: input.name,
            category: input.category,
            description: input.description ?? null,
            yieldQuantity: input.yieldQuantity,
            yieldUnit: input.yieldUnit,
            ingredients: sanitizedIngredients,
            calculatedCost: totalCost,
            costPerUnit,
            updatedAt: Timestamp.now()
        };

        await updateDoc(doc(db, COLLECTION, recipeId), updateData);

        // Update linked inventory item if exists
        const recipe = await this.getRecipe(recipeId);
        if (recipe?.linkedInventoryItemId) {
            try {
                await InventoryService.updateInventoryItem(recipe.linkedInventoryItemId, {
                    name: input.name,
                    costPerUnit
                }, { skipRecipeRecalculation: true });
            } catch (err) {
                console.error('Error updating linked inventory item:', err);
            }
        }
    }

    /**
     * Delete a production recipe (soft delete)
     */
    static async deleteRecipe(recipeId: string): Promise<void> {
        await updateDoc(doc(db, COLLECTION, recipeId), {
            isActive: false,
            updatedAt: Timestamp.now()
        });
    }

    /**
     * Recalculate costs for all recipes in a business unit
     * (useful when ingredient costs change)
     *
     * OPTIMIZED: Fetches inventory ONCE, computes all costs in-memory,
     * then commits all updates in a single Firestore batch.
     */
    static async recalculateCosts(businessUnitId: string): Promise<void> {
        const recipes = await this.getRecipes(businessUnitId);
        if (recipes.length === 0) return;

        // ── Single fetch: build an O(1) lookup map ──────────────────
        const inventoryItems = await InventoryService.getInventory(businessUnitId);
        const itemMap = new Map(inventoryItems.map(i => [i.id, i]));

        // ── Compute new costs in-memory ─────────────────────────────
        const updates: Array<{
            recipeId: string;
            totalCost: number;
            costPerUnit: number;
            linkedInventoryItemId?: string | null;
        }> = [];

        for (const recipe of recipes) {
            let totalCost = 0;
            for (const ing of recipe.ingredients) {
                const item = itemMap.get(ing.inventoryItemId);
                if (item) {
                    // Use baseCost (per count-unit) when available, fall back to costPerUnit
                    const costPerBaseUnit = item.baseCost ?? item.costPerUnit;
                    totalCost += ing.baseQuantity * costPerBaseUnit;
                } else {
                    totalCost += ing.totalCost; // Keep existing if item not found
                }
            }

            const costPerUnit = recipe.yieldQuantity > 0 ? totalCost / recipe.yieldQuantity : 0;
            updates.push({
                recipeId: recipe.id,
                totalCost,
                costPerUnit,
                linkedInventoryItemId: recipe.linkedInventoryItemId,
            });
        }

        // ── Batch write: recipes + linked inventory items ───────────
        // Firestore batches support max 500 operations; chunk if needed
        const BATCH_LIMIT = 450; // leave headroom
        const now = Timestamp.now();

        for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
            const chunk = updates.slice(i, i + BATCH_LIMIT);
            const batch = writeBatch(db);

            for (const u of chunk) {
                // Update the recipe doc
                batch.update(doc(db, COLLECTION, u.recipeId), {
                    calculatedCost: u.totalCost,
                    costPerUnit: u.costPerUnit,
                    updatedAt: now,
                });

                // Update the linked inventory item (if any)
                if (u.linkedInventoryItemId) {
                    batch.update(doc(db, 'inventory_items', u.linkedInventoryItemId), {
                        costPerUnit: u.costPerUnit,
                        updatedAt: now,
                    });
                }
            }

            await batch.commit();
        }

        console.log(`[ProductionRecipeService] Batch-recalculated ${updates.length} recipes for BU ${businessUnitId}`);
    }

    // ================================================================
    // RECORD PRODUCTION YIELD — Atomic batch write
    // Increases PRODUCTION item stock, deducts all raw material ingredients
    // ================================================================

    /**
     * Record a production run. Atomically:
     * 1. Increase the PRODUCTION item's currentStock + theoreticalStock
     * 2. Write a PRODUCTION_YIELD stock transaction
     * 3. Deduct each raw material's currentStock + theoreticalStock
     * 4. Write PRODUCTION_CONSUME stock transactions per ingredient
     */
    static async recordProductionYield(params: {
        recipeId: string;
        yieldQuantity: number;
        businessUnitId: string;
        userId: string;
        userName: string;
    }): Promise<{ success: boolean; message: string }> {
        const { recipeId, yieldQuantity, businessUnitId, userId, userName } = params;

        if (yieldQuantity <= 0) {
            throw new Error('Yield quantity must be greater than 0.');
        }

        // ── Step A: Fetch the Production Recipe ──────────────────────
        const recipe = await this.getRecipe(recipeId);
        if (!recipe) {
            throw new Error(`Production recipe "${recipeId}" not found.`);
        }
        if (!recipe.linkedInventoryItemId) {
            throw new Error(`Recipe "${recipe.name}" has no linked inventory item. Please re-save the recipe.`);
        }
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            throw new Error(`Recipe "${recipe.name}" has no ingredients defined.`);
        }

        // ── Step B: Fetch PRODUCTION item + all RAW_MATERIAL items ───
        const prodItemRef = doc(db, 'inventory_items', recipe.linkedInventoryItemId);
        const prodItemSnap = await getDoc(prodItemRef);
        if (!prodItemSnap.exists()) {
            throw new Error(`Linked inventory item "${recipe.linkedInventoryItemId}" not found.`);
        }
        const prodItem = { id: prodItemSnap.id, ...prodItemSnap.data() } as { id: string; name: string; currentStock: number; theoreticalStock: number; businessUnitId: string };

        // Fetch all raw material docs referenced in the recipe
        const rawMaterialDocs = new Map<string, { id: string; name: string; currentStock: number; theoreticalStock: number }>();
        for (const ing of recipe.ingredients) {
            const rmRef = doc(db, 'inventory_items', ing.inventoryItemId);
            const rmSnap = await getDoc(rmRef);
            if (!rmSnap.exists()) {
                throw new Error(`Raw material "${ing.inventoryItemName || ing.inventoryItemId}" not found in inventory. Cannot record production.`);
            }
            const rmData = rmSnap.data();
            rawMaterialDocs.set(ing.inventoryItemId, {
                id: rmSnap.id,
                name: rmData.name || ing.inventoryItemName,
                currentStock: rmData.currentStock ?? 0,
                theoreticalStock: rmData.theoreticalStock ?? rmData.currentStock ?? 0
            });
        }

        // ── Step C: Initialize Firestore Batch ──────────────────────
        const batch = writeBatch(db);
        const now = Timestamp.now();

        // Unique ID for this specific production run (used to link yield → consumes)
        const batchId = `BATCH-${recipeId.slice(0, 6)}-${now.seconds}`;

        // ── Step D: Increase PRODUCTION item stock ──────────────────
        const newProdTheoretical = (prodItem.theoreticalStock ?? prodItem.currentStock ?? 0) + yieldQuantity;

        batch.update(prodItemRef, {
            currentStock: increment(yieldQuantity),
            theoreticalStock: increment(yieldQuantity),
            updatedAt: now
        });

        // Write PRODUCTION_YIELD stock transaction
        const unitCost = recipe.costPerUnit ?? 0;
        const totalCostRun = unitCost * yieldQuantity;
        const yieldTxRef = doc(collection(db, 'stock_transactions'));
        batch.set(yieldTxRef, {
            itemId: prodItem.id,
            itemName: prodItem.name,
            businessUnitId,
            type: 'PRODUCTION_YIELD',
            quantity: yieldQuantity,
            balanceAfter: newProdTheoretical,
            referenceId: recipeId,   // recipe-level reference (for recipe filtering)
            batchId,                  // unique per production run (for consume drill-down)
            recipeName: recipe.name,
            yieldUnit: recipe.yieldUnit,
            unitCost,                 // cost per yield unit at time of run
            totalCost: totalCostRun,  // total cost of this run
            notes: `Production Run: yielded ${yieldQuantity} ${recipe.yieldUnit} of ${recipe.name}`,
            performedBy: userId,
            performedByName: userName,
            timestamp: now
        });

        // ── Step E: Explode & Deduct Raw Materials ──────────────────
        for (const ing of recipe.ingredients) {
            const deductionAmount = ing.baseQuantity * yieldQuantity;
            const rmItem = rawMaterialDocs.get(ing.inventoryItemId)!;
            const newRmTheoretical = rmItem.theoreticalStock - deductionAmount;

            const rmRef = doc(db, 'inventory_items', ing.inventoryItemId);
            batch.update(rmRef, {
                currentStock: increment(-deductionAmount),
                theoreticalStock: increment(-deductionAmount),
                updatedAt: now
            });

            // Write PRODUCTION_CONSUME stock transaction
            const consumeTxRef = doc(collection(db, 'stock_transactions'));
            batch.set(consumeTxRef, {
                itemId: ing.inventoryItemId,
                itemName: rmItem.name,
                businessUnitId,
                type: 'PRODUCTION_CONSUME',
                quantity: deductionAmount,
                balanceAfter: newRmTheoretical,
                referenceId: recipeId,   // recipe-level reference
                batchId,                  // unique per production run — matches the YIELD row
                notes: `Used in Production: ${recipe.name} (×${yieldQuantity} ${recipe.yieldUnit})`,
                performedBy: userId,
                performedByName: userName,
                timestamp: now
            });

            // ── Wastage record (if ingredient has a prep-loss percentage) ───
            const wastagePercent = ing.wastagePercent ?? 0;
            if (wastagePercent > 0) {
                const wastageQty = (wastagePercent / 100) * ing.quantity;
                const wastageUnit = ing.unit;
                const wastageCost = (wastagePercent / 100) * ing.totalCost;
                const wastageRef = doc(collection(db, 'wastage_records'));
                batch.set(wastageRef, {
                    businessUnitId,
                    itemId: ing.inventoryItemId,
                    itemName: rmItem.name,
                    type: 'PRODUCTION',
                    category: 'PRODUCTION_BATCH',
                    quantity: wastageQty,
                    unit: wastageUnit,
                    wastagePercent,
                    costPerUnit: ing.costPerBaseUnit,
                    totalCost: wastageCost,
                    reason: `Production wastage: ${recipe.name} — ${wastagePercent}% prep-loss on ${rmItem.name}`,
                    batchId,
                    referenceId: recipeId,
                    recipeName: recipe.name,
                    recordedBy: userId,
                    recordedByName: userName,
                    createdAt: now
                });
            }
        }

        // ── Step F: Commit the batch ────────────────────────────────
        try {
            await batch.commit();
            console.log(`[ProductionRecipeService] Production yield recorded: ${yieldQuantity} ${recipe.yieldUnit} of ${recipe.name}`);
            return {
                success: true,
                message: `Successfully produced ${yieldQuantity} ${recipe.yieldUnit} of ${recipe.name}. Raw materials deducted.`
            };
        } catch (err) {
            console.error('[ProductionRecipeService] Batch commit failed:', err);
            throw new Error(`Failed to record production run. No stock was modified. Error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
