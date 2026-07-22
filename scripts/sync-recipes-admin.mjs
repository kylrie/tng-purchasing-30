import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'tng-systems' });
const db = admin.firestore();

async function syncRecipes() {
    console.log('Fetching production recipes...');
    const recipesSnap = await db.collection('productionRecipes').get();
    
    console.log(`Found ${recipesSnap.docs.length} production recipes. Syncing...`);
    let synced = 0;

    for (const d of recipesSnap.docs) {
        const recipe = d.data();
        if (recipe.linkedInventoryItemId && recipe.ingredients) {
            try {
                const yieldQty = recipe.yieldQuantity || 1;
                const bomRecipe = recipe.ingredients.map(ri => ({
                    ingredientId: ri.inventoryItemId,
                    ingredientName: ri.inventoryItemName,
                    quantityUsed: yieldQty > 0 ? (ri.baseQuantity / yieldQty) : 0,
                    unit: ri.unit,
                    wastagePercent: ri.wastagePercent ?? 0,
                }));

                await db.collection('inventory_items').doc(recipe.linkedInventoryItemId).update({
                    recipe: bomRecipe
                });
                console.log(`Synced recipe for ${recipe.name}`);
                synced++;
            } catch (err) {
                console.error(`Failed to sync ${recipe.name}:`, err);
            }
        }
    }
    console.log(`Successfully synced ${synced} recipes.`);
    process.exit(0);
}

syncRecipes().catch(e => {
    console.error(e);
    process.exit(1);
});
