// Deterministic tests for the shared QR operations nav-badge counts.
// Run with: npx tsx --test src/features/qr-ordering/ops/opsNavCounts.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opsNavCounts } from './opsNavCounts';
import type { OpsOrder } from '../services/qrOrders.service';

const NOW = 1_000_000_000_000;
const minsAgo = (m: number) => NOW - m * 60_000;

// Minimal OpsOrder factory (only the fields the count rules read).
function order(partial: Partial<OpsOrder>): OpsOrder {
    return {
        id: 'x', orderNumber: 'QR-1', tableNumber: '1', businessUnitId: 'b3',
        status: 'PAID', paymentStatus: 'PAID', items: [], itemCount: 0,
        subtotal: 0, taxAmount: 0, totalAmount: 0, currency: 'PHP',
        createdAtMillis: NOW, updatedAtMillis: NOW, paidAtMillis: NOW, releasedAtMillis: null,
        statusEnteredAtMillis: NOW, statusHistory: [],
        ...partial,
    } as OpsOrder;
}
// isDrinkCategory matches the FINE Drinks subcategories (Beer/Soft Drinks/…). The
// coarse real category "Beverages" is NOT matched — this mirrors the QR Kitchen/Bar
// board's existing behavior, so the badges stay consistent with the boards.
const food = { name: 'Sisig', qty: 1, unitPrice: 0, subtotal: 0, category: 'Mains' };
const drink = { name: 'Beer', qty: 1, unitPrice: 0, subtotal: 0, category: 'Beer' };

test('empty feed → all zero', () => {
    assert.deepEqual(opsNavCounts([], NOW), { awaiting: 0, live: 0, kitchen: 0, bar: 0, attention: 0 });
});

test('awaiting + live counts', () => {
    const orders = [
        order({ status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID', statusEnteredAtMillis: NOW }),
        order({ status: 'PAID', statusEnteredAtMillis: NOW }),
        order({ status: 'COMPLETED', statusEnteredAtMillis: NOW }), // not live
    ];
    const c = opsNavCounts(orders, NOW);
    assert.equal(c.awaiting, 1);
    assert.equal(c.live, 2); // AWAITING_PAYMENT + PAID are active; COMPLETED is not
});

test('kitchen/bar count kitchen-lane orders by food/drink lines', () => {
    const orders = [
        order({ status: 'PAID', items: [food, drink] }),         // both kitchen + bar
        order({ status: 'IN_KITCHEN', items: [food] }),          // kitchen only
        order({ status: 'READY', items: [drink] }),              // bar only
        order({ status: 'AWAITING_PAYMENT', items: [food] }),    // NOT on a kitchen lane → neither
        order({ status: 'COMPLETED', items: [food, drink] }),    // not a lane
    ];
    const c = opsNavCounts(orders, NOW);
    assert.equal(c.kitchen, 2); // PAID(food) + IN_KITCHEN(food)
    assert.equal(c.bar, 2);     // PAID(drink) + READY(drink)
});

test('a fine drink category (Beer) counts as bar, not kitchen', () => {
    const c = opsNavCounts([order({ status: 'PAID', items: [drink] })], NOW);
    assert.equal(c.bar, 1);
    assert.equal(c.kitchen, 0);
});

test('attention: a PAID order sitting past the warn threshold counts', () => {
    const orders = [
        order({ status: 'PAID', statusEnteredAtMillis: minsAgo(6) }),  // > paidUnacceptedWarn(5) → warn
        order({ status: 'PAID', statusEnteredAtMillis: minsAgo(1) }),  // fresh → none
    ];
    assert.equal(opsNavCounts(orders, NOW).attention, 1);
});

test('deterministic — same input yields same counts', () => {
    const orders = [order({ status: 'PAID', items: [food] }), order({ status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID' })];
    assert.deepEqual(opsNavCounts(orders, NOW), opsNavCounts(orders, NOW));
});
