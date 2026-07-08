// Pure tests for the QR transaction theme registry. Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveQrTransactionTheme, FUN_ROOF_TXN_THEME, INFLATABLE_THEME,
} from './qrTransactionTheme';

test('b1 order resolves the Fun Roof theme', () => {
    const t = resolveQrTransactionTheme('b1');
    assert.equal(t.key, 'funroof');
    assert.equal(t.brandName, 'The Fun Roof');
    assert.equal(t.isDark, true);
    assert.ok(t.logoSrc, 'Fun Roof theme carries a logo');
    assert.equal(t, FUN_ROOF_TXN_THEME);
});

test('b3 (Inflatable) order resolves the Inflatable theme', () => {
    const t = resolveQrTransactionTheme('b3');
    assert.equal(t.key, 'inflatable');
    assert.equal(t.isDark, false);
    assert.equal(t, INFLATABLE_THEME);
});

test('unknown / empty business falls back to the neutral default (never a wrong specific brand)', () => {
    for (const bu of ['', '   ', 'b999', undefined, null]) {
        assert.equal(resolveQrTransactionTheme(bu as string).key, 'inflatable');
    }
});

test('resolution is deterministic — same business always yields the same theme (refresh-stable)', () => {
    assert.equal(resolveQrTransactionTheme('b1'), resolveQrTransactionTheme('b1'));
    assert.equal(resolveQrTransactionTheme('b1').key, 'funroof');
    assert.equal(resolveQrTransactionTheme('b1').key, 'funroof'); // a "refresh" re-resolve
    // A Fun Roof order NEVER resolves to Inflatable.
    assert.notEqual(resolveQrTransactionTheme('b1').key, 'inflatable');
});

test('both themes expose the full token set the shared views consume', () => {
    for (const t of [INFLATABLE_THEME, FUN_ROOF_TXN_THEME]) {
        for (const k of ['pageBackground', 'text', 'textMuted', 'surface', 'surfaceBorder', 'primary', 'cta', 'onCta', 'priceAccent', 'stepDone', 'railDone']) {
            assert.ok((t as unknown as Record<string, string>)[k], `${t.key} missing token ${k}`);
        }
        for (const tone of ['amber', 'blue', 'emerald', 'red', 'slate'] as const) {
            assert.ok(t.tone[tone], `${t.key} missing tone ${tone}`);
        }
    }
});
