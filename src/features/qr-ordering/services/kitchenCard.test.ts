// Deterministic tests for the Kitchen-board card mapping (pure, firebase-free).
// Run: npx tsx --test src/features/qr-ordering/services/kitchenCard.test.ts
//
// Guards the P0 fix: the Kitchen board shows FOOD lines only. Drinks route to the
// bar; a drinks-only order produces NO kitchen card; a mixed order shows only its
// food lines here and flags that drinks are at the bar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toKitchenCard, kitchenLaneFor, type RawQrOrderDoc } from './kitchenCard';

const NOW = 1_000_000_000_000;
const ts = (millis: number) => ({ toMillis: () => millis });

// Real Fun Roof (b1) categories as they arrive on order lines (menu_items.category).
const sisig = { productName: 'Pork Sisig', quantity: 1, category: 'The Fun Roof Bestsellers' };
const pizza = { productName: 'Pepperoni Pizza', quantity: 1, category: 'Pizza' };
const margarita = { productName: 'Classic Margarita', quantity: 1, category: 'Classics' };
const water = { productName: 'Bottled Water', quantity: 1, category: 'Non-Alcoholic' };

test('kitchenLaneFor maps only paid kitchen statuses', () => {
    assert.equal(kitchenLaneFor('PAID'), 'paid');
    assert.equal(kitchenLaneFor('IN_KITCHEN'), 'preparing');
    assert.equal(kitchenLaneFor('READY'), 'ready');
    assert.equal(kitchenLaneFor('AWAITING_PAYMENT'), null);
    assert.equal(kitchenLaneFor('IN_BAR'), null);
    assert.equal(kitchenLaneFor('COMPLETED'), null);
});

test('food-only order → kitchen card with all food lines, no drinks-at-bar flag', () => {
    const doc: RawQrOrderDoc = { id: 'o1', orderNumber: 'QR-1', tableNumber: '3', status: 'PAID', items: [sisig, pizza], createdAt: ts(NOW) };
    const card = toKitchenCard(doc, NOW);
    assert.ok(card);
    assert.deepEqual(card!.lines.map(l => l.name), ['Pork Sisig', 'Pepperoni Pizza']);
    assert.equal(card!.hasDrinksAtBar, false);
});

test('drinks-only order → NO kitchen card (routes entirely to the bar)', () => {
    const doc: RawQrOrderDoc = { id: 'o2', orderNumber: 'QR-2', tableNumber: '3', status: 'PAID', items: [margarita, water], createdAt: ts(NOW) };
    assert.equal(toKitchenCard(doc, NOW), null);
});

test('MIXED order → kitchen card carries ONLY food lines + flags drinks at bar', () => {
    // 1× Pork Sisig (food) · 1× Classic Margarita (drink) · 1× Bottled Water (drink)
    const doc: RawQrOrderDoc = { id: 'o3', orderNumber: 'QR-3', tableNumber: '3', status: 'PAID', items: [sisig, margarita, water], createdAt: ts(NOW) };
    const card = toKitchenCard(doc, NOW);
    assert.ok(card);
    const names = card!.lines.map(l => l.name);
    assert.deepEqual(names, ['Pork Sisig']);          // food line present
    assert.ok(!names.includes('Classic Margarita'));  // no drink line in kitchen
    assert.ok(!names.includes('Bottled Water'));      // no drink line in kitchen
    assert.equal(card!.hasDrinksAtBar, true);
});

test('non-kitchen status or no food → null; order number + table preserved otherwise', () => {
    assert.equal(toKitchenCard({ id: 'o4', status: 'AWAITING_PAYMENT', items: [sisig] }, NOW), null);
    const card = toKitchenCard({ id: 'o5', orderNumber: 'QR-5', tableNumber: '7', status: 'READY', items: [sisig], createdAt: ts(NOW) }, NOW);
    assert.equal(card!.orderNumber, 'QR-5');
    assert.equal(card!.tableNumber, '7');
    assert.equal(card!.lane, 'ready');
});
