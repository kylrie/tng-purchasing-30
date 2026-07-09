// The Fun Roof — menu navigation + pure mapping (business unit b1).
//
// Turns the read-only snapshot (the owner's curated menu sheet) into the UI item
// shape, normalized into a FIXED three-level-1 nav that mirrors the venue's real
// menu sections. The Fun Roof is a rooftop BAR + games venue, so the top level is
// Drinks · Food · Play, and each snapshot category maps directly to a sub-tab.
//
// COMPLETENESS GUARANTEE (asserted by funRoofMenu.test.ts): every snapshot item
// resolves to exactly one sub-tab that exists in the nav, so nothing is hidden.
// Pure + framework-free — no Firebase, no React. Field-whitelisted: only public
// menu fields are read (no cost/margin/recipe).

import { FUN_ROOF_MENU_SNAPSHOT } from './data/funRoofMenu.snapshot';
import type { FunRoofMenuRecord } from './data/funRoofMenu.snapshot';
import { funRoofImageFor } from './data/funRoofMenuImages';

export type FunRoofGroup = 'Drinks' | 'Food' | 'Play';

/** UI-facing menu item. Self-contained (not coupled to the Inflatable Island type). */
export interface FunRoofItem {
    id: string;
    name: string;
    group: FunRoofGroup;
    /** Level-2 sub-tab within the group. */
    category: string;
    sellingPrice: number;
    description?: string;
    /** Serving/size qualifier shown under the name, e.g. "Bottle", "Shot", "Per pax". */
    serving?: string;
    /** Menu tag shown as an accent chip, e.g. "Bestseller", "Chef's Reco". */
    tag?: string;
    /** True when the tag marks a bestseller (rendered with a highlighted chip). */
    bestSeller: boolean;
    imageUrl?: string;
    isAvailable: boolean;
}

/** FIXED nav for The Fun Roof. Drinks first (it's a bar); Play = games + packages. */
export const FUN_ROOF_MENU_GROUPS: { key: FunRoofGroup; subcategories: string[] }[] = [
    { key: 'Drinks', subcategories: ['Classics', 'Beers', 'Whiskey', 'Tequila', 'Rum', 'Gin', 'Vodka', 'Liqueur', 'Ice Cold', 'Non-Alcoholic'] },
    { key: 'Food', subcategories: ['Bestsellers', 'Pizza', 'Bar Chows', 'Ice Cream', 'Add-ons'] },
    { key: 'Play', subcategories: ['Packages', 'Games'] },
];

/** sub-tab → group, derived from the nav so there is one source of truth. */
const SUBCATEGORY_GROUP: Map<string, FunRoofGroup> = (() => {
    const m = new Map<string, FunRoofGroup>();
    for (const g of FUN_ROOF_MENU_GROUPS) for (const s of g.subcategories) m.set(s, g.key);
    return m;
})();

/** Raw sheet category → nav sub-tab. The sheet is authoritative, so this is a
 *  direct rename map (no fuzzy matching). Extend if the sheet adds a section. */
const CATEGORY_TO_SUB: Record<string, string> = {
    'The Fun Roof Bestsellers': 'Bestsellers',
    'Pizza': 'Pizza',
    'Bar Chows': 'Bar Chows',
    'Ice Cream': 'Ice Cream',
    'Add Ons': 'Add-ons',
    'Whiskey': 'Whiskey',
    'Vodka': 'Vodka',
    'Tequila/Mescal': 'Tequila',
    'Rum': 'Rum',
    'Gin': 'Gin',
    'Ice Cold': 'Ice Cold',
    'Liqueur': 'Liqueur',
    'Non-Alcoholic': 'Non-Alcoholic',
    'Beers': 'Beers',
    'Classics': 'Classics',
    'Packages': 'Packages',
    'Games': 'Games',
};

/** Safe visible bucket for a category the map doesn't recognize (never drop an item). */
const FALLBACK_SUB = 'Bar Chows';

/** Resolve a raw sheet category to its (group, sub-tab). Never throws. */
export function classifyFunRoofCategory(category: string): { group: FunRoofGroup; subcategory: string } {
    const sub = CATEGORY_TO_SUB[(category ?? '').trim()] ?? FALLBACK_SUB;
    const group = SUBCATEGORY_GROUP.get(sub) ?? 'Food';
    return { group, subcategory: sub };
}

/** Map one snapshot record to a UI FunRoofItem (field-whitelisted). */
export function mapFunRoofRecord(rec: FunRoofMenuRecord): FunRoofItem {
    const { group, subcategory } = classifyFunRoofCategory(rec.category);
    const item: FunRoofItem = {
        id: rec.id,
        name: rec.name,
        group,
        category: subcategory,
        sellingPrice: rec.sellingPrice,
        bestSeller: typeof rec.tag === 'string' && /bestseller/i.test(rec.tag),
        isAvailable: true,
    };
    if (typeof rec.description === 'string' && rec.description.trim() !== '') item.description = rec.description;
    if (typeof rec.serving === 'string' && rec.serving.trim() !== '') item.serving = rec.serving;
    if (typeof rec.tag === 'string' && rec.tag.trim() !== '') item.tag = rec.tag;
    const image = funRoofImageFor(rec.id);
    if (image) item.imageUrl = image;
    return item;
}

/**
 * The Fun Roof menu, mapped for the UI. Single data entry point for the view —
 * swap the snapshot for a live b1 read here later with no change to the view.
 */
export function loadFunRoofMenu(records: FunRoofMenuRecord[] = FUN_ROOF_MENU_SNAPSHOT): FunRoofItem[] {
    return records.map(mapFunRoofRecord);
}
