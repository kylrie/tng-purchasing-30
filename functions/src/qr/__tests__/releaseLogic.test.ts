/**
 * Unit tests — pure order-release logic (Sprint 2 · release infrastructure).
 * No db, no clock — deterministic. Runs under `tsx --test`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReleaseEligibility, buildReleasePatch } from '../releaseLogic';

test('evaluateReleaseEligibility: a PAID, not-yet-released order is eligible', () => {
    assert.deepEqual(
        evaluateReleaseEligibility({ status: 'PAID', paymentStatus: 'PAID', released: false }),
        { eligible: true },
    );
    // released omitted (undefined) counts as not released
    assert.deepEqual(
        evaluateReleaseEligibility({ status: 'AWAITING_PAYMENT', paymentStatus: 'PAID' }),
        { eligible: true },
    );
    // paymentStatus absent → falls back to status === 'PAID'
    assert.deepEqual(evaluateReleaseEligibility({ status: 'PAID' }), { eligible: true });
});

test('evaluateReleaseEligibility: an unpaid order is NOT_PAID', () => {
    assert.deepEqual(
        evaluateReleaseEligibility({ status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID' }),
        { eligible: false, reason: 'NOT_PAID' },
    );
});

test('evaluateReleaseEligibility: an already-released order is ALREADY_RELEASED (even if PAID)', () => {
    assert.deepEqual(
        evaluateReleaseEligibility({ status: 'PAID', paymentStatus: 'PAID', released: true }),
        { eligible: false, reason: 'ALREADY_RELEASED' },
    );
});

test('evaluateReleaseEligibility: a missing order is ORDER_NOT_FOUND', () => {
    assert.deepEqual(evaluateReleaseEligibility(undefined), { eligible: false, reason: 'ORDER_NOT_FOUND' });
    assert.deepEqual(evaluateReleaseEligibility(null), { eligible: false, reason: 'ORDER_NOT_FOUND' });
});

test('evaluateReleaseEligibility: an unrecognizable shape is INVALID_ORDER', () => {
    assert.deepEqual(evaluateReleaseEligibility({}), { eligible: false, reason: 'INVALID_ORDER' });
    assert.deepEqual(evaluateReleaseEligibility({ foo: 'bar' }), { eligible: false, reason: 'INVALID_ORDER' });
});

test('buildReleasePatch: sets release metadata + optional audit fields', () => {
    const ts = { __serverTimestamp: true };
    const minimal = buildReleasePatch({ source: 'XENDIT_WEBHOOK', releasedAt: ts });
    assert.deepEqual(minimal, { released: true, releasedAt: ts, releaseSource: 'XENDIT_WEBHOOK' });

    const full = buildReleasePatch({ source: 'MANUAL', releasedAt: ts, releasedBy: 'uid-1', releaseEventId: 'py-123' });
    assert.equal(full.released, true);
    assert.equal(full.releaseSource, 'MANUAL');
    assert.equal(full.releasedBy, 'uid-1');
    assert.equal(full.releaseEventId, 'py-123');

    // audit fields are omitted (not undefined) when not provided
    assert.equal('releasedBy' in minimal, false);
    assert.equal('releaseEventId' in minimal, false);
});
