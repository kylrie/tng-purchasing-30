import { UserRole } from '../features/procurement/types';

/**
 * Defines all possible granular permissions in the system.
 * Format: 'feature:action' or 'feature:action:scope'
 */
export const ALL_PERMISSIONS = [
  // Requisition Lifecycle
  'requisition:create:burf',
  'requisition:create:prf',
  'requisition:edit:draft',
  'requisition:refile:rejected',
  'requisition:cancel',

  // Approval Workflow
  'approval:manager:burf',
  'approval:cic:burf',
  'approval:manager:prf',

  // Finance Workflow
  'finance:release_funds',
  'finance:audit_liquidation',

  // Data Visibility
  'requisition:view:own',
  'requisition:view:business_unit',
  'requisition:view:all',

  // Supplier Management
  'supplier:view',
  'supplier:create',
  'supplier:edit',
  'supplier:delete',

  // Admin Functions
  'admin:manage:users',
  'admin:manage:businesses',
  'admin:manage:permissions',
  'admin:view:user_approvals',

  // UI Component Visibility
  'ui:view:approvals_page',
  'ui:view:settings_page',

] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export const ROLES_TO_PERMISSIONS: Record<UserRole, Permission[]> = {
  // All-powerful role
  [UserRole.SUPER_ADMIN]: [...ALL_PERMISSIONS],

  // Can manage users and businesses, but not all requisitions
  [UserRole.ADMIN]: [
    'requisition:cancel',
    'requisition:view:all',
    'admin:manage:users',
    'admin:manage:businesses',
    'admin:view:user_approvals',
    'ui:view:settings_page',
  ],

  // High-level approver, global view
  [UserRole.GENERAL_MANAGER]: [
    'requisition:view:all',
    'approval:manager:burf',
    'approval:manager:prf',
    'ui:view:approvals_page',
  ],
  
  // View-only global role
  [UserRole.BOARD_OF_DIRECTOR]: [
    'requisition:view:all',
  ],

  // Approver for their specific business unit
  [UserRole.MANAGER]: [
    'requisition:create:burf',
    'requisition:refile:rejected',
    'requisition:view:business_unit',
    'approval:manager:burf',
    'approval:manager:prf',
    'ui:view:approvals_page',
  ],

  // Basic user, can only create requests and see their own
  [UserRole.EMPLOYEE]: [
    'requisition:create:burf',
    'requisition:refile:rejected',
    'requisition:view:own',
  ],

  // Specialist approver with global view
  [UserRole.CIC]: [
    'requisition:view:all',
    'approval:cic:burf',
    'ui:view:approvals_page',
  ],

  // Creates PRFs and manages suppliers
  [UserRole.PURCHASING_OFFICER]: [
    'requisition:create:prf',
    'requisition:view:all',
    'supplier:view',
    'supplier:create',
    'supplier:edit',
    'supplier:delete',
  ],

  // Handles money, releases funds
  [UserRole.FINANCE]: [
    'requisition:view:all',
    'finance:release_funds',
  ],

  // Audits liquidations
  [UserRole.AUDITOR]: [
    'requisition:view:all',
    'finance:audit_liquidation',
  ],
};
