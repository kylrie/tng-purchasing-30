// Pure tests for the QR client payment-routing gate. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveQrPaymentsEnabled,
    resolveQrPaymentsEnabledWithDefaults,
    PAYMENTS_ENABLED_BUSINESSES,
} from './qrPaymentsGate';

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

// ── Durable, source-controlled routing (resolveQrPaymentsEnabledWithDefaults) ──
// This is what isQrPaymentsEnabled() actually uses. It must be correct even when
// BOTH payment env vars are completely absent, so no build can silently skip Xendit.

test('source default: b1 payment routing is enabled from tracked source', () => {
    assert.ok(PAYMENTS_ENABLED_BUSINESSES.includes('b1'));
    assert.ok(!PAYMENTS_ENABLED_BUSINESSES.includes('b3'));
});

test('REQUIRED PROOF — with NO payment env vars: b1 = true, b3 = false', () => {
    // Both VITE_QR_PAYMENTS_ENABLED and VITE_QR_PAYMENTS_BUSINESSES absent (undefined).
    assert.equal(resolveQrPaymentsEnabledWithDefaults(undefined, undefined, FUN_ROOF), true);
    assert.equal(resolveQrPaymentsEnabledWithDefaults(undefined, undefined, INFLATABLE), false);
    // Empty-string env (present but blank) behaves the same.
    assert.equal(resolveQrPaymentsEnabledWithDefaults('', '', FUN_ROOF), true);
    assert.equal(resolveQrPaymentsEnabledWithDefaults('', '', INFLATABLE), false);
    // No business id → still off.
    assert.equal(resolveQrPaymentsEnabledWithDefaults(undefined, undefined, undefined), false);
});

test('global flag off (explicit) with no allowlist: b1 still on from source, b3 off', () => {
    assert.equal(resolveQrPaymentsEnabledWithDefaults('false', undefined, FUN_ROOF), true);
    assert.equal(resolveQrPaymentsEnabledWithDefaults('false', undefined, INFLATABLE), false);
});

test('env allowlist stays an ADDITIVE override — canary another venue without a code change', () => {
    // b5 added via env is enabled, alongside the source default b1…
    assert.equal(resolveQrPaymentsEnabledWithDefaults('false', 'b5', 'b5'), true);
    assert.equal(resolveQrPaymentsEnabledWithDefaults('false', 'b5', FUN_ROOF), true);
    // …but an env allowlist never enables b3, and never turns the default off.
    assert.equal(resolveQrPaymentsEnabledWithDefaults('false', 'b5', INFLATABLE), false);
    assert.equal(resolveQrPaymentsEnabledWithDefaults('false', '', FUN_ROOF), true);
});

test('global flag true still enables everyone (legacy behaviour preserved through defaults)', () => {
    assert.equal(resolveQrPaymentsEnabledWithDefaults('true', undefined, INFLATABLE), true);
    assert.equal(resolveQrPaymentsEnabledWithDefaults('true', undefined, FUN_ROOF), true);
});
