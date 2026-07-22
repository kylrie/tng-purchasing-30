// Deterministic tests for POS available-first menu ordering.
// Run with: npx tsx --test src/features/pos/utils/menuSort.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOutOfStock, sortByAvailability } from './menuSort';

type Item = { id: string; name: string };
const items: Item[] = [
    { id: 'a', name: 'Adobo' },       // in stock (5)
    { id: 'b', name: 'Beer' },        // OUT (0)
    { id: 'c', name: 'Calamares' },   // unlimited (no entry)
    { id: 'd', name: 'Daiquiri' },    // OUT (-2, negative)
    { id: 'e', name: 'Egg' },         // in stock (1)
];
const stock = new Map<string, number>([
    ['a', 5],
    ['b', 0],
    ['d', -2],
    ['e', 1],
    // 'c' intentionally absent → unlimited
]);

test('isOutOfStock: only a known quantity <= 0 counts as out of stock', () => {
    assert.equal(isOutOfStock('a', stock), false); // 5
    assert.equal(isOutOfStock('b', stock), true);  // 0
    assert.equal(isOutOfStock('d', stock), true);  // -2
    assert.equal(isOutOfStock('c', stock), false); // absent → unlimited
    assert.equal(isOutOfStock('x', stock), false); // unknown id → not restricted
    assert.equal(isOutOfStock('a', undefined), false); // no map → never out of stock
});

test('sortByAvailability: available items come first, out-of-stock last', () => {
    const sorted = sortByAvailability(items, stock);
    assert.deepEqual(sorted.map(i => i.id), ['a', 'c', 'e', 'b', 'd']);
    // every available id precedes every out-of-stock id
    const firstOut = sorted.findIndex(i => isOutOfStock(i.id, stock));
    const lastIn = sorted.map(i => isOutOfStock(i.id, stock)).lastIndexOf(false);
    assert.ok(lastIn < firstOut, 'all available precede all out-of-stock');
});

test('sortByAvailability: preserves the incoming order WITHIN each group (stable)', () => {
    const sorted = sortByAvailability(items, stock);
    // available group keeps a,c,e (original relative order); out group keeps b,d
    assert.deepEqual(sorted.filter(i => !isOutOfStock(i.id, stock)).map(i => i.id), ['a', 'c', 'e']);
    assert.deepEqual(sorted.filter(i => isOutOfStock(i.id, stock)).map(i => i.id), ['b', 'd']);
});

test('sortByAvailability: deterministic — same input yields the same output every call', () => {
    const a = sortByAvailability(items, stock);
    const b = sortByAvailability(items, stock);
    assert.deepEqual(a.map(i => i.id), b.map(i => i.id));
    // idempotent: sorting an already-sorted list changes nothing
    const twice = sortByAvailability(a, stock);
    assert.deepEqual(twice.map(i => i.id), a.map(i => i.id));
});

test('sortByAvailability: no stock map → original order preserved, no reordering', () => {
    const sorted = sortByAvailability(items, undefined);
    assert.deepEqual(sorted.map(i => i.id), items.map(i => i.id));
});

test('sortByAvailability: does not mutate the input array', () => {
    const input = [...items];
    const snapshot = input.map(i => i.id);
    sortByAvailability(input, stock);
    assert.deepEqual(input.map(i => i.id), snapshot);
});
