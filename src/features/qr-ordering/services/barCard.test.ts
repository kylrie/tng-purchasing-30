// Deterministic tests for the Bar-board card mapping (pure, firebase-free).
// Run: npx tsx --test src/features/qr-ordering/services/barCard.test.ts
//
// Guards the P0 fix: The Fun Roof (b1) fine drink sections are recognized as drinks
// and appear on the Bar board (previously they were missed → bar stayed empty).
// The bar shows DRINK lines only; a mixed order flags that food is in the kitchen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBarCard, barLaneFor, type RawQrOrderDoc } from './barCard';

const NOW = 1_000_000_000_000;
const ts = (millis: number) => ({ toMillis: () => millis });

const sisig = { productName: 'Pork Sisig', quantity: 1, category: 'The Fun Roof Bestsellers' };
const margarita = { productName: 'Classic Margarita', quantity: 1, category: 'Classics' };
const water = { productName: 'Bottled Water', quantity: 1, category: 'Non-Alcoholic' };

test('barLaneFor maps only paid bar statuses', () => {
    assert.equal(barLaneFor('PAID'), 'paid');
    assert.equal(barLaneFor('IN_BAR'), 'mixing');
    assert.equal(barLaneFor('READY'), 'ready');
    assert.equal(barLaneFor('AWAITING_PAYMENT'), null);
    assert.equal(barLaneFor('IN_KITCHEN'), null);
    assert.equal(barLaneFor('COMPLETED'), null);
});

test('every b1 drink section produces a bar card', () => {
    const sections = [
        'Beers', 'Ice Cold', 'Non-Alcoholic', 'Classics', 'Whiskey', 'Tequila/Mescal',
        'Rum', 'Gin', 'Vodka', 'Liqueur', 'Brandy & Cognac',
    ];
    for (const category of sections) {
        const doc: RawQrOrderDoc = { id: 'x', status: 'PAID', items: [{ productName: 'Drink', quantity: 1, category }], createdAt: ts(NOW) };
        const card = toBarCard(doc, NOW);
        assert.ok(card, `${category} should appear on the bar`);
        assert.equal(card!.lines.length, 1);
        assert.equal(card!.hasFoodInKitchen, false);
    }
});

test('food-only order → NO bar card', () => {
    const doc: RawQrOrderDoc = { id: 'o1', status: 'PAID', items: [sisig], createdAt: ts(NOW) };
    assert.equal(toBarCard(doc, NOW), null);
});

test('MIXED order → bar card carries ONLY drink lines + flags food in kitchen', () => {
    // 1× Pork Sisig (food) · 1× Classic Margarita (drink) · 1× Bottled Water (drink)
    const doc: RawQrOrderDoc = { id: 'o2', orderNumber: 'QR-3', tableNumber: '3', status: 'PAID', items: [sisig, margarita, water], createdAt: ts(NOW) };
    const card = toBarCard(doc, NOW);
    assert.ok(card);
    const names = card!.lines.map(l => l.name);
    assert.deepEqual(names, ['Classic Margarita', 'Bottled Water']); // both drink lines present, in order
    assert.ok(!names.includes('Pork Sisig'));                        // no food line in bar
    assert.equal(card!.hasFoodInKitchen, true);
    assert.equal(card!.orderNumber, 'QR-3'); // same order number as the kitchen side
    assert.equal(card!.tableNumber, '3');    // same table
});
