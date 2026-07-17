/**
 * Workspace Identity Broker — contract proof (ERP-side).
 * Runs under `tsx --test` with the in-memory SyntheticErpDatastore + injected
 * verifiers (no emulator, no Firebase, no Google network). One test (or block)
 * per numbered requirement in the Workspace-broker spec.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveIdentity, buildIdentityResponse, BrokerConfig } from '../workspaceIdentity.handler';
import { SyntheticErpDatastore, ErpUserDoc } from '../datastore';
import { WORKSPACE_PERMISSION_IDS, assertStrict, RESPONSE_KEYS } from '../contract';
import { projectWorkspacePermissions } from '../projection';
import { OidcClaims } from '../oidc';
import { FirebaseClaims } from '../employeeToken';

const ERP_PROJECT_ID = 'tng-systems-lab';
const AUDIENCE = 'https://workspace-identity-lab.example.run';
const APPROVED_CALLER = 'workspace-identity-caller@tng-workspace-lab.iam.gserviceaccount.com';
const NOW = 1_800_000_000;

/** Synthetic users — include EXTRA sensitive raw fields the broker must never surface. */
const SYNTH_USERS: Record<string, ErpUserDoc & Record<string, unknown>> = {
  'lab-super-001': {
    email: 'super@erp.lab.test', name: 'Sula Super', role: 'SUPER_ADMIN', status: 'ACTIVE',
    businessId: 'b1', businessUnitIds: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'], permissions: [],
    employeeId: 'SS-1', updatedAt: '2026-07-10T00:00:00.000Z',
    // must NOT leak:
    posPin: '4821', posPinHash: 'hash-xyz', pcfCeiling: 50000, salary: 999999,
    bankDetails: { accountNumber: 'PH-0001-secret' },
  },
  'lab-admin-001': {
    email: 'admin@erp.lab.test', name: 'Ada Admin', role: 'ADMIN', status: 'ACTIVE',
    businessId: 'b1', businessUnitIds: ['b1', 'b2'], permissions: ['finance:budget:view'],
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  'lab-manager-mgmt-001': {
    email: 'mgr-mgmt@erp.lab.test', name: 'Max Manager', role: 'MANAGER', status: 'ACTIVE',
    businessId: 'b1', businessUnitIds: ['b1'], permissions: ['admin:user:manage', 'totally:unknown:permission'],
  },
  'lab-manager-plain-001': {
    email: 'mgr-plain@erp.lab.test', name: 'Mona Manager', role: 'MANAGER', status: 'ACTIVE',
    businessId: 'b1', businessUnitIds: ['b1'], permissions: ['reports:view', 'another:unknown'],
  },
  'lab-employee-001': {
    email: 'employee@erp.lab.test', name: 'Enzo Employee', role: 'EMPLOYEE', status: 'ACTIVE',
    businessId: 'b1', businessUnitIds: ['b1'], permissions: [],
  },
  'lab-finance-001': {
    email: 'finance@erp.lab.test', name: 'Fiona Finance', role: 'FINANCE', status: 'ACTIVE',
    businessId: 'b6', businessUnitIds: ['b6'], permissions: [],
  },
  'lab-multi-001': {
    email: 'gm@erp.lab.test', name: 'Gia General', role: 'GENERAL_MANAGER', status: 'ACTIVE',
    businessId: 'b2', businessUnitIds: ['b2', 'b3'], permissions: [],
  },
  'lab-pending-001': {
    email: 'pending@erp.lab.test', name: 'Pat Pending', role: 'EMPLOYEE', status: 'PENDING_APPROVAL',
    businessId: 'b1', businessUnitIds: ['b1'], permissions: [],
  },
  'lab-inactive-001': {
    email: 'inactive@erp.lab.test', name: 'Ivan Inactive', role: 'EMPLOYEE', status: 'INACTIVE',
    businessId: 'b1', businessUnitIds: ['b1'], permissions: [],
  },
  'lab-rejected-001': {
    email: 'rejected@erp.lab.test', name: 'Rae Rejected', role: 'EMPLOYEE', status: 'REJECTED',
    businessId: 'b1', businessUnitIds: ['b1'], permissions: [],
  },
};

const SYNTH_MATRIX = {
  version: 'lab-matrix-2026-07-17',
  roles_permissions: {
    SUPER_ADMIN: ['*'],
    ADMIN: ['admin:user:manage', 'admin:settings:manage'],
    MANAGER: [],
    EMPLOYEE: [],
    FINANCE: ['finance:budget:view'],
    GENERAL_MANAGER: [],
  },
};

const GHOST_UID = 'lab-ghost-001';

function validCaller(over: Partial<OidcClaims> = {}): OidcClaims {
  return { iss: 'https://accounts.google.com', aud: AUDIENCE, exp: NOW + 300, email: APPROVED_CALLER, email_verified: true, sub: 'caller', ...over };
}
function validEmployee(uid: string, over: Partial<FirebaseClaims> = {}): FirebaseClaims {
  return { iss: `https://securetoken.google.com/${ERP_PROJECT_ID}`, aud: ERP_PROJECT_ID, exp: NOW + 300, uid, sub: uid, email: SYNTH_USERS[uid]?.email as string | undefined, ...over };
}

interface Opts {
  caller?: OidcClaims;
  employee?: FirebaseClaims;
  employeeThrows?: boolean;
  failDatastore?: boolean;
  users?: Record<string, ErpUserDoc>;
  logSink?: BrokerConfig['log'];
}
function makeConfig(o: Opts = {}): BrokerConfig {
  return {
    oidc: { audience: AUDIENCE, approvedCallers: [APPROVED_CALLER], verifyJwtSignature: async () => o.caller ?? validCaller() },
    employeeToken: {
      erpProjectId: ERP_PROJECT_ID,
      verifyFirebaseSignature: async () => {
        if (o.employeeThrows) throw new Error('bad sig');
        return o.employee ?? validEmployee('lab-employee-001');
      },
    },
    datastore: new SyntheticErpDatastore(o.users ?? SYNTH_USERS, SYNTH_MATRIX, o.failDatastore ?? false),
    permissionVersion: SYNTH_MATRIX.version,
    cacheTtlSeconds: 300,
    nowSeconds: () => NOW,
    log: o.logSink,
  };
}
const CALLER = 'Bearer caller-token';
async function login(uid: string, o: Opts = {}) {
  return resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({ employee: validEmployee(uid), ...o }));
}

// 1 ─ active accepted
test('1. active employee accepted (schema-valid, has workspace.access)', async () => {
  const out = await login('lab-employee-001');
  assert.equal(out.statusCode, 200);
  if (out.statusCode !== 200) return;
  assert.doesNotThrow(() => assertStrict(out.body));
  assert.equal(out.body.status, 'ACTIVE');
  assert.ok(out.body.workspace_permission_ids.includes('workspace.access'));
});

// 2-4 ─ inactive/pending/rejected → reported status + zero eligibility
for (const [uid, status] of [['lab-inactive-001', 'INACTIVE'], ['lab-pending-001', 'PENDING_APPROVAL'], ['lab-rejected-001', 'REJECTED']] as const) {
  test(`2-4. ${uid} → status ${status}, empty permissions (Workspace gate denies)`, async () => {
    const out = await login(uid);
    assert.equal(out.statusCode, 200);
    if (out.statusCode !== 200) return;
    assert.equal(out.body.status, status);
    assert.deepEqual(out.body.workspace_permission_ids, []);
    assert.equal(out.body.status === 'ACTIVE', false);
  });
}

// 5 ─ missing profile denied
test('5. missing profile → NO_PROFILE (404)', async () => {
  const out = await login(GHOST_UID, { employee: validEmployee(GHOST_UID) });
  assert.equal(out.statusCode, 404);
  assert.deepEqual(out.body, { error: 'NO_PROFILE' });
});

// 6 ─ wrong Firebase project denied
test('6. wrong Firebase project → INVALID_EMPLOYEE_TOKEN', async () => {
  const out = await resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({
    employee: validEmployee('lab-employee-001', { iss: 'https://securetoken.google.com/other', aud: 'other' }),
  }));
  assert.equal(out.statusCode, 401);
  assert.deepEqual(out.body, { error: 'INVALID_EMPLOYEE_TOKEN' });
});

// 7 ─ wrong broker audience denied
test('7. wrong broker audience → UNAUTHENTICATED', async () => {
  const out = await resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({ caller: validCaller({ aud: 'https://other' }) }));
  assert.equal(out.statusCode, 401);
  assert.deepEqual(out.body, { error: 'UNAUTHENTICATED' });
});

// 8 ─ unauthorized caller denied
test('8. unapproved caller → UNAUTHENTICATED', async () => {
  const out = await resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({ caller: validCaller({ email: 'attacker@evil.iam.gserviceaccount.com' }) }));
  assert.equal(out.statusCode, 401);
});
test('8b. caller email not verified → UNAUTHENTICATED', async () => {
  const out = await resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({ caller: validCaller({ email_verified: false }) }));
  assert.equal(out.statusCode, 401);
});

// 9 ─ expired caller identity denied
test('9. expired caller token → UNAUTHENTICATED', async () => {
  const out = await resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({ caller: validCaller({ exp: NOW - 1 }) }));
  assert.equal(out.statusCode, 401);
});
test('9b. non-Google issuer → UNAUTHENTICATED', async () => {
  const out = await resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({ caller: validCaller({ iss: 'https://evil' }) }));
  assert.equal(out.statusCode, 401);
});

// 10 ─ correct business assignments
test('10. correct business assignments returned', async () => {
  const out = await login('lab-multi-001');
  assert.equal(out.statusCode, 200);
  if (out.statusCode !== 200) return;
  assert.deepEqual([...out.body.business_ids].sort(), ['b2', 'b3']);
  assert.deepEqual([...out.body.business_unit_ids].sort(), ['b2', 'b3']);
});

// 11 ─ only allowlisted permissions
test('11. every returned permission id is in the closed vocabulary', async () => {
  for (const uid of Object.keys(SYNTH_USERS)) {
    const out = await login(uid);
    if (out.statusCode !== 200) continue;
    for (const id of out.body.workspace_permission_ids) {
      assert.ok((WORKSPACE_PERMISSION_IDS as readonly string[]).includes(id));
    }
  }
});
test('11b. manager-with-mgmt-permission → access + management only', async () => {
  const out = await login('lab-manager-mgmt-001');
  assert.equal(out.statusCode, 200);
  if (out.statusCode !== 200) return;
  assert.deepEqual([...out.body.workspace_permission_ids].sort(), ['channel.management', 'workspace.access']);
});

// 12 ─ unknown permissions ignored
test('12. manager with only unknown permissions → baseline only', async () => {
  const out = await login('lab-manager-plain-001');
  assert.equal(out.statusCode, 200);
  if (out.statusCode !== 200) return;
  assert.deepEqual(out.body.workspace_permission_ids, ['workspace.access']);
});
test('12b. projection never emits a raw ERP permission string', () => {
  const ids = projectWorkspacePermissions({ role: 'MANAGER', permissions: ['admin:user:manage', 'totally:unknown', 'finance:budget:view'], hasBusinessAssignment: true });
  assert.ok(!ids.includes('admin:user:manage' as never));
  assert.ok(!ids.includes('finance:budget:view' as never));
  assert.ok(ids.includes('channel.management'));
  assert.ok(ids.includes('channel.finance'));
});

// 13-14 ─ raw / financial / customer / order fields absent
test('13-14. response has EXACTLY the contract keys; no raw/sensitive fields', async () => {
  const out = await login('lab-super-001');
  assert.equal(out.statusCode, 200);
  if (out.statusCode !== 200) return;
  assert.deepEqual(Object.keys(out.body).sort(), [...RESPONSE_KEYS].sort());
  const blob = JSON.stringify(out.body);
  for (const forbidden of ['posPin', 'posPinHash', '4821', 'hash-xyz', 'pcfCeiling', '50000', 'salary', '999999', 'bankDetails', 'PH-0001-secret', 'employeeId', 'permissions']) {
    assert.ok(!blob.includes(forbidden), `leaked: ${forbidden}`);
  }
});

// 15 ─ strict schema rejects unexpected fields
test('15. assertStrict rejects any extra key', async () => {
  const out = await login('lab-employee-001');
  if (out.statusCode !== 200) throw new Error('expected 200');
  assert.throws(() => assertStrict({ ...out.body, injected_field: 'leak' }));
});

// 16 ─ logs contain no tokens or PII documents
test('16. logs carry no employee token / email / name / sensitive fields', async () => {
  const lines: string[] = [];
  const out = await resolveIdentity('Bearer super-secret-employee-token', { firebaseIdToken: 'super-secret-employee-token' },
    makeConfig({ employee: validEmployee('lab-super-001'), logSink: (e) => lines.push(JSON.stringify(e)) }));
  assert.equal(out.statusCode, 200);
  const blob = lines.join('\n');
  assert.ok(lines.length > 0);
  for (const forbidden of ['super-secret-employee-token', 'super@erp.lab.test', 'Sula Super', '999999', '4821']) {
    assert.ok(!blob.includes(forbidden), `log leaked: ${forbidden}`);
  }
  assert.ok(blob.includes(APPROVED_CALLER)); // caller SA email OK for audit
});

// 17 ─ response consumable via buildIdentityResponse + assertStrict
test('17. ADMIN projection is complete and strict-valid', () => {
  const body = buildIdentityResponse('lab-admin-001', SYNTH_USERS['lab-admin-001'], SYNTH_MATRIX, { permissionVersion: 'v1', cacheTtlSeconds: 300 });
  assert.doesNotThrow(() => assertStrict(body));
  assert.deepEqual([...body.workspace_permission_ids].sort(),
    ['channel.audit', 'channel.finance', 'channel.hr', 'channel.management', 'workspace.access', 'workspace.admin'].sort());
});

// 19 ─ deactivation via resolve-by-uid + TTL bound
test('19. resolve-by-uid reflects a status flipped to INACTIVE', async () => {
  const users = JSON.parse(JSON.stringify(SYNTH_USERS)) as Record<string, ErpUserDoc>;
  (users['lab-employee-001'] as Record<string, unknown>).status = 'INACTIVE';
  const out = await resolveIdentity(CALLER, { erpUserId: 'lab-employee-001' }, makeConfig({ users }));
  assert.equal(out.statusCode, 200);
  if (out.statusCode !== 200) return;
  assert.equal(out.body.status, 'INACTIVE');
  assert.deepEqual(out.body.workspace_permission_ids, []);
});
test('19b. recommended_cache_ttl_seconds ≤ 900', async () => {
  const out = await login('lab-super-001');
  if (out.statusCode !== 200) return;
  assert.ok(out.body.recommended_cache_ttl_seconds <= 900);
});

// fail-closed: datastore unavailable + bad request
test('datastore unavailable → ERP_UNAVAILABLE (502)', async () => {
  const out = await resolveIdentity(CALLER, { firebaseIdToken: 'emp' }, makeConfig({ failDatastore: true, employee: validEmployee('lab-employee-001') }));
  assert.equal(out.statusCode, 502);
  assert.deepEqual(out.body, { error: 'ERP_UNAVAILABLE' });
});
test('neither token nor uid → BAD_REQUEST (400)', async () => {
  const out = await resolveIdentity(CALLER, {}, makeConfig());
  assert.equal(out.statusCode, 400);
  assert.deepEqual(out.body, { error: 'BAD_REQUEST' });
});
