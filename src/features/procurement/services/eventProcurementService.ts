/**
 * ============================================================
 * Event Procurement Service
 * ============================================================
 *
 * Handles the "Generate Requirements" recipe explosion for
 * Event-type BURFs. Given a manually composed list of Finished
 * Goods (from inventory_items with serviceType='Event'), guest
 * count, and buffer percentage, this service:
 *
 *   1. Accepts the user's selected Finished Goods + qtyPerPax
 *   2. Resolves each FG's BOM recipe (from inventory_items)
 *   3. Scales ingredient quantities by total servings
 *   4. Aggregates duplicate raw materials across recipes
 *   5. Returns RequisitionItem[] ready for the BURF items grid
 *
 * SECURITY: Read-only Firestore queries. No writes.
 */

import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { RequisitionItem, EventMenuItem } from '../types';
import type { InventoryItem, BomIngredient } from '../../inventory/types/InventoryItem';
import type { MenuItem } from '../../menu/types/menu.types';

// ============================================================
// TYPES
// ============================================================

/** Summary metrics returned alongside the generated items */
export interface ExplosionSummary {
  totalServings: number;
  confirmedGuests: number;
  bufferServings: number;
  finishedGoodsCount: number;
  rawMaterialsCount: number;
  estimatedFoodCost: number;
  costPerGuest: number;
}

/** Full result from the explosion engine */
export interface ExplosionResult {
  items: RequisitionItem[];
  summary: ExplosionSummary;
  finishedGoods: EventMenuItem[];
}

// ============================================================
// VENUE OPTIONS (can be extended from Firestore settings later)
// ============================================================

export const EVENT_VENUES = [
  'Main Dining',
  'Private Hall',
  'Rooftop Terrace',
  'Garden Area',
  'Poolside',
  'Off-site / External',
  'Other',
] as const;

export type EventVenue = (typeof EVENT_VENUES)[number];

// ============================================================
// FIRESTORE QUERIES
// ============================================================

/**
 * Fetch all active FINISHED_GOOD inventory items with serviceType='Event'
 * for a given business unit. These are the items available to add to an
 * event's menu.
 */
export async function getEventFinishedGoods(
  businessUnitId: string
): Promise<(MenuItem & { id: string })[]> {
  const ref = collection(db, 'menu_items');
  const q = query(
    ref,
    where('businessUnitId', '==', businessUnitId),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem & { id: string }));
}

/**
 * Fetch all inventory items for a business unit (used as BOM lookup).
 */
async function getInventoryMap(
  businessUnitId: string
): Promise<Map<string, InventoryItem & { id: string }>> {
  const ref = collection(db, 'inventory_items');
  const q = query(
    ref,
    where('businessUnitId', '==', businessUnitId),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  const map = new Map<string, InventoryItem & { id: string }>();
  snap.docs.forEach((d) => {
    const item = { id: d.id, ...d.data() } as InventoryItem & { id: string };
    map.set(d.id, item);
  });
  return map;
}

// ============================================================
// CORE: RECIPE EXPLOSION ENGINE
// ============================================================

/**
 * Explode a manually composed event menu's BOM into aggregated
 * raw material purchase requirements.
 *
 * @param menuItems        User-selected finished goods with qtyPerPax
 * @param confirmedGuests  Number of confirmed guests
 * @param bufferPercent    Production buffer percentage (default 10)
 * @param businessUnitId   Business Unit for inventory lookup
 * @param eventName        Event name for auto-generated remarks
 */
export async function explodePackageRecipes(options: {
  menuItems: EventMenuItem[];
  confirmedGuests: number;
  bufferPercent: number;
  businessUnitId: string;
  eventName: string;
}): Promise<ExplosionResult> {
  const { menuItems, confirmedGuests, bufferPercent, businessUnitId, eventName } =
    options;

  // 1. Calculate total servings (ceiling)
  const totalServings = Math.ceil(
    confirmedGuests * (1 + bufferPercent / 100)
  );
  const bufferServings = totalServings - confirmedGuests;

  if (menuItems.length === 0) {
    throw new Error('No menu items selected. Add finished goods to the event menu first.');
  }

  // 2. Build full inventory map for BOM resolution
  const invMap = await getInventoryMap(businessUnitId);

  // 2.5 Build menu items map for top-level FGs
  const menuRef = collection(db, 'menu_items');
  const menuQ = query(menuRef, where('businessUnitId', '==', businessUnitId), where('isActive', '==', true));
  const menuSnap = await getDocs(menuQ);
  const menuMap = new Map<string, MenuItem & { id: string }>();
  menuSnap.docs.forEach((d) => menuMap.set(d.id, { id: d.id, ...d.data() } as MenuItem & { id: string }));

  // 3. Explode each finished good's BOM into raw materials
  //    Key = inventoryItemId, Value = aggregated quantity & metadata
  const rmAggregation = new Map<
    string,
    { name: string; totalQty: number; unit: string; unitCost: number }
  >();

  let totalFoodCost = 0;

  for (const fg of menuItems) {
    const fgItem = menuMap.get(fg.inventoryItemId);
    if (!fgItem) continue;

    // Total units of this FG needed = totalServings * qtyPerPax
    const fgUnitsNeeded = totalServings * fg.qtyPerPax;

    // If FG has a BOM recipe, explode it
    if (fgItem.ingredients && fgItem.ingredients.length > 0) {
      for (const ingredient of fgItem.ingredients) {
        const rmItem = invMap.get(ingredient.inventoryItemId);
        if (!rmItem) continue;

        // Scale ingredient quantity by the number of FG units needed
        const requiredQty = fgUnitsNeeded * ingredient.quantity;

        // Aggregate
        const existing = rmAggregation.get(ingredient.inventoryItemId);
        const unitCost = rmItem.baseCost ?? rmItem.costPerUnit ?? 0;

        if (existing) {
          existing.totalQty += requiredQty;
        } else {
          rmAggregation.set(ingredient.inventoryItemId, {
            name: ingredient.inventoryItemName || rmItem.name,
            totalQty: requiredQty,
            unit: ingredient.unit || rmItem.units?.recipeUnit || 'EA',
            unitCost,
          });
        }

        totalFoodCost += requiredQty * unitCost;

        // If the ingredient itself is a PRODUCTION item with its own sub-recipe,
        // recursively explode one level deeper
        if (rmItem.type === 'PRODUCTION' && rmItem.recipe && rmItem.recipe.length > 0) {
          explodeSubRecipe(
            rmItem.recipe,
            requiredQty,
            invMap,
            rmAggregation,
            (cost) => { totalFoodCost += cost; }
          );
          // Remove the PRODUCTION item itself (we only want raw materials)
          rmAggregation.delete(ingredient.inventoryItemId);
        }
      }
    } else {
      // FG has no recipe — add it directly as a requirement if linked
      if (fgItem.linkedInventoryItemId) {
          const linkedInv = invMap.get(fgItem.linkedInventoryItemId);
          if (linkedInv) {
              const unitCost = linkedInv.baseCost ?? linkedInv.costPerUnit ?? 0;
              const existing = rmAggregation.get(fgItem.linkedInventoryItemId);
              if (existing) {
                existing.totalQty += fgUnitsNeeded;
              } else {
                rmAggregation.set(fgItem.linkedInventoryItemId, {
                  name: linkedInv.name,
                  totalQty: fgUnitsNeeded,
                  unit: linkedInv.units?.recipeUnit || 'EA',
                  unitCost,
                });
              }
              totalFoodCost += fgUnitsNeeded * unitCost;
          }
      }
    }
  }

  // 4. Convert aggregated map → RequisitionItem[]
  const items: RequisitionItem[] = [];
  let idx = 0;

  for (const [itemId, data] of rmAggregation) {
    // Round quantity up to 2 decimal places
    const roundedQty = Math.ceil(data.totalQty * 100) / 100;

    items.push({
      itemId: `event-${idx++}-${itemId}`,
      name: data.name,
      quantity: roundedQty,
      uom: data.unit,
      stockOnHand: 0,
      price: 0, // BURF doesn't set prices (that's PRF's job)
      remarks: `Auto-generated for ${eventName}`,
    });
  }

  // 5. Build summary
  const costPerGuest = confirmedGuests > 0
    ? Math.round((totalFoodCost / confirmedGuests) * 100) / 100
    : 0;

  const summary: ExplosionSummary = {
    totalServings,
    confirmedGuests,
    bufferServings,
    finishedGoodsCount: menuItems.length,
    rawMaterialsCount: items.length,
    estimatedFoodCost: Math.round(totalFoodCost * 100) / 100,
    costPerGuest,
  };

  return { items, summary, finishedGoods: menuItems };
}

// ============================================================
// HELPER: Recursive sub-recipe explosion
// ============================================================

function explodeSubRecipe(
  recipe: BomIngredient[],
  multiplier: number,
  invMap: Map<string, InventoryItem & { id: string }>,
  rmAggregation: Map<string, { name: string; totalQty: number; unit: string; unitCost: number }>,
  addCost: (cost: number) => void
): void {
  for (const subIng of recipe) {
    const subItem = invMap.get(subIng.ingredientId);
    if (!subItem) continue;

    const subQty = multiplier * subIng.quantityUsed;
    const unitCost = subItem.baseCost ?? subItem.costPerUnit ?? 0;

    const existing = rmAggregation.get(subIng.ingredientId);
    if (existing) {
      existing.totalQty += subQty;
    } else {
      rmAggregation.set(subIng.ingredientId, {
        name: subIng.ingredientName || subItem.name,
        totalQty: subQty,
        unit: subIng.unit || subItem.units?.recipeUnit || 'EA',
        unitCost,
      });
    }

    addCost(subQty * unitCost);
  }
}
