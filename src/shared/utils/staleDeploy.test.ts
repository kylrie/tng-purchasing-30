// Focused tests for stale-deploy error detection (pure part of staleDeploy.ts).
// Run: npx tsx --test src/shared/utils/staleDeploy.test.ts
//
// isStaleDeployError decides whether an error is a stale-bundle / failed-chunk load
// (→ auto-reload once + "app was updated" message) vs a genuine app bug (→ clean
// generic message, no reload spam). It must catch the real browser/Vite strings
// from the incident and NOT misclassify ordinary runtime errors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStaleDeployError } from './staleDeploy';

test('detects stale-bundle / chunk-load / module-MIME failures', () => {
    const staleErrors: unknown[] = [
        new Error("Failed to fetch dynamically imported module: https://tng-systems.web.app/assets/FunRoofMenuView-abc123.js"),
        new Error('Importing a module script failed.'),
        new Error("'text/html' is not a valid JavaScript MIME type."),
        new Error('error loading dynamically imported module'),
        new Error('Loading chunk 42 failed.'),
        new Error('Loading CSS chunk 3 failed.'),
        Object.assign(new Error('boom'), { name: 'ChunkLoadError' }),
        'Failed to fetch dynamically imported module',       // string form
        { name: 'ChunkLoadError', message: 'x' },            // error-like object
    ];
    for (const e of staleErrors) {
        assert.equal(isStaleDeployError(e), true, `should be stale: ${JSON.stringify(e instanceof Error ? e.message : e)}`);
    }
});

test('does NOT misclassify genuine application errors', () => {
    const appErrors: unknown[] = [
        new Error("Cannot read properties of undefined (reading 'name')"),
        new Error('TypeError: order.items is not a function'),
        new Error('Firebase: Missing or insufficient permissions.'),
        new Error('Network request failed'),
        'Something unrelated broke',
        null,
        undefined,
        {},
        42,
    ];
    for (const e of appErrors) {
        assert.equal(isStaleDeployError(e), false, `should NOT be stale: ${String(e && (e as Error).message ? (e as Error).message : e)}`);
    }
});
