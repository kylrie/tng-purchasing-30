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
