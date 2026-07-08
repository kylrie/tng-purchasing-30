/**
 * QR Ordering — station routing (Kitchen vs Bar) for automatic ticket printing.
 *
 * Decides, for each line on a PAID order, whether it is KITCHEN work (food) or
 * BAR work (a drink). This is the SERVER-SIDE source of truth used when a released
 * order's print jobs are created, so the Kitchen ticket carries food-only lines
 * and the Bar ticket carries drink-only lines (owner requirement: separate
 * tickets, one shared order status).
 *
 * WHY this is not a one-line category check: real `menu_items` categories are
 * COARSE — BEACHBOSSES stores every drink as "Beverages" and every food item as
 * "Mains"/"Appetizers" — while the frontend's naive `isDrinkCategory` only matches
 * the FIXED FINE subcategories (Soft Drinks / Cocktails / Beer / …). A "Beverages"
 * line would wrongly route to the Kitchen. This module mirrors the OWNER-APPROVED
 * customer-menu classification (src/features/qr-ordering/services/publicMenu.mapper.ts:
 * normalizeCategory + refineByName): normalize the coarse category, refine by the
 * item NAME, then route by the resulting GROUP. Pure + deterministic (no I/O, no
 * logging) so it is trivially unit-testable.
 *
 * KEEP IN SYNC with publicMenu.mapper.ts (this is a deliberate functions-side port;
 * the two TS build roots don't share code). The alias + name rules below are the
 * same owner-approved rules, validated against real b3 data on 2026-07-07.
 */

export type Station = 'KITCHEN' | 'BAR';
type MenuGroup = 'Food' | 'Drinks';

/** The FIXED, approved two-level menu hierarchy (mirrors data/mockMenu MENU_GROUPS). */
const GROUPS: { key: MenuGroup; subcategories: string[] }[] = [
    { key: 'Food', subcategories: ['Appetizers', 'Mains', 'Sharing Plates', 'Desserts'] },
    { key: 'Drinks', subcategories: ['Soft Drinks', 'Fresh Juice', 'Cocktails', 'Beer', 'Coffee'] },
];

/** Food is the safe default for an unrecognized category (most items are food);
 *  drink categories are caught by the alias map + hints below. */
const DEFAULT_GROUP: MenuGroup = 'Food';

/** Keyword hints that classify an unknown raw category as a Drink. Substring
 *  match, case-insensitive. */
const DRINK_CATEGORY_HINTS = [
    'drink', 'beverage', 'beer', 'wine', 'cocktail', 'mocktail', 'coffee', 'tea',
    'juice', 'soda', 'shake', 'smoothie', 'water', 'spirit', 'liquor', 'alcohol',
    'lemonade', 'frappe', 'latte', 'espresso', 'soft drink',
];

/** Fallback subcategory per group for a category we can't confidently map. */
const FALLBACK_SUBCATEGORY: Record<MenuGroup, string> = { Food: 'Mains', Drinks: 'Soft Drinks' };

/**
 * Explicit alias map: raw backend `menu_items.category` (lowercased + trimmed) →
 * one of the FIXED canonical customer subcategories. Extend as real backend
 * category strings are confirmed. (Ported verbatim from publicMenu.mapper.ts.)
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
 * Name-based refinement rules (owner-approved 2026-07-07). BEACHBOSSES' backend
 * categories are coarse — every drink is 'Beverages' and every food item is
 * 'Mains' — so the correct FIXED subcategory is derived from the item NAME. First
 * match wins. (Ported verbatim from publicMenu.mapper.ts.)
 */
interface NameRule { re: RegExp; category: string; }
const NAME_RULES: NameRule[] = [
    // Drinks (backend 'Beverages') → fine drink tabs
    { re: /\b(heineken|red\s*horse|san\s*mig|pale\s*pilsen|pilsen|lager|beer)\b/i, category: 'Beer' },
    { re: /\b(americano|cappu\w*|latte|espresso|coffee|barako|mocha|macchiato)\b/i, category: 'Coffee' },
    { re: /\b(mule|cocktail|mojito|margarita|daiquiri|smirnoff|vodka|rum|gin|tequila|whisk(?:e)?y)\b/i, category: 'Cocktails' },
    { re: /mais\s*con\s*yelo/i, category: 'Desserts' },
    { re: /\b(juice|shake|smoothie|lemonade)\b/i, category: 'Fresh Juice' },
    // Food (backend 'Mains') → obvious appetizers
    { re: /\b(nachos?|mozz?arella|mozza|crispy\s*trio|wings|lumpiang?|sisig|grilled\s*corn|pork\s*bbq|hotdog|calamares|logs)\b/i, category: 'Appetizers' },
];

/** category → group lookup from the FIXED hierarchy. */
function buildCategoryGroupIndex(): Map<string, MenuGroup> {
    const index = new Map<string, MenuGroup>();
    for (const group of GROUPS) {
        for (const sub of group.subcategories) {
            if (!index.has(sub)) index.set(sub, group.key);
        }
    }
    return index;
}
const INDEX = buildCategoryGroupIndex();

/** Normalize a raw category to a canonical subcategory + its group. Order: exact
 *  canonical → alias map → drink-hint / default fallback. Pure. */
function normalizeCategory(raw: string): { category: string; group: MenuGroup } {
    const trimmed = (raw ?? '').trim();
    const exact = INDEX.get(trimmed);
    if (exact) return { category: trimmed, group: exact };
    const aliased = CATEGORY_ALIAS[trimmed.toLowerCase()];
    if (aliased) return { category: aliased, group: INDEX.get(aliased) ?? DEFAULT_GROUP };
    const group: MenuGroup = DRINK_CATEGORY_HINTS.some(h => trimmed.toLowerCase().includes(h)) ? 'Drinks' : DEFAULT_GROUP;
    return { category: FALLBACK_SUBCATEGORY[group], group };
}

/** Refine a base classification by the item NAME (see NAME_RULES). Can flip the
 *  group (e.g. a smoothie mistagged 'Mains' becomes Fresh Juice / Drinks). Pure. */
function refineByName(name: string, base: { category: string; group: MenuGroup }): { category: string; group: MenuGroup } {
    const n = name ?? '';
    for (const rule of NAME_RULES) {
        if (rule.re.test(n)) return { category: rule.category, group: INDEX.get(rule.category) ?? base.group };
    }
    return base;
}

/** Minimal order-line shape the router reads. */
export interface RoutableLine {
    productName?: string;
    category?: string;
}

/**
 * Classify one order line to its station. BAR iff the fully-refined group is
 * 'Drinks'; otherwise KITCHEN. Robust to BOTH fine subcategories (demo/mock) and
 * coarse real categories ("Beverages"/"Mains"). Pure + deterministic.
 */
export function classifyStation(line: RoutableLine): Station {
    const name = typeof line.productName === 'string' ? line.productName : '';
    const category = typeof line.category === 'string' ? line.category : '';
    const { group } = refineByName(name, normalizeCategory(category));
    return group === 'Drinks' ? 'BAR' : 'KITCHEN';
}

/**
 * Split an order's lines into KITCHEN (food) and BAR (drink) buckets, preserving
 * order. A station bucket is empty when the order has no lines for it. Pure.
 */
export function splitByStation<T extends RoutableLine>(lines: T[]): Record<Station, T[]> {
    const out: Record<Station, T[]> = { KITCHEN: [], BAR: [] };
    for (const line of Array.isArray(lines) ? lines : []) {
        out[classifyStation(line)].push(line);
    }
    return out;
}
