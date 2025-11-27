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
  'liquidation:view',
  'liquidation:file:own',
  'liquidation:file:all',
  'liquidation:audit',

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

  // Module View Permissions
  'module:view:dashboard',
  'module:view:burf',
  'module:view:prf',
  'module:view:approvals',
  'module:view:approved',
  'module:view:finance',
  'module:view:liquidation',
  'module:view:suppliers',
  'module:view:settings',

  // UI Component Visibility (deprecated, use module:view instead)
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
    'liquidation:view',
    'liquidation:file:all',
    'admin:manage:users',
    'admin:manage:businesses',
    'admin:view:user_approvals',
    'ui:view:settings_page',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:finance',
    'module:view:liquidation',
    'module:view:suppliers',
    'module:view:settings',
  ],

  // High-level approver, global view
  [UserRole.GENERAL_MANAGER]: [
    'requisition:view:all',
    'approval:manager:burf',
    'approval:manager:prf',
    'ui:view:approvals_page',
    'liquidation:view',
    'liquidation:file:own',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:liquidation',
  ],

  // View-only global role
  [UserRole.BOARD_OF_DIRECTOR]: [
    'requisition:view:all',
    'liquidation:view',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approved',
    'module:view:liquidation',
  ],

  // Approver for their specific business unit
  [UserRole.MANAGER]: [
    'requisition:create:burf',
    'requisition:refile:rejected',
    'requisition:view:business_unit',
    'approval:manager:burf',
    'approval:manager:prf',
    'ui:view:approvals_page',
    'liquidation:file:own',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:liquidation',
  ],

  // Basic user, can only create requests and see their own
  [UserRole.EMPLOYEE]: [
    'requisition:create:burf',
    'requisition:refile:rejected',
    'requisition:view:own',
    'liquidation:file:own',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:liquidation',
  ],

  // Specialist approver with global view
  [UserRole.CIC]: [
    'requisition:view:all',
    'approval:cic:burf',
    'ui:view:approvals_page',
    'liquidation:view',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:liquidation',
  ],

  // Creates PRFs and manages suppliers
  [UserRole.PURCHASING_OFFICER]: [
    'requisition:create:prf',
    'requisition:view:all',
    'supplier:view',
    'supplier:create',
    'supplier:edit',
    'supplier:delete',
    'liquidation:view',
    'liquidation:file:own',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approved',
    'module:view:liquidation',
    'module:view:suppliers',
  ],

  // Handles money, releases funds
  [UserRole.FINANCE]: [
    'requisition:view:all',
    'finance:release_funds',
    'liquidation:view',
    'liquidation:file:all',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approved',
    'module:view:finance',
    'module:view:liquidation',
  ],

  // Audits liquidations
  [UserRole.AUDITOR]: [
    'requisition:view:all',
    'liquidation:view',
    'liquidation:audit',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approved',
    'module:view:liquidation',
  ],
};
