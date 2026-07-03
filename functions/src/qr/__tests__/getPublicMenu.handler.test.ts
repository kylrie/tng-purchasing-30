/**
 * Integration tests — getPublicMenu handler (Sprint 1).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers item 6: sanitization — only public fields; no cost/margin/recipe/
 * ingredients/linkedInventoryItemId ever leak.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPublicMenuHandler } from '../getPublicMenu.handler';
import { FakeFirestore } from './fakeFirestore';
import { asDb, req, expectReject } from './testUtils';

const SENSITIVE_KEYS = ['calculatedCost', 'grossMargin', 'marginPercent', 'foodCostPercent', 'ingredients', 'linkedInventoryItemId', 'businessUnitId', 'isActive'];

function seed(): FakeFirestore {
    const fake = new FakeFirestore();
    fake._seed('qr_tables', 't1', { qrToken: 'TOK-ACTIVE', businessUnitId: 'bu1', tableNumber: '12', isActive: true });
    fake._seed('qr_tables', 't2', { qrToken: 'TOK-OFF', businessUnitId: 'bu1', tableNumber: '99', isActive: false });
    // Active item loaded with sensitive fields that must NOT appear in the DTO.
    fake._seed('menu_items', 'm1', {
        businessUnitId: 'bu1', name: 'Sisig', category: 'Mains', sellingPrice: 285,
        description: 'Sizzling', imageUrl: '/s.jpg', isActive: true,
        calculatedCost: 90, grossMargin: 195, marginPercent: 68, foodCostPercent: 32,
        ingredients: [{ secret: true }], linkedInventoryItemId: 'inv-1',
    });
    fake._seed('menu_items', 'm2', { businessUnitId: 'bu1', name: 'Off', category: 'Mains', sellingPrice: 1, isActive: false });
    fake._seed('menu_items', 'm3', { businessUnitId: 'bu2', name: 'OtherBU', category: 'Mains', sellingPrice: 1, isActive: true });
    return fake;
}

test('getPublicMenu: returns only public fields and never leaks cost/margin/recipe', async () => {
    const fake = seed();
    const res = await getPublicMenuHandler(asDb(fake), req({ qrToken: 'TOK-ACTIVE' }));
    assert.equal(res.tableId, 't1');
    assert.equal(res.tableNumber, '12');
    assert.equal(res.items.length, 1); // only the active, same-BU item

    const item = res.items[0] as unknown as Record<string, unknown>;
    assert.deepEqual(Object.keys(item).sort(), ['category', 'description', 'id', 'imageUrl', 'isAvailable', 'name', 'sellingPrice'].sort());
    assert.equal(item.sellingPrice, 285);
    assert.equal(item.isAvailable, true);
    for (const key of SENSITIVE_KEYS) {
        assert.equal(key in item, false, `leaked sensitive field: ${key}`);
    }
});

test('getPublicMenu: rejects an invalid / unknown qrToken', async () => {
    const fake = seed();
    await expectReject(() => getPublicMenuHandler(asDb(fake), req({ qrToken: 'NOPE' })), 'not-found');
});

test('getPublicMenu: rejects a missing qrToken', async () => {
    const fake = seed();
    await expectReject(() => getPublicMenuHandler(asDb(fake), req({})), 'invalid-argument');
});

test('getPublicMenu: rejects an inactive table', async () => {
    const fake = seed();
    await expectReject(() => getPublicMenuHandler(asDb(fake), req({ qrToken: 'TOK-OFF' })), 'failed-precondition');
});
