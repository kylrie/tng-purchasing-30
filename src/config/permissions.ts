import { UserRole } from '../features/procurement/types';

/**
 * Defines all possible granular permissions in the system.
 * Format: 'feature:action' or 'feature:action:scope'
 */
export const ALL_PERMISSIONS = [
  // Requisition Creation
  'requisition:create:burf',  // Create new BURF
  'requisition:prepare:prf',  // Prepare PRF from approved BURF
  'requisition:create:prf',   // Create Direct PRF (without BURF)

  // Requisition Lifecycle
  'requisition:edit:draft',
  'requisition:refile:rejected',
  'requisition:cancel',
  'requisition:print',

  // Approval Workflow
  'approval:manager:burf',
  'approval:cic:burf',
  'approval:manager:prf',
  'approval:finance_head:br',  // 7-Stage: Finance Head Budget Review
  'approval:gm:br',            // 7-Stage: GM Budget Review
  'approval:cfo',              // 7-Stage: CFO Approval
  'approval:bod',              // 7-Stage: BOD Approval
  'approval:view:history',

  // Finance Workflow
  'finance:release_funds',
  'finance:view_cheque',
  'finance:upload_check',  // Upload check number + link for Check Preparation step
  'liquidation:view',
  'liquidation:file:own',
  'liquidation:file:all',
  'liquidation:audit',
  'liquidation:print',

  // PCF (Petty Cash Fund)
  'pcf:view:own',
  'pcf:view:all',
  'pcf:view:history:all',  // Per-user: View all PCF history (not just own)
  'pcf:create',
  'pcf:approve',
  'pcf:cancel',       // Cancel PCF liquidations (returns balance)

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

  // Inventory Management
  'inventory:manage:uom',

  // Chart of Accounts
  'coa:view',           // View Chart of Accounts
  'coa:manage',         // Create, edit, import, toggle active status

  // Module View Permissions
  'module:view:dashboard',
  'module:view:burf',
  'module:view:prf',
  'module:view:approvals',
  'module:view:approved',
  'module:view:finance',
  'module:view:finance:br',           // View BR (Budget Request) sub-tab in Finance
  'module:view:finance:check_auth',   // View Check Auth (BOD) sub-tab in Finance
  'module:view:liquidation',
  'module:view:pcf',
  'module:view:pcf_approvals',
  'module:view:suppliers',
  'module:view:settings',
  'module:view:coa',          // View Chart of Accounts module
  'module:view:prf_tracker',  // View PRF Tracker (Kanban view for requisition flow)

  // UI Component Visibility (deprecated, use module:view instead)
  'ui:view:approvals_page',
  'ui:view:settings_page',

  // Dashboard Widget Visibility
  'dashboard:widget:pending_approvals',
  'dashboard:widget:active_prfs',
  'dashboard:widget:ready_for_prf',
  'dashboard:widget:total_spend',
  'dashboard:widget:pending_audit',
  'dashboard:widget:pcf_approvals',
  'dashboard:widget:overdue_items',
  'dashboard:widget:avg_processing',
  'dashboard:widget:completed_month',
  'dashboard:widget:top_requesters',
  'dashboard:section:pending_list',
  'dashboard:section:ready_for_prf_list',
  'dashboard:section:pending_fund_release',
  'dashboard:section:pending_audit_list',

] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export const ROLES_TO_PERMISSIONS: Record<UserRole, Permission[]> = {
  // All-powerful role
  [UserRole.SUPER_ADMIN]: [...ALL_PERMISSIONS],

  // Can manage users and businesses, but not all requisitions
  [UserRole.ADMIN]: [
    'requisition:cancel',
    'requisition:print',
    'requisition:view:all',
    'liquidation:view',
    'liquidation:file:all',
    'liquidation:print',
    'finance:view_cheque',
    'admin:manage:users',
    'admin:manage:businesses',
    'admin:view:user_approvals',
    'inventory:manage:uom',
    'approval:view:history',
    'ui:view:settings_page',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:finance',
    'module:view:finance:br',
    'module:view:finance:check_auth',
    'module:view:liquidation',
    'module:view:pcf',
    'module:view:pcf_approvals',
    'module:view:suppliers',
    'module:view:settings',
    'pcf:view:all',
    'pcf:approve',
    // Dashboard Widgets
    'dashboard:widget:pending_approvals',
    'dashboard:widget:active_prfs',
    'dashboard:widget:ready_for_prf',
    'dashboard:widget:total_spend',
    'dashboard:widget:pending_audit',
    'dashboard:widget:pcf_approvals',
    'dashboard:widget:overdue_items',
    'dashboard:widget:avg_processing',
    'dashboard:widget:completed_month',
    'dashboard:widget:top_requesters',
    'dashboard:section:pending_list',
    'dashboard:section:ready_for_prf_list',
    'dashboard:section:pending_fund_release',
    'dashboard:section:pending_audit_list',
    // Chart of Accounts
    'coa:view',
    'coa:manage',
    'module:view:coa',
  ],

  // High-level approver, global view
  [UserRole.GENERAL_MANAGER]: [
    'requisition:view:all',
    'requisition:print',
    'approval:manager:burf',
    'approval:manager:prf',
    'approval:finance_head:br',  // Finance Head BR
    'approval:cfo',              // CFO Approval
    'approval:bod',              // BOD Approval
    'approval:view:history',
    'ui:view:approvals_page',
    'liquidation:view',
    'liquidation:file:own',
    'liquidation:print',
    'finance:view_cheque',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:liquidation',
    'module:view:pcf',
    'module:view:pcf_approvals',
    'pcf:view:all',
    'pcf:approve',
    // Dashboard Widgets
    'dashboard:widget:pending_approvals',
    'dashboard:widget:active_prfs',
    'dashboard:widget:ready_for_prf',
    'dashboard:widget:total_spend',
    'dashboard:widget:pending_audit',
    'dashboard:widget:pcf_approvals',
    'dashboard:widget:overdue_items',
    'dashboard:widget:avg_processing',
    'dashboard:widget:completed_month',
    'dashboard:widget:top_requesters',
    'dashboard:section:pending_list',
    'dashboard:section:ready_for_prf_list',
    'dashboard:section:pending_fund_release',
    'dashboard:section:pending_audit_list',
  ],

  // View-only global role + BOD approval capability
  [UserRole.BOARD_OF_DIRECTOR]: [
    'requisition:view:all',
    'requisition:print',
    'liquidation:view',
    'liquidation:print',
    'finance:view_cheque',
    'approval:view:history',
    'approval:bod',  // 7-Stage: BOD can approve at final stage
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approved',
    'module:view:liquidation',
    'module:view:approvals',  // Need to see approvals queue
    // Dashboard Widgets
    'dashboard:widget:active_prfs',
    'dashboard:widget:total_spend',
    'dashboard:widget:pending_approvals',
    'dashboard:section:pending_list',
  ],

  // Approver for their specific business unit
  [UserRole.MANAGER]: [
    'requisition:create:burf',
    'requisition:refile:rejected',
    'requisition:view:business_unit',
    'requisition:print',
    'approval:manager:burf',
    'approval:manager:prf',
    'approval:view:history',
    'ui:view:approvals_page',
    'liquidation:file:own',
    'liquidation:print',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:liquidation',
    'module:view:pcf',
    'module:view:pcf_approvals',
    'pcf:view:all',
    'pcf:approve',
    // Dashboard Widgets
    'dashboard:widget:pending_approvals',
    'dashboard:widget:active_prfs',
    'dashboard:widget:ready_for_prf',
    'dashboard:widget:pending_audit',
    'dashboard:widget:pcf_approvals',
    'dashboard:widget:overdue_items',
    'dashboard:widget:avg_processing',
    'dashboard:widget:completed_month',
    'dashboard:widget:top_requesters',
    'dashboard:section:pending_list',
  ],

  // Basic user, can only create requests and see their own
  [UserRole.EMPLOYEE]: [
    'requisition:create:burf',
    'requisition:refile:rejected',
    'requisition:view:own',
    'requisition:print',
    'liquidation:file:own',
    'liquidation:print',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:liquidation',
    'module:view:pcf',
    'module:view:prf_tracker',  // Track own requisitions
    'pcf:view:own',
    'pcf:create',
    // Dashboard Widgets (limited)
    'dashboard:widget:pending_audit',
  ],

  // Specialist approver with global view
  [UserRole.CIC]: [
    'requisition:view:all',
    'requisition:print',
    'approval:cic:burf',
    'approval:view:history',
    'ui:view:approvals_page',
    'liquidation:view',
    'liquidation:print',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:liquidation',
    // Dashboard Widgets
    'dashboard:widget:pending_approvals',
    'dashboard:widget:active_prfs',
    'dashboard:section:pending_list',
  ],

  // Creates PRFs and manages suppliers
  [UserRole.PURCHASING_OFFICER]: [
    'requisition:prepare:prf',  // Prepare PRF from approved BURF
    'requisition:create:prf',   // Create Direct PRF
    'requisition:view:all',
    'requisition:print',
    'supplier:view',
    'supplier:create',
    'supplier:edit',
    'supplier:delete',
    'liquidation:view',
    'liquidation:file:own',
    'liquidation:print',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approved',
    'module:view:liquidation',
    'module:view:suppliers',
    'module:view:prf_tracker',  // Track PRFs they prepared
    'inventory:manage:uom',
    // Dashboard Widgets
    'dashboard:widget:active_prfs',
    'dashboard:widget:ready_for_prf',
    'dashboard:widget:total_spend',
    'dashboard:widget:pending_audit',
    'dashboard:section:ready_for_prf_list',
  ],

  // Handles money, releases funds
  [UserRole.FINANCE]: [
    'requisition:view:all',
    'requisition:print',
    'finance:release_funds',
    'finance:view_cheque',
    'finance:upload_check',  // Check Preparation step
    'liquidation:view',
    'liquidation:file:all',
    'liquidation:print',
    'approval:view:history',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:finance',
    'module:view:finance:br',
    'module:view:finance:check_auth',
    'module:view:liquidation',
    'dashboard:widget:pending_approvals',
    'dashboard:widget:active_prfs',
    'dashboard:widget:total_spend',
    'dashboard:widget:pending_audit',
    'dashboard:section:pending_list',
    'dashboard:section:pending_fund_release',
    // Chart of Accounts (Finance can view for liquidation classification)
    'coa:view',
    'module:view:coa',
  ],

  // Audits liquidations
  [UserRole.AUDITOR]: [
    'requisition:view:all',
    'requisition:print',
    'liquidation:view',
    'liquidation:audit',
    'liquidation:print',
    'finance:view_cheque',
    'approval:view:history',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approvals',
    'module:view:approved',
    'module:view:liquidation',
    // Dashboard Widgets
    'dashboard:widget:pending_audit',
    'dashboard:widget:total_spend',
    'dashboard:section:pending_audit_list',
  ],
};
