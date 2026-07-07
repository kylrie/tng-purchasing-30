/**
 * Tests — QR rate limiter (Sprint 1.5 abuse protection).
 * Runs under `tsx --test` with the in-memory FakeFirestore (no emulator/Java).
 *
 * Covers the pure fixed-window decision and the transactional enforcer:
 * allowed under the cap, blocked at the cap, window reset after elapse, and
 * per-key isolation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    rateLimitDecision, enforceRateLimit, RATE_LIMIT_MESSAGE,
    type RateLimitConfig, type RateWindow,
} from '../rateLimit';
import { FakeFirestore } from './fakeFirestore';
import { asDb, expectReject } from './testUtils';

const CFG: RateLimitConfig = { maxRequests: 3, windowMs: 1000 };

// ── pure decision ────────────────────────────────────────────────────────
test('rateLimitDecision: first request (no window) is allowed and starts count at 1', () => {
    const d = rateLimitDecision(undefined, CFG, 1000);
    assert.deepEqual(d, { allowed: true, next: { windowStart: 1000, count: 1 } });
});

test('rateLimitDecision: increments within the window until the cap', () => {
    let win: RateWindow = { windowStart: 1000, count: 1 };
    for (let expected = 2; expected <= CFG.maxRequests; expected++) {
        const d = rateLimitDecision(win, CFG, 1200);
        assert.equal(d.allowed, true);
        win = (d as { allowed: true; next: RateWindow }).next;
        assert.equal(win.count, expected);
    }
    // Next one (4th) is blocked.
    const blocked = rateLimitDecision(win, CFG, 1300);
    assert.deepEqual(blocked, { allowed: false });
});

test('rateLimitDecision: a new window starts once windowMs has elapsed', () => {
    const atCap: RateWindow = { windowStart: 1000, count: 3 };
    const d = rateLimitDecision(atCap, CFG, 1000 + CFG.windowMs); // exactly elapsed
    assert.deepEqual(d, { allowed: true, next: { windowStart: 2000, count: 1 } });
});

// ── transactional enforcer (FakeFirestore) ───────────────────────────────
test('enforceRateLimit: allows up to the cap, then throws resource-exhausted', async () => {
    const fake = new FakeFirestore();
    const now = 5000;
    // 3 allowed within the same window.
    for (let i = 0; i < CFG.maxRequests; i++) {
        await enforceRateLimit(asDb(fake), 'menu:t1', CFG, now);
    }
    // 4th blocked.
    await expectReject(() => enforceRateLimit(asDb(fake), 'menu:t1', CFG, now), 'resource-exhausted');
    // Stored counter reflects exactly the cap (no further increments while blocked).
    const doc = fake._read('qr_rate_limits', 'menu:t1')!;
    assert.equal(doc.count, CFG.maxRequests);
});

test('enforceRateLimit: recovers after the window elapses', async () => {
    const fake = new FakeFirestore();
    for (let i = 0; i < CFG.maxRequests; i++) await enforceRateLimit(asDb(fake), 'order:t9', CFG, 1000);
    await expectReject(() => enforceRateLimit(asDb(fake), 'order:t9', CFG, 1000), 'resource-exhausted');
    // After the window, a fresh request is allowed again.
    await enforceRateLimit(asDb(fake), 'order:t9', CFG, 1000 + CFG.windowMs);
    const doc = fake._read('qr_rate_limits', 'order:t9')!;
    assert.equal(doc.count, 1);
});

test('enforceRateLimit: different keys have independent budgets', async () => {
    const fake = new FakeFirestore();
    const now = 7000;
    for (let i = 0; i < CFG.maxRequests; i++) await enforceRateLimit(asDb(fake), 'menu:A', CFG, now);
    await expectReject(() => enforceRateLimit(asDb(fake), 'menu:A', CFG, now), 'resource-exhausted');
    // Table B is unaffected by table A's exhaustion.
    await enforceRateLimit(asDb(fake), 'menu:B', CFG, now);
    assert.equal(fake._read('qr_rate_limits', 'menu:B')!.count, 1);
});

test('the generic block message never reveals the threshold', () => {
    assert.equal(/\d/.test(RATE_LIMIT_MESSAGE), false, 'message must not contain numbers/limits');
});
