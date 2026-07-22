const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-9c071a7b56.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore(app, 'tng-systems');

function buildBomRecipe(ingredients, yieldQuantity) {
  return ingredients.map(ri => {
    return {
      ingredientId: ri.inventoryItemId,
      ingredientName: ri.inventoryItemName,
      quantityUsed: yieldQuantity > 0 ? (ri.baseQuantity / yieldQuantity) : 0,
      unit: ri.unit || 'EA', // Fallback to 'EA' if unit is undefined/null/empty
      wastagePercent: ri.wastagePercent ?? 0,
    };
  });
}

async function run() {
  console.log("Fetching recipes with missing linked inventory items...");
  const snap = await db.collection('productionRecipes')
    .where('isActive', '==', true)
    .get();

  console.log(`Found ${snap.size} active recipes.`);

  let healedCount = 0;

  for (const doc of snap.docs) {
    const recipe = doc.data();
    recipe.id = doc.id;

    if (!recipe.linkedInventoryItemId) {
      console.log(`\nRecipe "${recipe.name}" (ID: ${recipe.id}) has no linked inventory item. Healing...`);

      try {
        // 1. Create linked PRODUCTION item
        const itemRef = db.collection('inventory_items').doc();
        const costPerUnit = recipe.costPerUnit ?? 0;
        
        const itemData = {
          businessUnitId: recipe.businessUnitId,
          name: recipe.name,
          type: 'PRODUCTION',
          category: 'Mixers',
          ...(recipe.serviceType && { serviceType: recipe.serviceType }),
          sku: `PROD-${recipe.id.slice(0, 6).toUpperCase()}`,
          storageAreas: [],
          units: {
            recipeUnit: recipe.yieldUnit || 'EA',
            buyUnit: recipe.yieldUnit || 'EA',
            conversion: 1
          },
          costPerUnit,
          parLevel: 0,
          currentStock: 0,
          theoreticalStock: 0,
          isActive: true,
          recipe: buildBomRecipe(recipe.ingredients || [], recipe.yieldQuantity || 10),
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        await itemRef.set(itemData);
        console.log(`  Created inventory item "${recipe.name}" with ID: ${itemRef.id}`);

        // 2. Link it back to the recipe
        await db.collection('productionRecipes').doc(recipe.id).update({
          linkedInventoryItemId: itemRef.id,
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log(`  Linked recipe ${recipe.id} to item ${itemRef.id}`);
        healedCount++;
      } catch (err) {
        console.error(`  Failed to heal recipe "${recipe.name}":`, err.message);
      }
    }
  }

  console.log(`\nHealing complete. Healed ${healedCount} recipes.`);
}

run().catch(console.error);
