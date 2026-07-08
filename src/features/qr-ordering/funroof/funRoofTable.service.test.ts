// Pure tests for the Fun Roof token→table guard (customer P0 routing bug).
// Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFunRoofTable, isWrongBusinessError } from './funRoofTableGuard';

test('a b1 token resolves to the Fun Roof table', () => {
    const t = toFunRoofTable({ tableId: 'rAjxPnQlVx7vV2w2xOrl', tableNumber: '1', businessUnitId: 'b1' });
    assert.deepEqual(t, { tableId: 'rAjxPnQlVx7vV2w2xOrl', tableNumber: '1', businessUnitId: 'b1' });
});

test('a NON-b1 token (e.g. Inflatable b3) is rejected — never silently opened as Fun Roof', () => {
    let thrown: unknown;
    try {
        toFunRoofTable({ tableId: 'someInflatableTable', tableNumber: '1', businessUnitId: 'b3' });
    } catch (e) { thrown = e; }
    assert.ok(thrown, 'expected a throw for a non-Fun-Roof business');
    assert.equal(isWrongBusinessError(thrown), true);
});

test('an empty/absent business is rejected (no default-business fallback)', () => {
    assert.throws(() => toFunRoofTable({ tableId: 't', tableNumber: '1', businessUnitId: '' }));
});
