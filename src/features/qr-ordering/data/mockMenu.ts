// QR Ordering — Customer Menu MOCK DATA (Phase 1 UI prototype)
// Per docs/QR_SCREEN_SPEC.md §1: mock only — no Firebase reads/writes, no backend.
// Shape mirrors the sanitized projection getPublicMenu() will return later
// (name, group, category, price, image, availability — NEVER cost/margin/recipe).

export type MenuGroup = 'Food' | 'Drinks';

export interface PublicMenuItem {
    id: string;
    name: string;
    group: MenuGroup;
    /** Level-2 category (subcategory) within the group. */
    category: string;
    sellingPrice: number;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
    /** Highlighted with a "Best seller" tag on the card. */
    bestSeller?: boolean;
}

export interface MockTableSession {
    tableNumber: string;
    businessUnitName: string;
}

export const MOCK_TABLE: MockTableSession = {
    tableNumber: '12',
    businessUnitName: 'Inflatable Island Beach Club',
};

/** Two-level category hierarchy (approved design). */
export const MENU_GROUPS: { key: MenuGroup; subcategories: string[] }[] = [
    { key: 'Food', subcategories: ['Appetizers', 'Mains', 'Sharing Plates', 'Desserts'] },
    { key: 'Drinks', subcategories: ['Soft Drinks', 'Fresh Juice', 'Cocktails', 'Beer', 'Coffee'] },
];

export const MOCK_MENU_ITEMS: PublicMenuItem[] = [
    // ── Food · Appetizers ───────────────────────────────────────────────
    { id: 'ib-sisig', name: 'Sisig', group: 'Food', category: 'Appetizers', sellingPrice: 285, description: 'Sizzling pork sisig with onions and chili', imageUrl: '/menu/sisig.jpg', isAvailable: true, bestSeller: true },
    { id: 'ib-lechon', name: 'Lechon Kawali', group: 'Food', category: 'Appetizers', sellingPrice: 285, description: 'Crispy pork belly served with liver sauce', imageUrl: '/menu/lechon.jpg', isAvailable: true },
    { id: 'ib-calamares', name: 'Calamares', group: 'Food', category: 'Appetizers', sellingPrice: 260, description: 'Crispy fried squid served with spicy mayo', imageUrl: '/menu/calamares.jpg', isAvailable: true },
    { id: 'ib-lumpia', name: 'Lumpia', group: 'Food', category: 'Appetizers', sellingPrice: 220, description: 'Crispy vegetable spring rolls with sweet chili sauce', imageUrl: '/menu/lumpia.jpg', isAvailable: true },

    // ── Food · Mains ────────────────────────────────────────────────────
    { id: 'ib-inasal', name: 'Chicken Inasal', group: 'Food', category: 'Mains', sellingPrice: 260, description: 'Charcoal-grilled chicken with annatto butter and garlic rice', isAvailable: true },
    { id: 'ib-pancit', name: 'Pancit Canton', group: 'Food', category: 'Mains', sellingPrice: 240, description: 'Stir-fried noodles with pork, shrimp and vegetables', isAvailable: true },
    { id: 'ib-bangus', name: 'Grilled Bangus', group: 'Food', category: 'Mains', sellingPrice: 320, description: 'Whole milkfish grilled with tomatoes and onions', isAvailable: true },
    { id: 'ib-karekare', name: 'Kare-Kare', group: 'Food', category: 'Mains', sellingPrice: 465, description: 'Oxtail in peanut sauce with bagoong on the side', isAvailable: false },

    // ── Food · Sharing Plates ───────────────────────────────────────────
    { id: 'ib-boodle', name: 'Seafood Boodle Feast', group: 'Food', category: 'Sharing Plates', sellingPrice: 1200, description: 'Shrimp, crab, mussels and rice, spread for the whole table', isAvailable: true, bestSeller: true },
    { id: 'ib-pata', name: 'Crispy Pata', group: 'Food', category: 'Sharing Plates', sellingPrice: 780, description: 'Deep-fried pork knuckle with soy-vinegar dip', isAvailable: true },

    // ── Food · Desserts ─────────────────────────────────────────────────
    { id: 'ib-halohalo', name: 'Halo-Halo Supreme', group: 'Food', category: 'Desserts', sellingPrice: 185, description: 'Shaved ice, ube, leche flan and sweet beans', isAvailable: true },
    { id: 'ib-flan', name: 'Leche Flan', group: 'Food', category: 'Desserts', sellingPrice: 120, description: 'Silky caramel custard', isAvailable: true },
    { id: 'ib-turon', name: 'Turon à la Mode', group: 'Food', category: 'Desserts', sellingPrice: 150, description: 'Caramelized banana rolls with vanilla ice cream', isAvailable: true },

    // ── Drinks · Soft Drinks ────────────────────────────────────────────
    { id: 'ib-icedtea', name: 'House Iced Tea', group: 'Drinks', category: 'Soft Drinks', sellingPrice: 95, description: 'Freshly brewed, calamansi-infused', isAvailable: true },
    { id: 'ib-softdrink', name: 'Soft Drinks', group: 'Drinks', category: 'Soft Drinks', sellingPrice: 70, description: 'Chilled bottle, ice on the side', isAvailable: true },

    // ── Drinks · Fresh Juice ────────────────────────────────────────────
    { id: 'ib-buko', name: 'Fresh Buko Juice', group: 'Drinks', category: 'Fresh Juice', sellingPrice: 120, description: 'Young coconut, served in the shell', isAvailable: true, bestSeller: true },
    { id: 'ib-mangoshake', name: 'Mango Shake', group: 'Drinks', category: 'Fresh Juice', sellingPrice: 150, description: 'Carabao mango, blended fresh', isAvailable: true },

    // ── Drinks · Cocktails ──────────────────────────────────────────────
    { id: 'ib-mojito', name: 'Classic Mojito', group: 'Drinks', category: 'Cocktails', sellingPrice: 240, description: 'White rum, mint, lime and soda', isAvailable: true },
    { id: 'ib-daiquiri', name: 'Mango Rum Daiquiri', group: 'Drinks', category: 'Cocktails', sellingPrice: 260, description: 'Carabao mango, aged rum and lime', isAvailable: false },

    // ── Drinks · Beer ───────────────────────────────────────────────────
    { id: 'ib-sanmig', name: 'San Miguel Pale Pilsen', group: 'Drinks', category: 'Beer', sellingPrice: 110, description: 'Ice cold, 330ml bottle', isAvailable: true },
    { id: 'ib-bucket', name: 'Beach Beer Bucket', group: 'Drinks', category: 'Beer', sellingPrice: 500, description: 'Bucket of five ice-cold local beers', isAvailable: true, bestSeller: true },

    // ── Drinks · Coffee ─────────────────────────────────────────────────
    { id: 'ib-barako', name: 'Barako Coffee', group: 'Drinks', category: 'Coffee', sellingPrice: 110, description: 'Strong local brew, hot or iced', isAvailable: true },
];
