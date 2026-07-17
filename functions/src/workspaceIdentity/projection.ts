import { WORKSPACE_PERMISSION_IDS, WorkspacePermissionId } from './contract';

/**
 * ERP → Workspace permission PROJECTION (the allowlist).
 *
 * PURE. The single place raw ERP roles/permissions become the closed Workspace
 * permission-id vocabulary. Everything not explicitly mapped is DISCARDED — the
 * broker never returns a raw ERP permission string, so a new/unknown ERP
 * permission cannot leak through or silently widen access.
 *
 * Rules mirror the TNG permission model (SystemRole SUPER_ADMIN/ADMIN +
 * DEFAULT_BUSINESS_ROLES MANAGER/EMPLOYEE/CIC/PURCHASING_OFFICER/FINANCE/
 * FINANCE_HEAD/AUDITOR/GENERAL_MANAGER/BOARD_OF_DIRECTOR) and the Workspace
 * permission contract. Resolution upstream is `role matrix ∪ per-user overrides`
 * (matching src/hooks/usePermissions.ts).
 */

const MANAGEMENT_PERMISSION_PREFIXES = ['admin:user:', 'admin:settings:'];
const FINANCE_PERMISSION_PREFIX = 'finance:';

export interface ErpAuthzInput {
  role: string;
  /** Resolved ERP permission strings (role matrix ∪ per-user overrides). */
  permissions: string[];
  /** Whether the employee has ≥1 ERP business assignment (Workspace still gates mapped businesses). */
  hasBusinessAssignment: boolean;
}

export function projectWorkspacePermissions(input: ErpAuthzInput): WorkspacePermissionId[] {
  const out = new Set<WorkspacePermissionId>();

  if (input.hasBusinessAssignment) out.add('workspace.access');

  const perms = Array.isArray(input.permissions) ? input.permissions : [];
  const hasMgmtPerm = perms.some((p) =>
    MANAGEMENT_PERMISSION_PREFIXES.some((prefix) => p.startsWith(prefix)),
  );
  const hasFinancePerm = perms.some((p) => p.startsWith(FINANCE_PERMISSION_PREFIX));

  switch (input.role) {
    case 'SUPER_ADMIN':
      out.add('workspace.admin');
      out.add('channel.management');
      out.add('channel.finance');
      out.add('channel.hr');
      out.add('channel.audit');
      out.add('channel.founders');
      break;
    case 'ADMIN':
      out.add('workspace.admin');
      out.add('channel.management');
      out.add('channel.hr'); // interim HR eligibility per the contract
      out.add('channel.audit');
      if (hasFinancePerm) out.add('channel.finance');
      break;
    case 'GENERAL_MANAGER':
      out.add('workspace.admin');
      out.add('channel.management');
      break;
    case 'MANAGER':
      if (hasMgmtPerm) out.add('channel.management'); // title alone grants nothing
      break;
    case 'FINANCE':
    case 'FINANCE_HEAD':
      out.add('channel.finance');
      break;
    case 'AUDITOR':
    case 'BOARD_OF_DIRECTOR':
      out.add('channel.audit');
      break;
    default:
      // EMPLOYEE / CIC / PURCHASING_OFFICER / unknown → baseline only (fail closed).
      break;
  }

  // Per-user overrides participate ONLY through the allowlist; every other raw
  // ERP permission string is discarded.
  if (hasFinancePerm) out.add('channel.finance');
  if (hasMgmtPerm) out.add('channel.management');

  return WORKSPACE_PERMISSION_IDS.filter((id) => out.has(id));
}
