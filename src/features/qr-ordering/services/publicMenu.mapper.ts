// QR Ordering — pure mapping between the getPublicMenu callable's response and
// the UI's PublicMenuItem shape. No Firebase imports on purpose: everything here
// is deterministic and unit-testable in isolation.
//
// Security (Master Plan §6.4 / task rule 8): this mapper is FIELD-WHITELISTED —
// it copies only known public fields, so cost/margin/recipe/ingredients/
// linkedInventoryItemId can never reach the UI even if the server DTO ever
// carried them. The server already strips them; this is defence in depth.

import { MENU_GROUPS } from '../data/mockMenu';
import type { MenuGroup, PublicMenuItem } from '../data/mockMenu';

/**
 * Sanitized menu item exactly as returned by the getPublicMenu callable
 * (mirrors functions/src/qr/orderLogic.ts → PublicMenuItemDTO). Note it carries
 * only the level-2 `category`; the UI's Food/Drinks `group` is derived below.
 */
export interface PublicMenuItemDTO {
    id: string;
    name: string;
    category: string;
    sellingPrice: number;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
}

/** Full getPublicMenu callable response. */
export interface GetPublicMenuResponse {
    tableId: string;
    tableNumber: string;
    businessUnitId: string;
    items: PublicMenuItemDTO[];
}

/** UI-facing result after mapping (drops businessUnitId — not needed by the view). */
export interface PublicMenuResult {
    tableId: string;
    tableNumber: string;
    items: PublicMenuItem[];
}

/** Group for a category the taxonomy doesn't recognize. Food is the safe default
 *  (most menu items are food); drink categories are caught by the hints below. */
const DEFAULT_GROUP: MenuGroup = 'Food';

/** Keyword hints that classify an unknown raw category as a Drink. Real menu_items
 *  use categories like 'Beverages' / 'Cocktails' that aren't in the approved mock
 *  subcategory list; without this they'd default to Food and could hide under the
 *  wrong group. Substring match, case-insensitive. */
const DRINK_CATEGORY_HINTS = [
    'drink', 'beverage', 'beer', 'wine', 'cocktail', 'mocktail', 'coffee', 'tea',
    'juice', 'soda', 'shake', 'smoothie', 'water', 'spirit', 'liquor', 'alcohol',
    'lemonade', 'frappe', 'latte', 'espresso', 'soft drink',
];

/** Build a category → group lookup from the approved two-level hierarchy. */
export function buildCategoryGroupIndex(
    groups: { key: MenuGroup; subcategories: string[] }[] = MENU_GROUPS,
): Map<string, MenuGroup> {
    const index = new Map<string, MenuGroup>();
    for (const group of groups) {
        for (const sub of group.subcategories) {
            if (!index.has(sub)) index.set(sub, group.key);
        }
    }
    return index;
}

/** Fallback subcategory per group for a category we can't confidently map — the
 *  active item stays VISIBLE under the safest bucket rather than being dropped. */
const FALLBACK_SUBCATEGORY: Record<MenuGroup, string> = { Food: 'Mains', Drinks: 'Soft Drinks' };

/**
 * Explicit alias map: raw backend `menu_items.category` (lowercased + trimmed) →
 * one of the FIXED canonical customer subcategory tabs (MENU_GROUPS). The nav is a
 * stable product decision and never changes; real data is normalized INTO it here.
 * Extend this list as real backend category strings are confirmed — do NOT change
 * the tabs to match the backend.
 */
const CATEGORY_ALIAS: Record<string, string> = {
    // → Appetizers
    'appetizer': 'Appetizers', 'appetizers': 'Appetizers', 'starter': 'Appetizers', 'starters': 'Appetizers',
    'apps': 'Appetizers', 'small bites': 'Appetizers', 'pica pica': 'Appetizers', 'pulutan': 'Appetizers',
    // → Mains
    'main': 'Mains', 'mains': 'Mains', 'main course': 'Mains', 'main courses': 'Mains', 'entree': 'Mains',
    'entrees': 'Mains', 'main dish': 'Mains', 'rice meals': 'Mains', 'specials': 'Mains', 'sides': 'Mains', 'side': 'Mains',
    // → Sharing Plates
    'sharing': 'Sharing Plates', 'sharing plate': 'Sharing Plates', 'sharing plates': 'Sharing Plates',
    'to share': 'Sharing Plates', 'share': 'Sharing Plates', 'platter': 'Sharing Plates', 'platters': 'Sharing Plates', 'boodle': 'Sharing Plates',
    // → Desserts
    'dessert': 'Desserts', 'desserts': 'Desserts', 'sweets': 'Desserts', 'sweet': 'Desserts',
    // → Soft Drinks
    'soft drink': 'Soft Drinks', 'soft drinks': 'Soft Drinks', 'softdrink': 'Soft Drinks', 'softdrinks': 'Soft Drinks',
    'soda': 'Soft Drinks', 'sodas': 'Soft Drinks', 'beverage': 'Soft Drinks', 'beverages': 'Soft Drinks', 'non-alcoholic': 'Soft Drinks',
    // → Fresh Juice
    'juice': 'Fresh Juice', 'juices': 'Fresh Juice', 'fresh juice': 'Fresh Juice', 'fresh juices': 'Fresh Juice',
    'shake': 'Fresh Juice', 'shakes': 'Fresh Juice', 'smoothie': 'Fresh Juice', 'smoothies': 'Fresh Juice',
    // → Cocktails
    'cocktail': 'Cocktails', 'cocktails': 'Cocktails', 'mixed drink': 'Cocktails', 'mixed drinks': 'Cocktails',
    'mocktail': 'Cocktails', 'mocktails': 'Cocktails',
    // → Beer
    'beer': 'Beer', 'beers': 'Beer', 'lager': 'Beer', 'pilsen': 'Beer',
    // → Coffee
    'coffee': 'Coffee', 'coffees': 'Coffee', 'coffee & tea': 'Coffee', 'coffee and tea': 'Coffee', 'espresso': 'Coffee', 'latte': 'Coffee',
};

/**
 * Normalize a raw `menu_items.category` to one of the FIXED canonical customer
 * subcategories + its group. Order: exact canonical match → alias map → a
 * group-appropriate fallback bucket (so an active item is NEVER silently dropped
 * by an unrecognized category string). Pure + testable. Unrecognized categories
 * are logged once so backend data can be corrected.
 */
export function normalizeCategory(
    raw: string,
    index: Map<string, MenuGroup> = buildCategoryGroupIndex(),
): { category: string; group: MenuGroup } {
    const trimmed = (raw ?? '').trim();
    const exact = index.get(trimmed);
    if (exact) return { category: trimmed, group: exact };
    const aliased = CATEGORY_ALIAS[trimmed.toLowerCase()];
    if (aliased) return { category: aliased, group: index.get(aliased) ?? DEFAULT_GROUP };
    // Unrecognized: keep the item visible under the safest bucket for its group.
    const group: MenuGroup = DRINK_CATEGORY_HINTS.some(h => trimmed.toLowerCase().includes(h)) ? 'Drinks' : DEFAULT_GROUP;
    if (trimmed) console.warn(`[qr-menu] unmapped category "${trimmed}" → ${FALLBACK_SUBCATEGORY[group]} (add an alias)`);
    return { category: FALLBACK_SUBCATEGORY[group], group };
}

/**
 * Map one sanitized server DTO to a UI PublicMenuItem. Field-whitelisted:
 * only id/name/category/sellingPrice/isAvailable (+ optional description/imageUrl)
 * are ever read. `group` is derived from `category`. `bestSeller` is intentionally
 * absent for real data (the server DTO does not provide it).
 */
export function mapMenuItem(
    dto: PublicMenuItemDTO,
    index: Map<string, MenuGroup> = buildCategoryGroupIndex(),
): PublicMenuItem {
    // Normalize the raw backend category INTO a fixed canonical customer tab.
    const { category, group } = normalizeCategory(dto.category, index);
    const item: PublicMenuItem = {
        id: dto.id,
        name: dto.name,
        group,
        category,
        sellingPrice: dto.sellingPrice,
        isAvailable: dto.isAvailable === true,
    };
    if (typeof dto.description === 'string') item.description = dto.description;
    if (typeof dto.imageUrl === 'string') item.imageUrl = dto.imageUrl;
    return item;
}

/** Map a full callable response into the UI result shape. */
export function mapPublicMenuResponse(res: GetPublicMenuResponse): PublicMenuResult {
    const index = buildCategoryGroupIndex();
    return {
        tableId: res.tableId,
        tableNumber: res.tableNumber,
        items: Array.isArray(res.items) ? res.items.map(dto => mapMenuItem(dto, index)) : [],
    };
}

/**
 * Decide whether to serve the local mock menu instead of calling the backend.
 * Mock when: Firebase isn't really configured (local dev), no table id in the
 * route, or the explicit demo route (/order/demo). Otherwise the real callable
 * is used with the route param as the opaque QR token.
 */
export function shouldUseMockMenu(tableId: string | undefined, configValid: boolean): boolean {
    if (!configValid) return true;
    if (!tableId || tableId.trim() === '') return true;
    return tableId.trim().toLowerCase() === 'demo';
}
