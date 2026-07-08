// QR Ordering — the single, PURE food/drink split used by the bar board, the
// kitchen/bar routing, and the operations nav counts.
//
// Kept firebase-free (imports only the static MENU_GROUPS data) so it can be used
// from pure/unit-testable modules without dragging in the Firebase client init.

import { MENU_GROUPS } from '../data/mockMenu';

/** Category names under the "Drinks" group — the single source of the food/drink
 *  split, reused from the approved menu hierarchy. */
const DRINK_CATEGORIES = new Set<string>(
    MENU_GROUPS.find(g => g.key === 'Drinks')?.subcategories ?? [],
);

/** True when a menu-item category belongs to the bar (a drink). Pure/testable. */
export function isDrinkCategory(category: string): boolean {
    return DRINK_CATEGORIES.has(category);
}
