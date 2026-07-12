// Pure tests for the table active-order summary helpers. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    activeOrdersForTable, summarizeItems, formatMoney, elapsedLabel, type TableOrderLite,
} from './tableOrderSummary';

const o = (over: Partial<TableOrderLite>): TableOrderLite => ({
    id: 'id', orderNumber: 'QR-00001', tableId: 't1', tableNumber: '1',
    status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID', items: [], totalAmount: 0,
    currency: 'PHP', createdAtMillis: 0, ...over,
});

test('activeOrdersForTable: matches by tableId and filters non-active + other tables', () => {
    const orders = [
        o({ id: 'a', tableId: 't1', tableNumber: '1', status: 'AWAITING_PAYMENT', createdAtMillis: 100 }),
        o({ id: 'b', tableId: 't2', tableNumber: '2', status: 'PAID', createdAtMillis: 200 }),        // other table
        o({ id: 'c', tableId: 't1', tableNumber: '1', status: 'COMPLETED', createdAtMillis: 300 }),   // not active
        o({ id: 'd', tableId: 't1', tableNumber: '1', status: 'PAID', createdAtMillis: 400 }),
    ];
    const res = activeOrdersForTable(orders, 't1', '1');
    assert.deepEqual(res.map(r => r.id), ['d', 'a']); // active + table t1, latest-created first
});

test('activeOrdersForTable: falls back to tableNumber when tableId absent/mismatched', () => {
    const orders = [
        o({ id: 'a', tableId: undefined, tableNumber: '2', status: 'IN_KITCHEN', createdAtMillis: 10 }),
        o({ id: 'b', tableId: 'other', tableNumber: '2', status: 'READY', createdAtMillis: 20 }),
    ];
    // tableId 'x' won't match, but tableNumber '2' does for both
    const res = activeOrdersForTable(orders, 'x', '2');
    assert.deepEqual(res.map(r => r.id), ['b', 'a']);
});

test('activeOrdersForTable: no matches → empty', () => {
    const orders = [o({ id: 'a', tableId: 't9', tableNumber: '9', status: 'PAID' })];
    assert.deepEqual(activeOrdersForTable(orders, 't1', '1'), []);
});

test('summarizeItems: at or under the limit shows all, no "more"', () => {
    const s = summarizeItems([{ name: 'Water', qty: 1 }, { name: 'Amaretto Sour', qty: 2 }], 3);
    assert.deepEqual(s.lines.map(l => l.name), ['Water', 'Amaretto Sour']);
    assert.equal(s.moreLines, 0);
    assert.equal(s.moreQty, 0);
});

test('summarizeItems: over the limit truncates and counts hidden lines + qty', () => {
    const items = [
        { name: 'A', qty: 1 }, { name: 'B', qty: 2 }, { name: 'C', qty: 1 },
        { name: 'D', qty: 3 }, { name: 'E', qty: 1 },
    ];
    const s = summarizeItems(items, 3);
    assert.deepEqual(s.lines.map(l => l.name), ['A', 'B', 'C']);
    assert.equal(s.moreLines, 2);      // D, E hidden
    assert.equal(s.moreQty, 4);        // 3 + 1
});

test('summarizeItems: undefined/empty is safe', () => {
    assert.deepEqual(summarizeItems(undefined), { lines: [], moreLines: 0, moreQty: 0 });
});

test('formatMoney: whole pesos have no decimals; fractional shows 2', () => {
    assert.equal(formatMoney(1235), '₱1,235');
    assert.equal(formatMoney(85), '₱85');
    assert.equal(formatMoney(1234.5), '₱1,234.50');
    assert.equal(formatMoney(NaN), '₱0');
});

test('elapsedLabel: sub-minute, minutes, and hours', () => {
    assert.equal(elapsedLabel(30_000), 'just now');
    assert.equal(elapsedLabel(5 * 60_000), '5m');
    assert.equal(elapsedLabel(65 * 60_000), '1h 5m');
});
