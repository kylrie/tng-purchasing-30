/**
 * Employee Firebase ID-token verification — project pinning proof.
 *
 * Guards the stage-4 defect (a valid tng-systems token rejected because the
 * broker verified against the wrong project). Pure: the signature verifier is
 * injected; no firebase-admin, no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyEmployeeToken,
  EmployeeTokenError,
  decodeSafeClaims,
  FirebaseClaims,
} from '../employeeToken';

const NOW = 1_800_000_000;
const ERP_PROJECT = 'tng-systems';
const UID = 'Rbve9r00SjWBV0uDDufj2vmGIM92';

function tngClaims(over: Partial<FirebaseClaims> = {}): FirebaseClaims {
  return {
    iss: `https://securetoken.google.com/${ERP_PROJECT}`,
    aud: ERP_PROJECT,
    exp: NOW + 300,
    sub: UID,
    uid: UID,
    email: 'yodarichrich@gmail.com',
    ...over,
  };
}

function cfg(erpProjectId: string, claims: FirebaseClaims) {
  return { erpProjectId, verifyFirebaseSignature: async () => claims };
}

// 1 ─ a valid token with aud/iss for tng-systems is ACCEPTED.
test('accepts a token with iss/aud for tng-systems', async () => {
  const out = await verifyEmployeeToken('t', cfg(ERP_PROJECT, tngClaims()), NOW);
  assert.equal(out.erpUserId, UID);
  assert.equal(out.email, 'yodarichrich@gmail.com');
});

// 2 ─ a token minted for ANOTHER Firebase project is REJECTED.
test('rejects a token minted for a different Firebase project', async () => {
  await assert.rejects(
    () =>
      verifyEmployeeToken(
        't',
        cfg(
          ERP_PROJECT,
          tngClaims({
            iss: 'https://securetoken.google.com/some-other-project',
            aud: 'some-other-project',
          }),
        ),
        NOW,
      ),
    EmployeeTokenError,
  );
});

// 3 ─ WRONG broker project config fails CLOSED, even for an otherwise-valid
//     tng-systems token (proves verification is pinned to the configured project).
test('fails closed when the broker project config does not match the token project', async () => {
  await assert.rejects(
    () => verifyEmployeeToken('t', cfg('wrong-erp-project', tngClaims()), NOW),
    EmployeeTokenError,
  );
});

// 3b ─ an expired token is rejected (defense-in-depth re-assertion).
test('rejects an expired token', async () => {
  await assert.rejects(
    () => verifyEmployeeToken('t', cfg(ERP_PROJECT, tngClaims({ exp: NOW - 1 })), NOW),
    EmployeeTokenError,
  );
});

// 4 ─ decodeSafeClaims returns ONLY iss/aud/sub, never the token or other claims.
test('decodeSafeClaims extracts only iss/aud/sub and ignores malformed tokens', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: `https://securetoken.google.com/${ERP_PROJECT}`,
      aud: ERP_PROJECT,
      sub: UID,
      email: 'secret@x',
      customClaim: 'nope',
    }),
  ).toString('base64url');
  const jwtish = `${header}.${payload}.signaturepart`;
  const c = decodeSafeClaims(jwtish);
  assert.deepEqual(c, {
    iss: `https://securetoken.google.com/${ERP_PROJECT}`,
    aud: ERP_PROJECT,
    sub: UID,
  });
  // Never surfaces other claims.
  assert.equal((c as Record<string, unknown>).email, undefined);
  // Garbage / non-JWT → {}.
  assert.deepEqual(decodeSafeClaims('not-a-jwt'), {});
  assert.deepEqual(decodeSafeClaims('a.b'), {});
});
