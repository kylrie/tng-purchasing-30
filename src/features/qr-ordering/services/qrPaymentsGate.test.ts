// Pure tests for the QR client payment-routing gate. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQrPaymentsEnabled } from './qrPaymentsGate';

const FUN_ROOF = 'b1';
const INFLATABLE = 'b3';

test('global flag off, no business → disabled', () => {
    assert.equal(resolveQrPaymentsEnabled('false', '', undefined), false);
});

test('global flag off, b1 allow-listed → enabled for b1 only', () => {
    assert.equal(resolveQrPaymentsEnabled('false', 'b1', FUN_ROOF), true);
    assert.equal(resolveQrPaymentsEnabled('false', 'b1', INFLATABLE), false);
    assert.equal(resolveQrPaymentsEnabled('false', 'b1', undefined), false);
});

test('global flag off, b3 NOT allow-listed → disabled', () => {
    assert.equal(resolveQrPaymentsEnabled('false', 'b1', INFLATABLE), false);
});

test('global flag on → enabled for everyone (legacy behaviour preserved)', () => {
    assert.equal(resolveQrPaymentsEnabled('true', '', undefined), true);
    assert.equal(resolveQrPaymentsEnabled('true', '', FUN_ROOF), true);
    assert.equal(resolveQrPaymentsEnabled('true', '', INFLATABLE), true);
    assert.equal(resolveQrPaymentsEnabled('TRUE', undefined, undefined), true); // case-insensitive
});

test('malformed / whitespace / empty allowlist never enables a non-listed business', () => {
    assert.equal(resolveQrPaymentsEnabled('false', ' , b1 , ,', FUN_ROOF), true);   // trimmed match works
    assert.equal(resolveQrPaymentsEnabled('false', ' , b1 , ,', INFLATABLE), false);
    assert.equal(resolveQrPaymentsEnabled('false', ',,,', FUN_ROOF), false);        // only empty fragments
    assert.equal(resolveQrPaymentsEnabled('false', 'b1', ''), false);               // empty businessId
    assert.equal(resolveQrPaymentsEnabled('false', 'b1', ' '), false);              // whitespace businessId
    assert.equal(resolveQrPaymentsEnabled('false', undefined, FUN_ROOF), false);    // undefined allowlist
});

test('allowlist match is case-insensitive and trimmed on both sides', () => {
    assert.equal(resolveQrPaymentsEnabled('false', 'B1', ' b1 '), true);
});
