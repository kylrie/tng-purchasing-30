// Guards the Fun Roof ordering switch. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUN_ROOF_ORDERING_PAUSED, FUN_ROOF_ORDERING_PAUSED_MESSAGE } from './funRoofOrderingStatus';

test('Fun Roof online ordering is OPEN (pause switch is OFF)', () => {
    assert.equal(FUN_ROOF_ORDERING_PAUSED, false);
});

test('the call-staff maintenance copy is defined (used when the pause is flipped on)', () => {
    assert.equal(typeof FUN_ROOF_ORDERING_PAUSED_MESSAGE, 'string');
    assert.ok(FUN_ROOF_ORDERING_PAUSED_MESSAGE.length > 0);
});
