// Deterministic tests for the shared, venue-aware food/drink classifier.
// Run: npx tsx --test src/features/qr-ordering/utils/isDrinkCategory.test.ts
//
// This is the single source of truth the Kitchen board, Bar board, QR Operations
// cards, and nav counts all use. It must recognize The Fun Roof (b1) fine drink
// sections as DRINKS (the production bug: they were treated as food → Kitchen)
// while keeping Inflatable Island (b3) routing unchanged and food the safe default.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDrinkCategory } from './isDrinkCategory';

test('b1 (The Fun Roof) drink sections → drink (bar)', () => {
    for (const cat of [
        'Beers', 'Ice Cold', 'Non-Alcoholic', 'Classics', 'Cocktails', 'Signature Cocktails',
        'Whiskey', 'Tequila', 'Tequila/Mescal', 'Tequila / Mescal', 'Rum', 'Gin', 'Vodka',
        'Liqueur', 'Brandy', 'Cognac', 'Brandy & Cognac', 'Draft Beer', 'Bottled Beer',
    ]) {
        assert.equal(isDrinkCategory(cat), true, `${cat} should be a drink`);
    }
});

test('b1 water items (filed under Non-Alcoholic / Ice Cold) → drink (bar)', () => {
    // Real order lines carry the SECTION as category, not the item name — so a
    // "Bottled Water" line arrives as category "Non-Alcoholic" or "Ice Cold".
    assert.equal(isDrinkCategory('Non-Alcoholic'), true);
    assert.equal(isDrinkCategory('Ice Cold'), true);
    // And if a venue ever files water as its own section, that resolves too.
    assert.equal(isDrinkCategory('Bottled Water'), true);
    assert.equal(isDrinkCategory('Water'), true);
});

test('b1 (The Fun Roof) food / play sections → not a drink (kitchen)', () => {
    for (const cat of [
        'The Fun Roof Bestsellers', 'Pizza', 'Bar Chows', 'Add Ons', 'Add-ons', 'D Chow',
        'Best Sellers', 'Food', 'Mains', 'Packages',
    ]) {
        assert.equal(isDrinkCategory(cat), false, `${cat} should NOT be a drink`);
    }
});

test('b3 (Inflatable Island) fixed subcategories route exactly as before', () => {
    // Drinks
    for (const cat of ['Soft Drinks', 'Fresh Juice', 'Cocktails', 'Beer', 'Coffee']) {
        assert.equal(isDrinkCategory(cat), true, `${cat} should be a drink`);
    }
    // Food
    for (const cat of ['Appetizers', 'Mains', 'Sharing Plates', 'Desserts']) {
        assert.equal(isDrinkCategory(cat), false, `${cat} should NOT be a drink`);
    }
});

test('case-insensitive + whitespace-tolerant', () => {
    assert.equal(isDrinkCategory('  whiskey  '), true);
    assert.equal(isDrinkCategory('CLASSICS'), true);
    assert.equal(isDrinkCategory('tequila/mescal'), true);
    assert.equal(isDrinkCategory('PIZZA'), false);
});

test('unknown categories: clear drink keyword → drink, otherwise food default', () => {
    assert.equal(isDrinkCategory('Wine Selection'), true);   // "wine" hint
    assert.equal(isDrinkCategory('Craft Beer'), true);       // "beer" hint
    assert.equal(isDrinkCategory('House Cocktails'), true);   // "cocktail" hint
    assert.equal(isDrinkCategory('Chef Special'), false);     // no signal → kitchen
    assert.equal(isDrinkCategory(''), false);
    assert.equal(isDrinkCategory(undefined as unknown as string), false);
});

test('short drink section words do NOT collide with food sections', () => {
    // "Rum"/"Gin" are exact drink sections, but their letters must not leak into food.
    assert.equal(isDrinkCategory('Drumsticks'), false); // contains "rum"
    assert.equal(isDrinkCategory('Ginger Chicken'), false); // contains "gin"
    assert.equal(isDrinkCategory('Steak'), false); // contains "tea"
});
