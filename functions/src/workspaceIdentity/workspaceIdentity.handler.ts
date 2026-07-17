/**
 * Workspace Identity Broker — pure resolve pipeline.
 *
 * Follows the repo's handler/wrapper convention: all logic + every gate live
 * here with an injected datastore + injected verifiers, so it is unit-tested
 * with synthetic data (no HTTP, no Firebase, no emulator/Java). The thin
 * `workspaceIdentity.ts` onRequest wrapper binds the real dependencies.
 *
 * Two request shapes, both requiring a valid caller OIDC token:
 *   { firebaseIdToken }  → login: verify the employee token here, then read+project
 *   { erpUserId }        → revalidation: trusted OIDC caller asks for the current
 *                          projection of a known uid (deactivation propagation)
 *
 * The response is assembled by `buildResponse()` (whitelisted keys only), so a
 * raw ERP document, a token, or a financial column has no field to travel in.
 */

import {
  buildResponse,
  BrokerErrorCode,
  BrokerIdentityResponse,
  EMPLOYMENT_STATUS,
  EmploymentStatus,
} from './contract';
import {
  ErpDatastore,
  ErpUserDoc,
  ErpPermissionMatrixDoc,
  permissionTableOf,
} from './datastore';
import { projectWorkspacePermissions } from './projection';
import { verifyCallerIdentity, OidcAuthError, OidcVerifierConfig } from './oidc';
import {
  verifyEmployeeToken,
  EmployeeTokenError,
  EmployeeTokenVerifierConfig,
} from './employeeToken';

export interface ResolveRequest {
  firebaseIdToken?: unknown;
  erpUserId?: unknown;
}

export type BrokerLogger = (event: {
  level: 'info' | 'warn' | 'error';
  msg: string;
  fields?: Record<string, string | number | boolean | null>;
}) => void;

export interface BrokerConfig {
  oidc: OidcVerifierConfig;
  employeeToken: EmployeeTokenVerifierConfig;
  datastore: ErpDatastore;
  permissionVersion?: string;
  cacheTtlSeconds?: number;
  log?: BrokerLogger;
  nowSeconds?: () => number;
}

export type ResolveOutcome =
  | { statusCode: 200; body: BrokerIdentityResponse }
  | { statusCode: 400 | 401 | 404 | 502; body: { error: BrokerErrorCode } };

const STATUS_BY_ERROR: Record<BrokerErrorCode, 400 | 401 | 404 | 502> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  INVALID_EMPLOYEE_TOKEN: 401,
  NO_PROFILE: 404,
  ERP_UNAVAILABLE: 502,
};

const noopLogger: BrokerLogger = () => undefined;

function fail(code: BrokerErrorCode): ResolveOutcome {
  return { statusCode: STATUS_BY_ERROR[code], body: { error: code } };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function normalizeStatus(raw: unknown): EmploymentStatus {
  return (EMPLOYMENT_STATUS as readonly string[]).includes(raw as string)
    ? (raw as EmploymentStatus)
    : 'UNKNOWN';
}
function normalizeUpdatedAt(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (raw && typeof raw === 'object') {
    const anyRaw = raw as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof anyRaw.toDate === 'function') return anyRaw.toDate().toISOString();
    const secs = anyRaw.seconds ?? anyRaw._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000).toISOString();
  }
  return null;
}

function resolvePermissions(
  userDoc: ErpUserDoc,
  matrix: ErpPermissionMatrixDoc | null,
): { role: string; permissions: string[] } {
  const role = str(userDoc.role);
  const table = permissionTableOf(matrix);
  const rolePerms = strArray(table[role]);
  const overrides = strArray(userDoc.permissions);
  return { role, permissions: Array.from(new Set([...rolePerms, ...overrides])) };
}

/** Pure core: raw ERP doc + matrix → minimized contract response. */
export function buildIdentityResponse(
  erpUserId: string,
  userDoc: ErpUserDoc,
  matrix: ErpPermissionMatrixDoc | null,
  opts: { permissionVersion: string; cacheTtlSeconds: number },
): BrokerIdentityResponse {
  const { role, permissions } = resolvePermissions(userDoc, matrix);
  const status = normalizeStatus(userDoc.status);
  const businessId = str(userDoc.businessId);
  const businessUnitIds = strArray(userDoc.businessUnitIds);
  const businessIds = Array.from(
    new Set([businessId, ...businessUnitIds].filter((b) => b.length > 0)),
  );

  // Defense-in-depth: a non-ACTIVE employee carries ZERO eligibility even though
  // status is still reported (so revalidation can act on it).
  const workspacePermissionIds =
    status === 'ACTIVE'
      ? projectWorkspacePermissions({
          role,
          permissions,
          hasBusinessAssignment: businessIds.length > 0,
        })
      : [];

  return buildResponse({
    erp_user_id: erpUserId,
    email: str(userDoc.email),
    display_name: str(userDoc.name),
    status,
    role,
    business_ids: businessIds,
    business_unit_ids: businessUnitIds,
    workspace_permission_ids: workspacePermissionIds,
    profile_updated_at: normalizeUpdatedAt(userDoc.updatedAt),
    permission_version: opts.permissionVersion,
    recommended_cache_ttl_seconds: opts.cacheTtlSeconds,
  });
}

/**
 * Full resolve: caller-auth → employee resolution → narrow read → projection →
 * minimized response. `callerToken` is the caller OIDC bearer token.
 */
export async function resolveIdentity(
  callerToken: string,
  request: ResolveRequest,
  config: BrokerConfig,
): Promise<ResolveOutcome> {
  const log = config.log ?? noopLogger;
  const now = config.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const permissionVersion = config.permissionVersion ?? 'unversioned';
  const cacheTtlSeconds = config.cacheTtlSeconds ?? 300;

  // 1. Caller identity (OIDC) → opaque UNAUTHENTICATED on any failure.
  let callerEmail: string;
  try {
    ({ callerEmail } = await verifyCallerIdentity(callerToken, config.oidc, now()));
  } catch (err) {
    if (err instanceof OidcAuthError) {
      log({ level: 'warn', msg: 'caller rejected', fields: { reason: err.message } });
      return fail('UNAUTHENTICATED');
    }
    throw err;
  }

  // 2. Resolve the employee uid — by token (login) or by uid (revalidation).
  let erpUserId: string;
  const hasToken =
    typeof request.firebaseIdToken === 'string' && request.firebaseIdToken.length > 0;
  const hasUid = typeof request.erpUserId === 'string' && request.erpUserId.length > 0;

  if (hasToken) {
    try {
      const verified = await verifyEmployeeToken(
        request.firebaseIdToken as string,
        config.employeeToken,
        now(),
      );
      erpUserId = verified.erpUserId;
    } catch (err) {
      if (err instanceof EmployeeTokenError) {
        log({ level: 'warn', msg: 'employee token rejected', fields: { caller: callerEmail } });
        return fail('INVALID_EMPLOYEE_TOKEN');
      }
      throw err;
    }
  } else if (hasUid) {
    erpUserId = request.erpUserId as string;
  } else {
    return fail('BAD_REQUEST');
  }

  // 3. Narrow datastore read (two point-gets only).
  let userDoc: ErpUserDoc | null;
  let matrix: ErpPermissionMatrixDoc | null;
  try {
    [userDoc, matrix] = await Promise.all([
      config.datastore.getUserDoc(erpUserId),
      config.datastore.getPermissionMatrix(),
    ]);
  } catch (err) {
    log({ level: 'error', msg: 'datastore read failed', fields: { caller: callerEmail } });
    void err;
    return fail('ERP_UNAVAILABLE');
  }

  if (!userDoc) {
    log({ level: 'info', msg: 'no profile', fields: { caller: callerEmail } });
    return fail('NO_PROFILE');
  }

  // 4-5. Project + assemble the minimized response.
  const body = buildIdentityResponse(erpUserId, userDoc, matrix, {
    permissionVersion,
    cacheTtlSeconds,
  });

  // Log ONLY safe, minimized fields — never the employee email/name/token/doc.
  log({
    level: 'info',
    msg: 'resolved',
    fields: {
      caller: callerEmail,
      status: body.status,
      role: body.role,
      permission_count: body.workspace_permission_ids.length,
      business_count: body.business_ids.length,
    },
  });

  return { statusCode: 200, body };
}
