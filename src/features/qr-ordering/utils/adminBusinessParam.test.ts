// Pure regression tests for the durable admin business identity (P0 routing bug).
// Run: npx tsx --test <thisfile>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BUSINESS_PARAM, readBusinessParam, withBusinessParam, resolveAdminBusinessUnit,
} from './adminBusinessParam';

test('BUSINESS_PARAM is "bu"', () => {
    assert.equal(BUSINESS_PARAM, 'bu');
});

// ── readBusinessParam ────────────────────────────────────────────────────────
test('readBusinessParam extracts ?bu=', () => {
    assert.equal(readBusinessParam('?bu=b1'), 'b1');
    assert.equal(readBusinessParam('?bu=b3&tab=live'), 'b3');
    assert.equal(readBusinessParam('?tab=live&bu=b1'), 'b1');
    assert.equal(readBusinessParam('  ?bu=b1  '.trim()), 'b1');
});

test('readBusinessParam is empty when absent/blank', () => {
    assert.equal(readBusinessParam(''), '');
    assert.equal(readBusinessParam(undefined), '');
    assert.equal(readBusinessParam('?tab=live'), '');
    assert.equal(readBusinessParam('?bu='), '');
});

// ── withBusinessParam ────────────────────────────────────────────────────────
test('withBusinessParam appends ?bu=', () => {
    assert.equal(withBusinessParam('/qr-ops/overview', 'b1'), '/qr-ops/overview?bu=b1');
    assert.equal(withBusinessParam('/qr-tables/live', 'b3'), '/qr-tables/live?bu=b3');
});

test('withBusinessParam replaces an existing bu and preserves other params', () => {
    assert.equal(withBusinessParam('/qr-ops/live?bu=b3', 'b1'), '/qr-ops/live?bu=b1');
    assert.equal(withBusinessParam('/qr-ops/live?tab=x', 'b1'), '/qr-ops/live?tab=x&bu=b1');
});

test('withBusinessParam is a no-op for an empty id (never writes an empty business)', () => {
    assert.equal(withBusinessParam('/qr-tables/live', ''), '/qr-tables/live');
    assert.equal(withBusinessParam('/qr-tables/live', undefined), '/qr-tables/live');
});

// ── resolveAdminBusinessUnit — the actual bug fix ────────────────────────────
test('BUG FIX: URL ?bu survives a refresh that reset the context to "all"', () => {
    // Hard refresh: BusinessUnitContext is back to its initial 'all'. Before the
    // fix this fell back to the home business (b3). Now the URL governs.
    assert.equal(resolveAdminBusinessUnit({ urlBusinessUnitId: 'b1', selectedBusinessUnit: 'all' }), 'b1');
});

test('URL ?bu wins even if the transient context disagrees (refresh/new-tab safe)', () => {
    assert.equal(resolveAdminBusinessUnit({ urlBusinessUnitId: 'b1', selectedBusinessUnit: 'b3' }), 'b1');
});

test('ISOLATION: an Inflatable (b3) URL stays b3 regardless of context', () => {
    assert.equal(resolveAdminBusinessUnit({ urlBusinessUnitId: 'b3', selectedBusinessUnit: 'b1' }), 'b3');
    assert.equal(resolveAdminBusinessUnit({ urlBusinessUnitId: 'b3', selectedBusinessUnit: 'all' }), 'b3');
});

test('in-session (no URL yet): the chosen switcher business is used', () => {
    assert.equal(resolveAdminBusinessUnit({ urlBusinessUnitId: '', selectedBusinessUnit: 'b1' }), 'b1');
});

test('NO SILENT FALLBACK: no URL and no chosen business → "" (never a default/b3)', () => {
    assert.equal(resolveAdminBusinessUnit({ urlBusinessUnitId: '', selectedBusinessUnit: 'all' }), '');
    assert.equal(resolveAdminBusinessUnit({ urlBusinessUnitId: '', selectedBusinessUnit: '' }), '');
});
