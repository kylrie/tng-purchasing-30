"use strict";
/**
 * QR public-callable rate limiting (abuse protection · finding H2 fallback).
 *
 * Firestore-backed fixed-window counter, one doc per key in `qr_rate_limits`.
 * Keys are namespaced per surface + table so menu reads and order creation have
 * independent budgets (see MENU_READ_LIMIT / ORDER_CREATE_LIMIT).
 *
 * The pure `rateLimitDecision` holds all the logic and is unit-tested with no
 * db/clock; `enforceRateLimit` wraps it in a Firestore transaction (atomic
 * read-check-write) and is exercised via the FakeFirestore harness. No emulator
 * or App Check dependency — this is the protection that works today.
 *
 * See docs/QR_APP_CHECK_ABUSE_PROTECTION_PLAN.md §2.5–2.7.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_CREATE_LIMIT = exports.ORDER_CREATE_LIMIT = exports.MENU_READ_LIMIT = exports.RATE_LIMIT_MESSAGE = void 0;
exports.rateLimitDecision = rateLimitDecision;
exports.enforceRateLimit = enforceRateLimit;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const RATE_LIMIT_COLLECTION = 'qr_rate_limits';
/** Safe, generic customer-facing message — never reveals the threshold. */
exports.RATE_LIMIT_MESSAGE = 'Please wait a moment and try again.';
/** Per-surface budgets. Menu reads are cheap → generous; order creation → tight. */
exports.MENU_READ_LIMIT = { maxRequests: 30, windowMs: 60_000 };
exports.ORDER_CREATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };
/** Payment-session creation per table. Tighter than order creation: each call is a
 *  Xendit round-trip and a card-testing surface, and a table needs only a few
 *  (retry after fail/expire) within a window. See QR_XENDIT_IMPLEMENTATION_PLAN §4. */
exports.SESSION_CREATE_LIMIT = { maxRequests: 5, windowMs: 60_000 };
/**
 * Pure fixed-window decision. Given the current stored window (or undefined for
 * a first request) and the wall clock, decide whether to allow and what the
 * next window state should be. No I/O — deterministic and unit-testable.
 */
function rateLimitDecision(current, config, now) {
    if (!current) {
        return { allowed: true, next: { windowStart: now, count: 1 } };
    }
    // Window elapsed → start a fresh window.
    if (now - current.windowStart >= config.windowMs) {
        return { allowed: true, next: { windowStart: now, count: 1 } };
    }
    // Within window but at/over the cap → block (do not keep incrementing).
    if (current.count >= config.maxRequests) {
        return { allowed: false };
    }
    return { allowed: true, next: { windowStart: current.windowStart, count: current.count + 1 } };
}
/**
 * Atomically apply the rate limit for `key`. Throws HttpsError('resource-exhausted')
 * with a generic message when the limit is exceeded. `now` is injectable for tests.
 *
 * Note: the caller keys this per real table (see the handlers), so the number of
 * rate-limit docs is bounded to real tables and each doc self-caps once over the
 * limit (no further writes). App Check (future) is the defense against raw
 * invocation floods; this layer caps per-table volume today.
 */
async function enforceRateLimit(db, key, config, now = Date.now()) {
    const ref = db.collection(RATE_LIMIT_COLLECTION).doc(key);
    const allowed = await db.runTransaction(async (txn) => {
        const snap = await txn.get(ref);
        const current = snap.exists
            ? (() => {
                const d = snap.data();
                return typeof d.windowStart === 'number' && typeof d.count === 'number'
                    ? { windowStart: d.windowStart, count: d.count }
                    : undefined;
            })()
            : undefined;
        const decision = rateLimitDecision(current, config, now);
        if (!decision.allowed)
            return false;
        txn.set(ref, { windowStart: decision.next.windowStart, count: decision.next.count, updatedAt: now });
        return true;
    });
    if (!allowed) {
        // Structured log for observability — the KEY encodes surface + table.
        firebase_functions_1.logger.warn('qr.rateLimit.blocked', { key, maxRequests: config.maxRequests, windowMs: config.windowMs });
        throw new https_1.HttpsError('resource-exhausted', exports.RATE_LIMIT_MESSAGE);
    }
}
//# sourceMappingURL=rateLimit.js.map