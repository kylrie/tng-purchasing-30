/**
 * Unit tests — durable print-job logic. Pure, no I/O. Proves job docs are built
 * with the right idempotency keys, station-filtered lines, and metadata.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialJobKey, buildInitialPrintJobs } from '../printJobLogic';

test('initialJobKey is a stable, collision-free doc id', () => {
    assert.equal(initialJobKey('abc', 'KITCHEN'), 'abc:KITCHEN:INITIAL');
    assert.equal(initialJobKey('abc', 'BAR'), 'abc:BAR:INITIAL');
});

test('mixed order → one job per station, station-filtered lines', () => {
    const jobs = buildInitialPrintJobs('o1', {
        businessUnitId: 'b3', orderNumber: 'QR-00001', tableNumber: '5',
        items: [
            { productName: 'Sisig', quantity: 1, category: 'Appetizers' },
            { productName: 'San Miguel', quantity: 2, category: 'Beverages', notes: 'cold' },
        ],
    });
    assert.equal(jobs.length, 2);
    const kitchen = jobs.find(j => j.station === 'KITCHEN')!;
    const bar = jobs.find(j => j.station === 'BAR')!;

    assert.equal(kitchen.id, 'o1:KITCHEN:INITIAL');
    assert.equal(kitchen.idempotencyKey, 'o1:KITCHEN:INITIAL');
    assert.equal(kitchen.orderId, 'o1');
    assert.equal(kitchen.businessUnitId, 'b3');
    assert.equal(kitchen.displayOrderNumber, 'QR-00001');
    assert.equal(kitchen.tableNumber, '5');
    assert.equal(kitchen.status, 'PENDING');
    assert.equal(kitchen.attemptCount, 0);
    assert.equal(kitchen.lastError, null);
    assert.equal(kitchen.printerTarget, null);
    assert.equal(kitchen.paid, true);
    assert.equal(kitchen.kind, 'INITIAL');
    assert.deepEqual(kitchen.lines, [{ qty: 1, name: 'Sisig' }]);
    assert.deepEqual(kitchen.notes, []);

    assert.deepEqual(bar.lines, [{ qty: 2, name: 'San Miguel', note: 'cold' }]);
    assert.deepEqual(bar.notes, ['cold']);
});

test('food-only order → only a KITCHEN job; drinks-only → only a BAR job', () => {
    const food = buildInitialPrintJobs('f', { items: [{ productName: 'Pancit', quantity: 1, category: 'Mains' }] });
    assert.deepEqual(food.map(j => j.station), ['KITCHEN']);

    const drink = buildInitialPrintJobs('d', { items: [{ productName: 'Mojito', quantity: 1, category: 'Cocktails' }] });
    assert.deepEqual(drink.map(j => j.station), ['BAR']);
});

test('b1 (The Fun Roof): fine drink categories land on the BAR job, food on KITCHEN', () => {
    const jobs = buildInitialPrintJobs('frOrd', {
        businessUnitId: 'b1', orderNumber: 'QR-00099', tableNumber: '3',
        items: [
            { productName: 'PORK SISIG', quantity: 1, category: 'The Fun Roof Bestsellers' },
            { productName: 'JACK DANIELS (Shot)', quantity: 2, category: 'Whiskey' },
            { productName: 'PEPPERONI PIZZA', quantity: 1, category: 'Pizza' },
            { productName: 'AMARETTO SOUR', quantity: 1, category: 'Classics' },
        ],
    });
    assert.equal(jobs.length, 2);
    const kitchen = jobs.find(j => j.station === 'KITCHEN')!;
    const bar = jobs.find(j => j.station === 'BAR')!;
    assert.deepEqual(kitchen.lines.map(l => l.name), ['PORK SISIG', 'PEPPERONI PIZZA']);
    assert.deepEqual(bar.lines.map(l => l.name), ['JACK DANIELS (Shot)', 'AMARETTO SOUR']);
    assert.equal(bar.businessUnitId, 'b1');
});

test('no items → no jobs', () => {
    assert.deepEqual(buildInitialPrintJobs('empty', { items: [] }), []);
    assert.deepEqual(buildInitialPrintJobs('none', {}), []);
});

test('metadata fallbacks: tableNumber → tableId → dash; displayOrderNumber → orderId; qty coerced', () => {
    const jobs = buildInitialPrintJobs('ord9', {
        tableId: 'tbl-xyz', // no tableNumber
        items: [{ productName: 'Sisig', category: 'Appetizers' }], // no quantity
    });
    assert.equal(jobs[0].tableNumber, 'tbl-xyz');
    assert.equal(jobs[0].displayOrderNumber, 'ord9'); // falls back to orderId
    assert.equal(jobs[0].lines[0].qty, 0); // undefined quantity coerced to 0

    const dash = buildInitialPrintJobs('ord10', { items: [{ productName: 'X', quantity: 1, category: 'Mains' }] });
    assert.equal(dash[0].tableNumber, '—'); // neither tableNumber nor tableId
});
