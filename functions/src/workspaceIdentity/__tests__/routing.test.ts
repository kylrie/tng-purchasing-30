/**
 * Workspace Identity Broker — HTTP route matching proof.
 *
 * Guards the deployed onRequest wrapper's routing (the defect that made an
 * authenticated `POST /resolve` return 404 BAD_REQUEST because the old guard
 * required `req.path === '/'`). Pure — no Firebase, no HTTP, no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isBrokerRoute, normalizePathname } from '../routing';

// 1 ─ the contract route is accepted (this is the deployed Cloud Run req.path).
test('1. POST /resolve is accepted', () => {
  assert.equal(isBrokerRoute('POST', '/resolve'), true);
});

// 2 ─ trailing slash handled consistently.
test('2. POST /resolve/ is accepted (trailing slash tolerated)', () => {
  assert.equal(isBrokerRoute('POST', '/resolve/'), true);
  assert.equal(normalizePathname('/resolve/'), '/resolve');
});

// 3 ─ the actual Firebase Functions v2 mounted-path representations are accepted:
//     Cloud Run URL → "/resolve"; alias-root / stripped-name mount → "/";
//     a query string must not affect matching.
test('3. FF mounted-path representations accepted (/resolve, /, with query)', () => {
  assert.equal(isBrokerRoute('POST', '/resolve'), true); // Cloud Run
  assert.equal(isBrokerRoute('POST', '/'), true); // stripped single-function mount
  assert.equal(isBrokerRoute('POST', '/resolve?trace=abc'), true);
  assert.equal(normalizePathname('/resolve?trace=abc'), '/resolve');
  assert.equal(normalizePathname(undefined), '/');
  assert.equal(normalizePathname('//resolve'), '/resolve'); // duplicate-slash collapse
});

// 4 ─ GET is rejected (no read side; service-to-service POST only).
test('4. GET /resolve is rejected', () => {
  assert.equal(isBrokerRoute('GET', '/resolve'), false);
  assert.equal(isBrokerRoute('OPTIONS', '/resolve'), false);
  assert.equal(isBrokerRoute('PUT', '/resolve'), false);
});

// 5 ─ unknown / adjacent paths are rejected (not a generic router).
test('5. unknown paths are rejected', () => {
  for (const p of ['/resolvexyz', '/resolve/extra', '/admin', '/v1/resolve', '/health']) {
    assert.equal(isBrokerRoute('POST', p), false, `should reject ${p}`);
  }
});
