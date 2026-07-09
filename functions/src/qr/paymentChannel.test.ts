// Pure tests for the payment-method → Xendit channel resolver. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAllowedPaymentChannels } from './paymentChannel';

test('GCash app selection → GCASH channel', () => {
    assert.deepEqual(resolveAllowedPaymentChannels('gcash'), { kind: 'restricted', channels: ['GCASH'] });
});

test('Maya app selection → PAYMAYA channel', () => {
    assert.deepEqual(resolveAllowedPaymentChannels('maya'), { kind: 'restricted', channels: ['PAYMAYA'] });
});

test('QRPH app selection → QRPH channel', () => {
    assert.deepEqual(resolveAllowedPaymentChannels('qrph'), { kind: 'restricted', channels: ['QRPH'] });
});

test('Card app selection → CARDS channel', () => {
    assert.deepEqual(resolveAllowedPaymentChannels('card'), { kind: 'restricted', channels: ['CARDS'] });
});

test('token match is case-insensitive and trimmed', () => {
    assert.deepEqual(resolveAllowedPaymentChannels('  GCash '), { kind: 'restricted', channels: ['GCASH'] });
});

test('unknown non-blank value → rejected (invalid)', () => {
    assert.deepEqual(resolveAllowedPaymentChannels('bitcoin'), { kind: 'invalid' });
    assert.deepEqual(resolveAllowedPaymentChannels('GCASH_DIRECT_HACK'), { kind: 'invalid' });
});

test('arbitrary raw Xendit channel code is NOT accepted (server authority)', () => {
    // A client trying to inject a real channel code it was never offered is rejected,
    // because the allowlist is keyed by the app tokens, not by channel codes.
    assert.deepEqual(resolveAllowedPaymentChannels('CARDS'), { kind: 'invalid' });
    assert.deepEqual(resolveAllowedPaymentChannels('DANA'), { kind: 'invalid' });
});

test('non-string value → rejected (invalid)', () => {
    assert.deepEqual(resolveAllowedPaymentChannels(123 as unknown), { kind: 'invalid' });
    assert.deepEqual(resolveAllowedPaymentChannels({} as unknown), { kind: 'invalid' });
    assert.deepEqual(resolveAllowedPaymentChannels(['gcash'] as unknown), { kind: 'invalid' });
});

test('missing / blank value → fallback: all channels (unrestricted)', () => {
    assert.deepEqual(resolveAllowedPaymentChannels(undefined), { kind: 'all' });
    assert.deepEqual(resolveAllowedPaymentChannels(null as unknown), { kind: 'all' });
    assert.deepEqual(resolveAllowedPaymentChannels(''), { kind: 'all' });
    assert.deepEqual(resolveAllowedPaymentChannels('   '), { kind: 'all' });
});
