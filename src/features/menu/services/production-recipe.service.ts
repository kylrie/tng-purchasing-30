import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp
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

        const recipeData = {
            businessUnitId: input.businessUnitId,
            name: input.name,
            category: input.category,
            description: input.description || null,
            yieldQuantity: input.yieldQuantity,
            yieldUnit: input.yieldUnit,
            ingredients: ingredientsWithCost,
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
                    countUnit: input.yieldUnit,
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

        const updateData = {
            name: input.name,
            category: input.category,
            description: input.description || null,
            yieldQuantity: input.yieldQuantity,
            yieldUnit: input.yieldUnit,
            ingredients: ingredientsWithCost,
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
     */
    static async recalculateCosts(businessUnitId: string): Promise<void> {
        const recipes = await this.getRecipes(businessUnitId);

        for (const recipe of recipes) {
            // Get current inventory costs
            let totalCost = 0;
            for (const ing of recipe.ingredients) {
                try {
                    const items = await InventoryService.getInventory(businessUnitId);
                    const item = items.find(i => i.id === ing.inventoryItemId);
                    if (item) {
                        const newCost = ing.baseQuantity * item.costPerUnit;
                        totalCost += newCost;
                    } else {
                        totalCost += ing.totalCost; // Keep existing if item not found
                    }
                } catch (err) {
                    totalCost += ing.totalCost;
                }
            }

            const costPerUnit = recipe.yieldQuantity > 0 ? totalCost / recipe.yieldQuantity : 0;

            await updateDoc(doc(db, COLLECTION, recipe.id), {
                calculatedCost: totalCost,
                costPerUnit,
                updatedAt: Timestamp.now()
            });

            // Update linked inventory item
            if (recipe.linkedInventoryItemId) {
                try {
                    await InventoryService.updateInventoryItem(recipe.linkedInventoryItemId, {
                        costPerUnit
                    }, { skipRecipeRecalculation: true });
                } catch (err) {
                    console.error('Error updating linked inventory item cost:', err);
                }
            }
        }
    }
}
