/**
 * Pure retry-decision helpers for the print bridge. Extracted so the backoff /
 * give-up policy is deterministic and unit-testable (no timers, no I/O).
 */

/** Whether to make another attempt after `attemptsMade` failures, given the cap. */
export function shouldRetry(attemptsMade: number, maxAttempts: number): boolean {
    return attemptsMade < maxAttempts;
}

/** Linear-ish backoff: the delay (ms) BEFORE the next attempt. attemptsMade is
 *  the number already failed (1 → wait 1×base before attempt #2, etc.), capped. */
export function nextRetryDelayMs(attemptsMade: number, baseMs: number, capMs = 30_000): number {
    const delay = Math.max(0, attemptsMade) * Math.max(0, baseMs);
    return Math.min(delay, capMs);
}
