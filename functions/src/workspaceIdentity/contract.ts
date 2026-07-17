/**
 * Workspace Identity Broker — response contract (ERP-owned source of truth).
 *
 * This is the ONLY shape that crosses the ERP → Workspace boundary. It is
 * identity + authorization ONLY. No customer, financial, order, inventory,
 * purchasing, payroll, POS-PIN, token, or service-account material can appear —
 * by construction, because there is no field for it, and because responses are
 * assembled by `buildResponse()` which whitelists exactly these keys.
 *
 * The repo has no zod dependency, so strictness is enforced by hand:
 *   - `buildResponse()` emits ONLY the contract keys (a stray source field has
 *     nowhere to go), and
 *   - `assertStrict()` rejects any object carrying an unexpected key (used by
 *     the tests and as a defensive self-check), mirroring the Workspace-side
 *     `.strict()` parser.
 *
 * Keep in lock-step with the Workspace copy
 * (tng-workspace: src/server/erp/broker-contract.ts) and the contract doc.
 */

export const EMPLOYMENT_STATUS = [
  'ACTIVE',
  'PENDING_APPROVAL',
  'REJECTED',
  'INACTIVE',
  'UNKNOWN',
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUS)[number];

/** Closed Workspace permission-id vocabulary the broker projects into. */
export const WORKSPACE_PERMISSION_IDS = [
  'workspace.access',
  'workspace.admin',
  'channel.management',
  'channel.finance',
  'channel.hr',
  'channel.audit',
  'channel.founders',
] as const;
export type WorkspacePermissionId = (typeof WORKSPACE_PERMISSION_IDS)[number];

export interface BrokerIdentityResponse {
  erp_user_id: string;
  email: string;
  display_name: string;
  status: EmploymentStatus;
  role: string;
  business_ids: string[];
  business_unit_ids: string[];
  workspace_permission_ids: WorkspacePermissionId[];
  profile_updated_at: string | null;
  permission_version: string;
  recommended_cache_ttl_seconds: number;
}

/** The exact, closed set of keys a response may contain. */
export const RESPONSE_KEYS: ReadonlyArray<keyof BrokerIdentityResponse> = [
  'erp_user_id',
  'email',
  'display_name',
  'status',
  'role',
  'business_ids',
  'business_unit_ids',
  'workspace_permission_ids',
  'profile_updated_at',
  'permission_version',
  'recommended_cache_ttl_seconds',
];

/**
 * Assemble a response from raw values, emitting ONLY the whitelisted keys.
 * Anything not named here cannot travel — this is the primary data-minimization
 * guarantee on the ERP side.
 */
export function buildResponse(fields: BrokerIdentityResponse): BrokerIdentityResponse {
  return {
    erp_user_id: fields.erp_user_id,
    email: fields.email,
    display_name: fields.display_name,
    status: fields.status,
    role: fields.role,
    business_ids: fields.business_ids,
    business_unit_ids: fields.business_unit_ids,
    workspace_permission_ids: fields.workspace_permission_ids,
    profile_updated_at: fields.profile_updated_at,
    permission_version: fields.permission_version,
    recommended_cache_ttl_seconds: fields.recommended_cache_ttl_seconds,
  };
}

/**
 * Throw if `value` is not a shape-valid response OR carries any unexpected key.
 * Mirrors the Workspace `.strict()` parser so both ends reject drift.
 */
export function assertStrict(value: unknown): asserts value is BrokerIdentityResponse {
  if (typeof value !== 'object' || value === null) {
    throw new Error('broker response must be an object');
  }
  const obj = value as Record<string, unknown>;
  const allowed = new Set<string>(RESPONSE_KEYS as ReadonlyArray<string>);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new Error(`broker response has unexpected key: ${key}`);
    }
  }
  if (typeof obj.erp_user_id !== 'string' || obj.erp_user_id.length === 0) {
    throw new Error('erp_user_id invalid');
  }
  if (typeof obj.email !== 'string') throw new Error('email invalid');
  if (typeof obj.display_name !== 'string') throw new Error('display_name invalid');
  if (!(EMPLOYMENT_STATUS as readonly string[]).includes(obj.status as string)) {
    throw new Error('status invalid');
  }
  if (typeof obj.role !== 'string') throw new Error('role invalid');
  if (!Array.isArray(obj.business_ids)) throw new Error('business_ids invalid');
  if (!Array.isArray(obj.business_unit_ids)) throw new Error('business_unit_ids invalid');
  if (!Array.isArray(obj.workspace_permission_ids)) throw new Error('workspace_permission_ids invalid');
  for (const id of obj.workspace_permission_ids as unknown[]) {
    if (!(WORKSPACE_PERMISSION_IDS as readonly string[]).includes(id as string)) {
      throw new Error(`workspace_permission_ids contains non-allowlisted id: ${String(id)}`);
    }
  }
  if (obj.profile_updated_at !== null && typeof obj.profile_updated_at !== 'string') {
    throw new Error('profile_updated_at invalid');
  }
  if (typeof obj.permission_version !== 'string') throw new Error('permission_version invalid');
  if (
    typeof obj.recommended_cache_ttl_seconds !== 'number' ||
    obj.recommended_cache_ttl_seconds < 0 ||
    obj.recommended_cache_ttl_seconds > 900
  ) {
    throw new Error('recommended_cache_ttl_seconds invalid');
  }
}

/** Stable machine error codes. */
export const BROKER_ERROR_CODES = [
  'UNAUTHENTICATED',
  'INVALID_EMPLOYEE_TOKEN',
  'NO_PROFILE',
  'ERP_UNAVAILABLE',
  'BAD_REQUEST',
] as const;
export type BrokerErrorCode = (typeof BROKER_ERROR_CODES)[number];
