// QR Ordering — the single, venue-aware food/drink split used by the bar board,
// the kitchen board, the QR Operations cards, and the operations nav counts.
//
// WHY this is more than a fixed-list check: a real order line's `category` is the
// RAW `menu_items.category` (see functions/src/qr/orderLogic.ts → repriceLine),
// i.e. the venue's OWN menu-section name. The Fun Roof (b1) files every drink under
// a fine spirit/section category — "Whiskey", "Tequila/Mescal", "Rum", "Gin",
// "Vodka", "Liqueur", "Brandy & Cognac", "Classics", "Beers", "Ice Cold",
// "Non-Alcoholic" — none of which are the fixed Inflatable Island (b3) Drinks
// subcategories. The old check matched ONLY those fixed five, so EVERY Fun Roof
// drink failed the drink test: the bar board showed nothing and (together with the
// kitchen board's missing food filter) every drink landed in the Kitchen.
//
// This classifier recognizes the real venue drink sections (exact, case-insensitive)
// plus a conservative drink-keyword layer for unseen sections, so the dashboards
// route drinks to the Bar for BOTH venues. Food stays the safe default.
//
// Kept firebase-free (pure) so it is unit-testable and importable from pure modules
// without dragging in the Firebase client init. KEEP the drink rules aligned with
// the print-side router (functions/src/qr/stationRouting.ts) and the customer-menu
// mapper (services/publicMenu.mapper.ts) so print tickets and dashboard lanes agree.

/**
 * Canonical drink categories/sections seen (or plausibly seen) in real order lines
 * (`menu_items.category`), matched case-insensitively after trimming. Covers the
 * fixed Inflatable Island (b3) Drinks subcategories AND every Fun Roof (b1) drink
 * section, plus common spelling/spacing variants. Exact-match only — never a
 * substring — so short, ambiguous section words (Rum, Gin) can't collide with food.
 */
const DRINK_CATEGORIES: ReadonlySet<string> = new Set(
    [
        // Inflatable Island (b3) — fixed Drinks subcategories
        'Soft Drinks', 'Fresh Juice', 'Cocktails', 'Beer', 'Coffee',
        // The Fun Roof (b1) — raw sheet drink sections (source of truth: funRoofMenu.ts)
        'Classics', 'Beers', 'Whiskey', 'Vodka', 'Tequila/Mescal', 'Rum', 'Gin',
        'Ice Cold', 'Liqueur', 'Brandy & Cognac', 'Non-Alcoholic',
        // Defensive variants (spelling / spacing / future sections)
        'Signature Cocktails', 'Signature Cocktail', 'Cocktail', 'Tequila', 'Tequila / Mescal',
        'Mescal', 'Mezcal', 'Brandy', 'Cognac', 'Brandy and Cognac', 'Draft Beer', 'Draught Beer',
        'Bottled Beer', 'Non Alcoholic', 'Soft Drink', 'Juice', 'Juices', 'Shakes', 'Smoothies',
        'Wine', 'Wines', 'Tea', 'Coffee & Tea', 'Coffee and Tea',
        'Water', 'Bottled Water', 'Still Water', 'Sparkling Water', 'Mineral Water',
    ].map(s => s.trim().toLowerCase()),
);

/**
 * Conservative substring hints for an unrecognized section that is CLEARLY a drink
 * (task rule: "any category clearly drink/beverage/alcohol"). Every token is long
 * and unambiguous enough not to appear inside a plausible FOOD section name — short
 * collision-prone words (rum → "drumsticks", gin → "ginger", tea → "steak", ale →
 * "tamales") are deliberately excluded and handled by the exact set above instead.
 */
const DRINK_KEYWORD_HINTS: readonly string[] = [
    'drink', 'beverage', 'beer', 'wine', 'cocktail', 'mocktail', 'coffee', 'juice',
    'soda', 'shake', 'smoothie', 'spirit', 'liquor', 'alcohol', 'lemonade', 'frappe',
    'latte', 'espresso', 'whiskey', 'whisky', 'tequila', 'mezcal', 'mescal', 'vodka',
    'brandy', 'cognac', 'liqueur', 'margarita', 'martini', 'mojito', 'daiquiri',
    'negroni', 'champagne', 'prosecco', 'lager', 'pilsen', 'bourbon', 'scotch',
    'sangria', 'highball', 'draught',
];

/**
 * True when a menu-item category belongs to the bar (a drink). Pure/testable.
 * Order: exact section match → clear drink-keyword hint → false (food default).
 */
export function isDrinkCategory(category: string): boolean {
    const normalized = (typeof category === 'string' ? category : '').trim().toLowerCase();
    if (normalized === '') return false;
    if (DRINK_CATEGORIES.has(normalized)) return true;
    return DRINK_KEYWORD_HINTS.some(hint => normalized.includes(hint));
}
