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
    { key: 'Drinks', subcategories: ['Classics', 'Beers', 'Whiskey', 'Tequila', 'Rum', 'Gin', 'Vodka', 'Liqueur', 'Brandy & Cognac', 'Ice Cold', 'Non-Alcoholic'] },
    { key: 'Food', subcategories: ['Bestsellers', 'Pizza', 'Bar Chows', 'Add-ons'] },
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
    'Add Ons': 'Add-ons',
    'Whiskey': 'Whiskey',
    'Vodka': 'Vodka',
    'Tequila/Mescal': 'Tequila',
    'Rum': 'Rum',
    'Gin': 'Gin',
    'Ice Cold': 'Ice Cold',
    'Liqueur': 'Liqueur',
    'Brandy & Cognac': 'Brandy & Cognac',
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
 * Presentation order: within each sub-tab (the group+category the view filters by),
 * items that HAVE an image float to the top and items without stay below — each half
 * keeping its original relative order (STABLE). This is a pure re-order only: no item
 * is added, dropped, renamed, re-priced, or moved to another category, and the fixed
 * nav still owns group/section order. Keyed on group+category so it matches exactly
 * what the customer sees per tab (categories are unique per group, so this can never
 * merge two tabs). "Has image" = the mapper set imageUrl from funRoofMenuImages.ts.
 */
export function orderFunRoofItemsImageFirst(items: FunRoofItem[]): FunRoofItem[] {
    const keyOrder: string[] = []; // sub-tab keys in first-appearance order (category order preserved)
    const withImage = new Map<string, FunRoofItem[]>();
    const withoutImage = new Map<string, FunRoofItem[]>();
    for (const it of items) {
        const key = `${it.group} ${it.category}`;
        if (!withImage.has(key)) { withImage.set(key, []); withoutImage.set(key, []); keyOrder.push(key); }
        (it.imageUrl ? withImage.get(key)! : withoutImage.get(key)!).push(it);
    }
    const out: FunRoofItem[] = [];
    for (const key of keyOrder) out.push(...withImage.get(key)!, ...withoutImage.get(key)!);
    return out;
}

/**
 * QR-ONLY exclusion list (owner request, 2026-07-11). Items pulled from the
 * customer-facing Fun Roof QR menu ONLY — they remain in POS, inventory, reports,
 * and historical orders, which read their own sources and never this snapshot.
 * Matched by NORMALIZED NAME so the removal survives a snapshot regen (the sheet's
 * row ids can shift when rows change; the item name is the stable, owner-facing
 * key). To restore an item, delete its name here (or remove the sheet row).
 */
const QR_MENU_EXCLUDED_NAMES: ReadonlySet<string> = new Set([
    // Empty since 2026-07-16: the owner's APPROVED FINAL MENU sheet became the
    // snapshot source, and the previously excluded items (Seattle Dog, Wagyu
    // Onigiri) are no longer in it at all. The mechanism stays for future use.
]);

/** True when a snapshot record is hidden from the customer QR menu (QR-only). */
export function isExcludedFromFunRoofQrMenu(name: string): boolean {
    return QR_MENU_EXCLUDED_NAMES.has((name ?? '').trim().toLowerCase());
}

/**
 * The Fun Roof menu, mapped for the UI. Single data entry point for the view —
 * swap the snapshot for a live b1 read here later with no change to the view.
 * The QR-only exclusion list is applied first (customer menu only), then items
 * with images are surfaced first within each sub-tab (pure presentation).
 */
export function loadFunRoofMenu(records: FunRoofMenuRecord[] = FUN_ROOF_MENU_SNAPSHOT): FunRoofItem[] {
    const visible = records.filter(rec => !isExcludedFromFunRoofQrMenu(rec.name));
    return orderFunRoofItemsImageFirst(visible.map(mapFunRoofRecord));
}
