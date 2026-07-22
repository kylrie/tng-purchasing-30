/**
 * Unit tests — station routing (Kitchen vs Bar). Pure, no I/O. Proves the split
 * is correct for BOTH the fine demo subcategories AND real coarse backend
 * categories ("Beverages"/"Mains"), including name-based refinement.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStation, splitByStation } from '../stationRouting';

test('fine demo subcategories route by group', () => {
    assert.equal(classifyStation({ productName: 'Chicken Inasal', category: 'Mains' }), 'KITCHEN');
    assert.equal(classifyStation({ productName: 'Sisig', category: 'Appetizers' }), 'KITCHEN');
    assert.equal(classifyStation({ productName: 'Crispy Pata', category: 'Sharing Plates' }), 'KITCHEN');
    assert.equal(classifyStation({ productName: 'Leche Flan', category: 'Desserts' }), 'KITCHEN');
    assert.equal(classifyStation({ productName: 'Classic Mojito', category: 'Cocktails' }), 'BAR');
    assert.equal(classifyStation({ productName: 'San Miguel', category: 'Beer' }), 'BAR');
    assert.equal(classifyStation({ productName: 'Barako', category: 'Coffee' }), 'BAR');
    assert.equal(classifyStation({ productName: 'Iced Tea', category: 'Soft Drinks' }), 'BAR');
    assert.equal(classifyStation({ productName: 'Buko Juice', category: 'Fresh Juice' }), 'BAR');
});

test('REAL coarse backend categories route correctly (the production case)', () => {
    // BEACHBOSSES stores every drink as "Beverages" and every food item as "Mains".
    assert.equal(classifyStation({ productName: 'San Miguel Pale Pilsen', category: 'Beverages' }), 'BAR');
    assert.equal(classifyStation({ productName: 'Coke', category: 'Beverages' }), 'BAR');
    assert.equal(classifyStation({ productName: 'Chicken Inasal', category: 'Mains' }), 'KITCHEN');
    assert.equal(classifyStation({ productName: 'Pancit Canton', category: 'Mains' }), 'KITCHEN');
});

test('name refinement can flip a mistagged line to the right station', () => {
    // A shake/juice mistagged as 'Mains' is really a drink → BAR.
    assert.equal(classifyStation({ productName: 'Mango Shake', category: 'Mains' }), 'BAR');
    assert.equal(classifyStation({ productName: 'Fresh Buko Juice', category: 'Mains' }), 'BAR');
    // An appetizer mistagged (or coarse 'Mains') by name → still KITCHEN.
    assert.equal(classifyStation({ productName: 'Nacho Melt', category: 'Mains' }), 'KITCHEN');
    assert.equal(classifyStation({ productName: 'Chicken Wings', category: 'Mains' }), 'KITCHEN');
});

test('unknown categories: drink hints → BAR, otherwise safe default KITCHEN', () => {
    assert.equal(classifyStation({ productName: 'House Red', category: 'Wine Selection' }), 'BAR'); // 'wine' hint
    assert.equal(classifyStation({ productName: 'Mystery Platter', category: 'Chef Special' }), 'KITCHEN');
    assert.equal(classifyStation({ productName: '', category: '' }), 'KITCHEN'); // no signal → food default
    assert.equal(classifyStation({}), 'KITCHEN');
});

test('splitByStation buckets lines and preserves order', () => {
    const lines = [
        { productName: 'Chicken Inasal', category: 'Mains' },
        { productName: 'San Miguel', category: 'Beverages' },
        { productName: 'Sisig', category: 'Appetizers' },
        { productName: 'Barako Coffee', category: 'Beverages' },
    ];
    const split = splitByStation(lines);
    assert.deepEqual(split.KITCHEN.map(l => l.productName), ['Chicken Inasal', 'Sisig']);
    assert.deepEqual(split.BAR.map(l => l.productName), ['San Miguel', 'Barako Coffee']);
});

test('splitByStation tolerates a non-array input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const split = splitByStation(undefined as any);
    assert.deepEqual(split, { KITCHEN: [], BAR: [] });
});

// ── The Fun Roof (b1) fine-category routing (P0 fix 2026-07-17) ───────────────
// b1's live menu_items use FINE drink categories (Whiskey, Vodka, …) that the
// generic classifier sends to KITCHEN by default. Passing businessUnitId==='b1'
// forces every Fun Roof drink category to BAR. Uses REAL b1 item names/categories.

test('b1: every Fun Roof spirit / cocktail / beer category routes to BAR', () => {
    const bar = (name: string, category: string) =>
        assert.equal(classifyStation({ productName: name, category }, 'b1'), 'BAR', `${name} (${category})`);
    bar('JACK DANIELS (Shot)', 'Whiskey');
    bar('PATRON SILVER (Shot)', 'Tequila/Mescal');
    bar('BACARDI GOLD (Shot)', 'Rum');
    bar('TANQUERAY DRY (Shot)', 'Gin');
    bar('ABSOLUT BLUE (Shot)', 'Vodka');
    bar('BAILEYS (Shot)', 'Liqueur');
    bar('HENNESSY (Shot)', 'Brandy & Cognac');
    bar('AMARETTO SOUR', 'Classics');
    bar('COSMOPOLITAN', 'Classics');
    bar('WHITE RUSSIAN', 'Classics');
    bar('JAGERMEISTER (Shot)', 'Ice Cold');
    bar('SAN MIG APPLE', 'Beers');
    bar('FR ICED TEA', 'Non-Alcoholic');
});

test('b1: food categories still route to KITCHEN', () => {
    const kitchen = (name: string, category: string) =>
        assert.equal(classifyStation({ productName: name, category }, 'b1'), 'KITCHEN', `${name} (${category})`);
    kitchen('PEPPERONI PIZZA', 'Pizza');
    kitchen('NOT CALAMARI', 'Bar Chows');          // "Bar Chows" = D Chow food, NOT a drink
    kitchen('PORK SISIG', 'The Fun Roof Bestsellers');
    kitchen('STEAMED RICE', 'Add Ons');
    kitchen('CHICKEN TENDERS (BUFFALO)', 'Bar Chows');
});

test('b1: Packages / Play route to KITCHEN (pinned MVP behavior — no split printing)', () => {
    // Packages are Play/games; there is no play print station in the MVP, so they
    // route with the food default. If a package ever bundles drinks, the order-line
    // data does not express that split, so we do NOT invent split printing here.
    assert.equal(classifyStation({ productName: 'UNLI PLAY ALL NIGHT', category: 'Packages' }, 'b1'), 'KITCHEN');
});

test('b1 override is scoped to b1: the SAME fine category is unchanged for b3 / default', () => {
    // Regression guard: a "Whiskey" line under b3 (or with no businessUnitId) keeps
    // the ORIGINAL generic behavior (KITCHEN) — the b1 fix must not leak to b3.
    assert.equal(classifyStation({ productName: 'JACK DANIELS', category: 'Whiskey' }, 'b3'), 'KITCHEN');
    assert.equal(classifyStation({ productName: 'JACK DANIELS', category: 'Whiskey' }), 'KITCHEN');
    // And b3's real coarse categories are still routed correctly under b1 too
    // (generic fallback), so nothing regresses if b1 ever has a coarse line.
    assert.equal(classifyStation({ productName: 'San Miguel', category: 'Beverages' }, 'b1'), 'BAR');
    assert.equal(classifyStation({ productName: 'Chicken Inasal', category: 'Mains' }, 'b1'), 'KITCHEN');
});

test('b1: splitByStation routes a mixed Fun Roof order correctly', () => {
    const lines = [
        { productName: 'PORK SISIG', category: 'The Fun Roof Bestsellers' },
        { productName: 'JACK DANIELS (Shot)', category: 'Whiskey' },
        { productName: 'PEPPERONI PIZZA', category: 'Pizza' },
        { productName: 'AMARETTO SOUR', category: 'Classics' },
    ];
    const split = splitByStation(lines, 'b1');
    assert.deepEqual(split.KITCHEN.map(l => l.productName), ['PORK SISIG', 'PEPPERONI PIZZA']);
    assert.deepEqual(split.BAR.map(l => l.productName), ['JACK DANIELS (Shot)', 'AMARETTO SOUR']);
});
