// Guards the Fun Roof ordering switch. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUN_ROOF_ORDERING_PAUSED, FUN_ROOF_ORDERING_PAUSED_MESSAGE } from './funRoofOrderingStatus';

test('Fun Roof online ordering is PAUSED (blocked on Xendit session INTERNAL error)', () => {
    // Re-paused 2026-07-10: server gate is ON but createXenditSession returns 500
    // INTERNAL at the Xendit API call. Flip to false only after a live session succeeds.
    assert.equal(FUN_ROOF_ORDERING_PAUSED, true);
});

test('the call-staff maintenance copy is defined (used when the pause is flipped on)', () => {
    assert.equal(typeof FUN_ROOF_ORDERING_PAUSED_MESSAGE, 'string');
    assert.ok(FUN_ROOF_ORDERING_PAUSED_MESSAGE.length > 0);
});
