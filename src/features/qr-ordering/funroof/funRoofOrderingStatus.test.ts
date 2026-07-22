// Guards the Fun Roof ordering switch. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUN_ROOF_ORDERING_PAUSED, FUN_ROOF_ORDERING_PAUSED_MESSAGE } from './funRoofOrderingStatus';

test('Fun Roof online ordering is REOPENED (unpaused for production)', () => {
    // Reopened 2026-07-11 (owner P0): server gate ON, secrets bound, webhook-only
    // PAID, b1 routing true from source, b3 untouched; validated post-deploy with a
    // controlled no-payment order reaching the Xendit hosted page. Re-pause = true.
    assert.equal(FUN_ROOF_ORDERING_PAUSED, false);
});

test('the call-staff maintenance copy is defined (used when the pause is flipped on)', () => {
    assert.equal(typeof FUN_ROOF_ORDERING_PAUSED_MESSAGE, 'string');
    assert.ok(FUN_ROOF_ORDERING_PAUSED_MESSAGE.length > 0);
});
