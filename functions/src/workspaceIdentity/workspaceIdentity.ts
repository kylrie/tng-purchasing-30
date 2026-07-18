/**
 * workspaceIdentity — HTTP Cloud Function (v2 onRequest).
 *
 * The narrow ERP → Workspace Identity Broker. Service-to-service ONLY:
 *   - authenticated by a Google OIDC identity token in `Authorization: Bearer`
 *     (verified via google-auth-library), NOT a Firebase user / App Check;
 *   - the approved caller is Workspace's dedicated invoke-only service account;
 *   - NO CORS headers are emitted (browsers are blocked by same-origin), NO API
 *     key, NO public unauthenticated path.
 *
 * Thin adapter only: it binds the real Firestore (database `tng-systems`), the
 * real firebase-admin employee-token verifier, and the real OIDC caller
 * verifier, then delegates to the injectable, unit-tested handler. Deploy this
 * function with IAM `run.invoker` restricted to the Workspace caller SA so the
 * allowlist is defense-in-depth, not the only lock.
 *
 * Config (functions/.env.<project>, non-secret):
 *   WORKSPACE_BROKER_AUDIENCE      exact OIDC audience (this function's URL)
 *   WORKSPACE_BROKER_CALLERS       comma-separated approved caller SA emails
 *   WORKSPACE_BROKER_ERP_PROJECT   ERP Firebase project id (default tng-systems)
 *   WORKSPACE_BROKER_PERM_VERSION  permission-matrix version stamp (optional)
 *   WORKSPACE_BROKER_CACHE_TTL     cache-hint seconds, ≤900 (optional)
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';

import { resolveIdentity, BrokerConfig, BrokerLogger } from './workspaceIdentity.handler';
import { firestoreDatastore, FirestoreLike } from './datastore';
import { OidcClaims } from './oidc';
import { FirebaseClaims, decodeSafeClaims } from './employeeToken';
import { isBrokerRoute, normalizePathname } from './routing';

const ERP_DATABASE_ID = 'tng-systems';
const DEPLOY_REGION = 'us-central1'; // matches every other function in this codebase
// Dedicated, narrow runtime identity — NOT shared with any other function.
// Grant it ONLY roles/datastore.user on the tng-systems project (see
// docs/WORKSPACE_IDENTITY_BROKER.md). Non-secret: an SA email is an identifier,
// not a credential.
const RUNTIME_SERVICE_ACCOUNT = 'workspace-identity-broker@tng-systems.iam.gserviceaccount.com';

function bearer(header: string | undefined): string {
  const h = header ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}

/** Broker logger → firebase-functions structured logger (safe fields only). */
const fnLogger: BrokerLogger = (e) => {
  const entry = { msg: e.msg, ...(e.fields ?? {}) };
  if (e.level === 'error') logger.error(entry);
  else if (e.level === 'warn') logger.warn(entry);
  else logger.info(entry);
};

let cachedConfig: BrokerConfig | null = null;

function buildConfig(): BrokerConfig {
  if (cachedConfig) return cachedConfig;

  const audience = process.env.WORKSPACE_BROKER_AUDIENCE;
  const callers = (process.env.WORKSPACE_BROKER_CALLERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const erpProjectId = process.env.WORKSPACE_BROKER_ERP_PROJECT ?? ERP_DATABASE_ID;
  if (!audience || callers.length === 0) {
    throw new Error(
      'workspaceIdentity misconfigured: WORKSPACE_BROKER_AUDIENCE and ' +
        'WORKSPACE_BROKER_CALLERS are required.',
    );
  }
  // Fail closed on a missing ERP project id — token verification MUST be pinned
  // to an explicit Firebase project, never an empty/ambiguous default.
  if (!erpProjectId) {
    throw new Error(
      'workspaceIdentity misconfigured: WORKSPACE_BROKER_ERP_PROJECT is required.',
    );
  }

  const oauthClient = new OAuth2Client();
  const verifyJwtSignature = async (token: string): Promise<OidcClaims> => {
    const ticket = await oauthClient.verifyIdToken({ idToken: token, audience });
    return (ticket.getPayload() ?? {}) as OidcClaims;
  };

  // Verify employee tokens against the ERP Firebase project EXPLICITLY. Using a
  // dedicated Admin app pinned to `erpProjectId` (tng-systems) guarantees
  // verifyIdToken checks the token's aud/iss for that project — never a project
  // inferred from an unrelated credential or the Cloud Run runtime default,
  // which is what rejected valid tng-systems tokens (stage 4,
  // FIREBASE_TOKEN_REJECTED). Firestore keeps using the runtime default app.
  const brokerApp =
    getApps().find((a) => a.name === 'workspace-broker') ??
    initializeApp({ projectId: erpProjectId }, 'workspace-broker');
  const auth = getAuth(brokerApp);
  const verifyFirebaseSignature = async (token: string): Promise<FirebaseClaims> => {
    // SAFE pre-verification breadcrumb: the token's iss/aud/sub vs the project we
    // verify against. Never the token itself. Makes a project mismatch obvious in
    // Cloud Run logs, joined by the caller's x-request-id.
    const c = decodeSafeClaims(token);
    logger.info({
      msg: 'employee token claims',
      token_iss: c.iss,
      token_aud: c.aud,
      token_sub: c.sub,
      broker_project: erpProjectId,
    });
    const decoded = await auth.verifyIdToken(token, true);
    return decoded as unknown as FirebaseClaims;
  };

  const db = getFirestore(getApp(), ERP_DATABASE_ID) as unknown as FirestoreLike;

  cachedConfig = {
    oidc: { audience, approvedCallers: callers, verifyJwtSignature },
    employeeToken: { erpProjectId, verifyFirebaseSignature },
    datastore: firestoreDatastore(db),
    permissionVersion: process.env.WORKSPACE_BROKER_PERM_VERSION ?? 'v1',
    cacheTtlSeconds: process.env.WORKSPACE_BROKER_CACHE_TTL
      ? Number(process.env.WORKSPACE_BROKER_CACHE_TTL)
      : 300,
    log: fnLogger,
  };
  return cachedConfig;
}

export const workspaceIdentity = onRequest(
  {
    region: DEPLOY_REGION,
    // Attach the dedicated narrow runtime SA directly from source — avoids any
    // window where the function would run under the broad default GCF SA.
    serviceAccount: RUNTIME_SERVICE_ACCOUNT,
    // CRITICAL: firebase-tools defaults httpsTrigger.invoker to ["public"] on
    // first deploy when this is left unset. "private" means NO invoker binding
    // is created at deploy time (not even for this account) — the caller SA is
    // granted roles/run.invoker in a separate, explicit, scoped-to-this-service
    // step after deploy. This guarantees no public/allUsers window ever exists.
    invoker: 'private',
  },
  async (req, res) => {
  // Normalize + match the single approved route (POST /resolve). See ./routing.
  // Workspace calls the Cloud Run URL at /resolve; the alias-root / stripped
  // mount presents "/". Everything else is rejected.
  const rawPath = req.path ?? req.url;
  const pathname = normalizePathname(rawPath);

  // Safe routing log — method + normalized pathname only (no token, no PII).
  logger.info({ msg: 'broker request', method: req.method ?? '', pathname });

  // No CORS by design; block preflight explicitly.
  if (req.method === 'OPTIONS') {
    res.status(405).end();
    return;
  }
  if (!isBrokerRoute(req.method, rawPath)) {
    res.status(404).json({ error: 'BAD_REQUEST' });
    return;
  }

  let config: BrokerConfig;
  try {
    config = buildConfig();
  } catch (err) {
    logger.error({ msg: 'broker config error', reason: (err as Error).message });
    res.status(502).json({ error: 'ERP_UNAVAILABLE' });
    return;
  }

  const token = bearer(
    Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization,
  );

  const body =
    req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {};

  const outcome = await resolveIdentity(token, body, config);
  res.setHeader('cache-control', 'no-store');
  res.status(outcome.statusCode).json(outcome.body);
});
