import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetry, nextRetryDelayMs } from '../retry';

test('shouldRetry keeps trying until the attempt cap is reached', () => {
    assert.equal(shouldRetry(1, 3), true);
    assert.equal(shouldRetry(2, 3), true);
    assert.equal(shouldRetry(3, 3), false); // cap reached — give up
    assert.equal(shouldRetry(0, 1), true);
    assert.equal(shouldRetry(1, 1), false);
});

test('nextRetryDelayMs grows with attempts and is capped', () => {
    assert.equal(nextRetryDelayMs(1, 3000), 3000);
    assert.equal(nextRetryDelayMs(2, 3000), 6000);
    assert.equal(nextRetryDelayMs(100, 3000, 30_000), 30_000); // capped
    assert.equal(nextRetryDelayMs(0, 3000), 0);
});
