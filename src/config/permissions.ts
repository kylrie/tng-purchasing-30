import { UserRole } from '../features/procurement/types';

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION STRINGS  (format: 'domain:resource:action[:scope]')
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_PERMISSIONS = [

  // ─── PROCUREMENT: BURF ────────────────────────────────────────────────
  'procurement:burf:view:own',
  'procurement:burf:view:bu',
  'procurement:burf:view:all',
  'procurement:burf:create',
  'procurement:burf:edit:draft',
  'procurement:burf:delete',
  'procurement:burf:cancel',
  'procurement:burf:approve:manager',
  'procurement:burf:approve:cic',

  // ─── PROCUREMENT: PRF ─────────────────────────────────────────────────
  'procurement:prf:view:own',
  'procurement:prf:view:all',
  'procurement:prf:create:direct',
  'procurement:prf:create:from_burf',
  'procurement:prf:edit',
  'procurement:prf:delete',
  'procurement:prf:approve:manager',

  // ─── PROCUREMENT: PRF TRACKER ─────────────────────────────────────────
  'procurement:prf_tracker:view:all',
  'procurement:prf_tracker:edit',

  // ─── PROCUREMENT: APPROVED LIST ───────────────────────────────────────
  'procurement:approved:view:all',

  // ─── PROCUREMENT: APPROVALS ───────────────────────────────────────────
  'procurement:approval:view:history',
  'procurement:approval:approve:skip_signature',

  // ─── FINANCE: OVERVIEW ────────────────────────────────────────────────
  'finance:overview:view:all',

  // ─── FINANCE: INCOME / SALES ──────────────────────────────────────────
  'finance:income:view:all',
  'finance:income:create',
  'finance:income:edit',
  'finance:income:delete',

  // ─── FINANCE: TRANSACTIONS ────────────────────────────────────────────
  'finance:transaction:view:all',
  'finance:transaction:export',

  // ─── FINANCE: LIQUIDATION ─────────────────────────────────────────────
  'finance:liquidation:view:all',
  'finance:liquidation:create:own',
  'finance:liquidation:create:all',
  'finance:liquidation:edit',
  'finance:liquidation:delete',
  'finance:liquidation:audit',

  // ─── FINANCE: PCF ─────────────────────────────────────────────────────
  'finance:pcf:view:all',
  'finance:pcf:view:history',
  'finance:pcf:create',
  'finance:pcf:edit',
  'finance:pcf:delete',
  'finance:pcf:approve',
  'finance:pcf:cancel',
  'finance:pcf:audit',

  // ─── FINANCE: CHEQUE / FUND RELEASE ──────────────────────────────────
  'finance:cheque:view:all',
  'finance:cheque:release',
  'finance:cheque:upload',
  'finance:cheque:authorize',
  'finance:cheque:delete',

  // ─── FINANCE: BUDGET REQUEST ──────────────────────────────────────────
  'finance:budget_request:view:all',
  'finance:budget_request:create',
  'finance:budget_request:edit',
  'finance:budget_request:delete',
  'finance:budget_request:approve:finance_head',
  'finance:budget_request:approve:gm',
  'finance:budget_request:approve:bod',
  'finance:budget_request:approve:cfo',

  // ─── FINANCE: BANK RECONCILIATION ─────────────────────────────────────
  'finance:bank_recon:view:all',
  'finance:bank_recon:edit:remarks',
  'finance:bank_recon:delete',
  'finance:bank_recon:upload',
  'finance:bank_recon:audit',

  // ─── AUDIT MODULE ─────────────────────────────────────────────────────
  'audit:income:view:own',
  'audit:income:view:bu',
  'audit:income:view:all',
  'audit:income:approve',
  'audit:income:reject',
  
  'audit:pcf:view:own',
  'audit:pcf:view:bu',
  'audit:pcf:view:all',
  'audit:pcf:approve',
  'audit:pcf:reject',
  
  'audit:liquidation:view:own',
  'audit:liquidation:view:bu',
  'audit:liquidation:view:all',
  'audit:liquidation:approve',
  'audit:liquidation:reject',
  // ─── ADMIN: USERS ─────────────────────────────────────────────────────
  'admin:user:view:all',
  'admin:user:view:pending',
  'admin:user:create',
  'admin:user:edit',
  'admin:user:delete',
  'admin:user:reset_password',
  'admin:user:impersonate',
  'admin:user:deactivate',

  // ─── ADMIN: BUSINESS UNITS ────────────────────────────────────────────
  'admin:business:view:all',
  'admin:business:create',
  'admin:business:edit',
  'admin:business:delete',

  // ─── ADMIN: PERMISSIONS ───────────────────────────────────────────────
  'admin:permission:view',
  'admin:permission:edit',

  // ─── ADMIN: CHART OF ACCOUNTS ─────────────────────────────────────────
  'admin:coa:view:all',
  'admin:coa:create',
  'admin:coa:edit',
  'admin:coa:delete',

  // ─── ADMIN: SETTINGS ──────────────────────────────────────────────────
  'admin:settings:view',
  'admin:settings:edit',

  // ─── ADMIN: ACTIVITY LOG ──────────────────────────────────────────────
  'admin:activity_log:view:all',

  // ─── INVENTORY: ITEMS ─────────────────────────────────────────────────
  'inventory:item:view:all',
  'inventory:item:view:bu',
  'inventory:item:create',
  'inventory:item:edit',
  'inventory:item:delete',

  // ─── INVENTORY: STOCK TAKE ────────────────────────────────────────────
  'inventory:stock_take:view:all',
  'inventory:stock_take:view:bu',
  'inventory:stock_take:create',
  'inventory:stock_take:edit',
  'inventory:stock_take:delete',
  'inventory:stock_take:approve_adjustment',
  'inventory:stock_take:freeze',

  // ─── INVENTORY: GOODS RECEIVING ───────────────────────────────────────
  'inventory:receiving:view:all',
  'inventory:receiving:view:bu',
  'inventory:receiving:create',
  'inventory:receiving:edit',
  'inventory:receiving:delete',
  'inventory:receiving:reject',
  'inventory:receiving:print_barcode',

  // ─── INVENTORY: WASTAGE ───────────────────────────────────────────────
  'inventory:wastage:view:all',
  'inventory:wastage:view:bu',
  'inventory:wastage:create',
  'inventory:wastage:edit',
  'inventory:wastage:delete',

  // ─── INVENTORY: VARIANCE ──────────────────────────────────────────────
  'inventory:variance:view:all',
  'inventory:variance:create',
  'inventory:variance:edit',
  'inventory:variance:delete',

  // ─── INVENTORY: ASSETS ────────────────────────────────────────────────
  'inventory:asset:view:all',
  'inventory:asset:create',
  'inventory:asset:edit',
  'inventory:asset:delete',

  // ─── INVENTORY: REPORTS ───────────────────────────────────────────────
  'inventory:report:view:all',
  'inventory:report:export',

  // ─── INVENTORY: UNITS OF MEASURE ─────────────────────────────────────
  'inventory:uom:view:all',
  'inventory:uom:create',
  'inventory:uom:edit',
  'inventory:uom:delete',

  // ─── MASTER DATA: SUPPLIERS ───────────────────────────────────────────
  'master_data:supplier:view:all',
  'master_data:supplier:create',
  'master_data:supplier:edit',
  'master_data:supplier:delete',

  // ─── MASTER DATA: BUDGET LIMITS ───────────────────────────────────────
  'master_data:budget:view:all',
  'master_data:budget:create',
  'master_data:budget:edit',
  'master_data:budget:delete',

  // ─── MENU & KITCHEN: RECIPES ──────────────────────────────────────────
  'menu:recipe:view:all',
  'menu:recipe:create',
  'menu:recipe:edit',
  'menu:recipe:delete',

  // ─── MENU & KITCHEN: PRODUCTION LOGS ─────────────────────────────────
  'menu:production_log:view:all',
  'menu:production_log:create',
  'menu:production_log:edit',
  'menu:production_log:delete',

  // ─── MENU & KITCHEN: FINISHED GOODS ──────────────────────────────────
  'menu:finished_goods:view:all',
  'menu:finished_goods:create',
  'menu:finished_goods:edit',
  'menu:finished_goods:delete',

  // ─── POINT OF SALE: SALES ─────────────────────────────────────────────
  'pos:sales:view:all',
  'pos:sales:create',
  'pos:sales:edit',
  'pos:sales:delete',

  // ─── POINT OF SALE: IMPORT ────────────────────────────────────────────
  'pos:import:view:all',
  'pos:import:create',
  'pos:import:delete',

  // ─── UI: MODULE ACCESS ────────────────────────────────────────────────
  'ui:module_access:view:burf',
  'ui:module_access:view:prf',
  'ui:module_access:view:prf_tracker',
  'ui:module_access:view:approvals',
  'ui:module_access:view:approved',
  'ui:module_access:view:finance',
  'ui:module_access:view:pcf',
  'ui:module_access:view:suppliers',
  'ui:module_access:view:coa',
  'ui:module_access:view:settings',
  'ui:module_access:view:bank_recon',
  'ui:module_access:view:liquidation',
  'ui:module_access:view:inventory',
  'ui:module_access:view:pos',
  'ui:module_access:view:menu',
  'ui:module_access:view:audit',
  'ui:module_access:view:activity_log',
  'ui:module_access:view:budget_request',

  // ─── UI: DASHBOARD WIDGETS ────────────────────────────────────────────
  'ui:widget:view:ready_for_prf',
  'ui:widget:view:total_spend',
  'ui:widget:view:overdue_items',
  'ui:widget:view:avg_processing',
  'ui:widget:view:completed_month',
  'ui:widget:view:top_requesters',
  'ui:section:view:finance_head_br',
  'ui:section:view:gm_br',
  'ui:section:view:bod_br',
  'ui:section:view:check_auth',
  'ui:section:view:pending_list',
  'ui:section:view:ready_for_prf_list',
  'ui:section:view:pending_fund_release',
  'ui:section:view:pending_audit_list',

] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION REGISTRY  (human-readable metadata for the UI)
// ═══════════════════════════════════════════════════════════════════════════

export const PERMISSION_REGISTRY: Record<Permission, { label: string; category: string; description?: string }> = {

  // ─── PROCUREMENT: BURF ────────────────────────────────────────────────
  'procurement:burf:view:own':          { label: 'View Own BURFs',           category: 'Procurement: BURF',     description: 'View BURF records created by the user.' },
  'procurement:burf:view:bu':           { label: 'View BU BURFs',            category: 'Procurement: BURF',     description: 'View all BURFs in the user\'s business unit.' },
  'procurement:burf:view:all':          { label: 'View All BURFs',           category: 'Procurement: BURF',     description: 'View all BURFs across all business units.' },
  'procurement:burf:create':            { label: 'Create BURF',              category: 'Procurement: BURF',     description: 'Submit a new Budget Utilization Request Form.' },
  'procurement:burf:edit:draft':        { label: 'Edit Draft BURF',          category: 'Procurement: BURF',     description: 'Edit a BURF while it is in draft status.' },
  'procurement:burf:delete':            { label: 'Delete BURF',              category: 'Procurement: BURF',     description: 'Delete a BURF record.' },
  'procurement:burf:cancel':            { label: 'Cancel BURF',              category: 'Procurement: BURF',     description: 'Cancel an active BURF.' },
  'procurement:burf:approve:manager':   { label: 'Approve BURF (Manager)',   category: 'Procurement: BURF',     description: 'Approve a BURF as a Business Unit Manager.' },
  'procurement:burf:approve:cic':       { label: 'Approve BURF (CIC)',       category: 'Procurement: BURF',     description: 'Approve a BURF as the Corporate Inventory Controller.' },

  // ─── PROCUREMENT: PRF ─────────────────────────────────────────────────
  'procurement:prf:view:own':           { label: 'View Own PRFs',            category: 'Procurement: PRF',      description: 'View PRF records created by the user.' },
  'procurement:prf:view:all':           { label: 'View All PRFs',            category: 'Procurement: PRF',      description: 'View all PRFs across business units.' },
  'procurement:prf:create:direct':      { label: 'Create Direct PRF',        category: 'Procurement: PRF',      description: 'Create a Purchase Request Form without a BURF.' },
  'procurement:prf:create:from_burf':   { label: 'Create PRF from BURF',     category: 'Procurement: PRF',      description: 'Prepare a PRF from an approved BURF.' },
  'procurement:prf:edit':               { label: 'Edit PRF',                 category: 'Procurement: PRF',      description: 'Edit an existing PRF.' },
  'procurement:prf:delete':             { label: 'Delete PRF',               category: 'Procurement: PRF',      description: 'Delete a PRF record.' },
  'procurement:prf:approve:manager':    { label: 'Approve PRF (Manager)',     category: 'Procurement: PRF',      description: 'Approve a PRF as a Business Unit Manager.' },

  // ─── PROCUREMENT: PRF TRACKER ─────────────────────────────────────────
  'procurement:prf_tracker:view:all':   { label: 'View PRF Tracker',         category: 'Procurement',           description: 'View the PRF Kanban/tracker board.' },
  'procurement:prf_tracker:edit':       { label: 'Update PRF Tracker',       category: 'Procurement',           description: 'Update PRF status in the tracker.' },

  // ─── PROCUREMENT: APPROVED LIST ───────────────────────────────────────
  'procurement:approved:view:all':      { label: 'View Approved List',        category: 'Procurement',           description: 'View the list of approved BURFs/PRFs.' },

  // ─── PROCUREMENT: APPROVALS ───────────────────────────────────────────
  'procurement:approval:view:history':              { label: 'View Approval History',    category: 'Procurement',           description: 'View the full approval history log.' },
  'procurement:approval:approve:skip_signature':    { label: 'Skip Signature Approval',  category: 'Procurement',           description: 'Approve documents without a digital signature.' },

  // ─── FINANCE: OVERVIEW ────────────────────────────────────────────────
  'finance:overview:view:all':          { label: 'View Finance Overview',     category: 'Finance',               description: 'View the Finance dashboard overview.' },

  // ─── FINANCE: INCOME ──────────────────────────────────────────────────
  'finance:income:view:all':            { label: 'View Income',               category: 'Finance: Income',       description: 'View income and sales records.' },
  'finance:income:create':              { label: 'Create Income Entry',       category: 'Finance: Income',       description: 'Add a new income entry.' },
  'finance:income:edit':                { label: 'Edit Income Entry',         category: 'Finance: Income',       description: 'Edit existing income entries.' },
  'finance:income:delete':              { label: 'Delete Income Entry',       category: 'Finance: Income',       description: 'Delete income records.' },

  // ─── FINANCE: TRANSACTIONS ────────────────────────────────────────────
  'finance:transaction:view:all':       { label: 'View Transactions',         category: 'Finance: Transactions', description: 'View all financial transactions.' },
  'finance:transaction:export':         { label: 'Export Transactions',       category: 'Finance: Transactions', description: 'Export transaction data.' },

  // ─── FINANCE: LIQUIDATION ─────────────────────────────────────────────
  'finance:liquidation:view:all':       { label: 'View All Liquidations',     category: 'Finance: Liquidation',  description: 'View all liquidation records.' },
  'finance:liquidation:create:own':     { label: 'Create Own Liquidation',    category: 'Finance: Liquidation',  description: 'File a liquidation for own expenses.' },
  'finance:liquidation:create:all':     { label: 'Create Any Liquidation',    category: 'Finance: Liquidation',  description: 'File a liquidation on behalf of others.' },
  'finance:liquidation:edit':           { label: 'Edit Liquidation',          category: 'Finance: Liquidation',  description: 'Edit a liquidation record.' },
  'finance:liquidation:delete':         { label: 'Delete Liquidation',        category: 'Finance: Liquidation',  description: 'Delete a liquidation record.' },
  'finance:liquidation:audit':          { label: 'Audit Liquidation',         category: 'Finance: Liquidation',  description: 'Perform audit review of liquidations.' },

  // ─── FINANCE: PCF ─────────────────────────────────────────────────────
  'finance:pcf:view:all':               { label: 'View All PCF',              category: 'Finance: PCF',          description: 'View all petty cash fund records.' },
  'finance:pcf:view:history':           { label: 'View PCF History',          category: 'Finance: PCF',          description: 'View historical PCF records.' },
  'finance:pcf:create':                 { label: 'Create PCF',                category: 'Finance: PCF',          description: 'Create a new petty cash request.' },
  'finance:pcf:edit':                   { label: 'Edit PCF',                  category: 'Finance: PCF',          description: 'Edit a petty cash record.' },
  'finance:pcf:delete':                 { label: 'Delete PCF',                category: 'Finance: PCF',          description: 'Delete a petty cash record.' },
  'finance:pcf:approve':                { label: 'Approve PCF',               category: 'Finance: PCF',          description: 'Approve a petty cash request.' },
  'finance:pcf:cancel':                 { label: 'Cancel PCF',                category: 'Finance: PCF',          description: 'Cancel a petty cash liquidation.' },
  'finance:pcf:audit':                  { label: 'Audit PCF',                 category: 'Finance: PCF',          description: 'Perform audit review of PCF records.' },

  // ─── FINANCE: CHEQUE / FUND RELEASE ──────────────────────────────────
  'finance:cheque:view:all':            { label: 'View Fund Releases',        category: 'Finance: Fund Release', description: 'View cheque and fund release records.' },
  'finance:cheque:release':             { label: 'Release Funds',             category: 'Finance: Fund Release', description: 'Release approved funds via cheque.' },
  'finance:cheque:upload':              { label: 'Upload Cheque Reference',   category: 'Finance: Fund Release', description: 'Upload bank reference number for check preparation.' },
  'finance:cheque:authorize':           { label: 'Authorize Cheque',          category: 'Finance: Fund Release', description: 'Authorize checks for fund release.' },
  'finance:cheque:delete':              { label: 'Delete Fund Release',       category: 'Finance: Fund Release', description: 'Delete a fund release record.' },

  // ─── FINANCE: BUDGET REQUEST ──────────────────────────────────────────
  'finance:budget_request:view:all':               { label: 'View Budget Requests',        category: 'Finance: Budget',       description: 'View all budget request records.' },
  'finance:budget_request:create':                 { label: 'Create Budget Request',       category: 'Finance: Budget',       description: 'Submit a new budget request.' },
  'finance:budget_request:edit':                   { label: 'Edit Budget Request',         category: 'Finance: Budget',       description: 'Edit a budget request.' },
  'finance:budget_request:delete':                 { label: 'Delete Budget Request',       category: 'Finance: Budget',       description: 'Delete a budget request.' },
  'finance:budget_request:approve:finance_head':   { label: 'Approve BR (Finance Head)',   category: 'Finance: Budget',       description: 'Approve budget request as Finance Head.' },
  'finance:budget_request:approve:gm':             { label: 'Approve BR (GM)',             category: 'Finance: Budget',       description: 'Approve budget request as General Manager.' },
  'finance:budget_request:approve:bod':            { label: 'Approve BR (BOD)',            category: 'Finance: Budget',       description: 'Approve budget request as Board of Directors.' },
  'finance:budget_request:approve:cfo':            { label: 'Approve BR (CFO)',            category: 'Finance: Budget',       description: 'Approve budget request as CFO.' },

  // ─── FINANCE: BANK RECONCILIATION ─────────────────────────────────────
  'finance:bank_recon:view:all':        { label: 'View Bank Recon',           category: 'Finance: Bank Recon',   description: 'View all bank reconciliation records.' },
  'finance:bank_recon:edit:remarks':    { label: 'Edit Bank Recon Remarks',   category: 'Finance: Bank Recon',   description: 'Edit remarks on bank statement transactions.' },
  'finance:bank_recon:delete':          { label: 'Delete Bank Statement',     category: 'Finance: Bank Recon',   description: 'Delete uploaded bank statement records.' },
  'finance:bank_recon:upload':          { label: 'Upload Bank Statement',     category: 'Finance: Bank Recon',   description: 'Upload bank statement files.' },
  'finance:bank_recon:audit':           { label: 'Audit Bank Recon',          category: 'Finance: Bank Recon',   description: 'Approve or reject bank statement transactions.' },

  // ─── AUDIT MODULE ─────────────────────────────────────────────────────
  'audit:income:view:own':              { label: 'View Own Income Audit',       category: 'Audit', description: 'View own income audit records.' },
  'audit:income:view:bu':               { label: 'View BU Income Audit',        category: 'Audit', description: 'View BU income audit records.' },
  'audit:income:view:all':              { label: 'View All Income Audit',       category: 'Audit', description: 'View all income audit records.' },
  'audit:income:approve':               { label: 'Approve Income Audit',        category: 'Audit', description: 'Approve income audit records.' },
  'audit:income:reject':                { label: 'Reject Income Audit',         category: 'Audit', description: 'Reject income audit records.' },

  'audit:pcf:view:own':                 { label: 'View Own PCF Audit',          category: 'Audit', description: 'View own PCF audit requests.' },
  'audit:pcf:view:bu':                  { label: 'View BU PCF Audit',           category: 'Audit', description: 'View BU PCF audit requests.' },
  'audit:pcf:view:all':                 { label: 'View All PCF Audit',          category: 'Audit', description: 'View all PCF audit requests.' },
  'audit:pcf:approve':                  { label: 'Approve PCF',                 category: 'Audit', description: 'Approve PCF requests.' },
  'audit:pcf:reject':                   { label: 'Reject PCF',                  category: 'Audit', description: 'Reject PCF requests.' },

  'audit:liquidation:view:own':         { label: 'View Own Liquidation Audit',  category: 'Audit', description: 'View own liquidation audit requests.' },
  'audit:liquidation:view:bu':          { label: 'View BU Liquidation Audit',   category: 'Audit', description: 'View BU liquidation audit requests.' },
  'audit:liquidation:view:all':         { label: 'View All Liquidation Audit',  category: 'Audit', description: 'View all liquidation audit requests.' },
  'audit:liquidation:approve':          { label: 'Approve Liquidation',         category: 'Audit', description: 'Approve liquidation requests.' },
  'audit:liquidation:reject':           { label: 'Reject Liquidation',          category: 'Audit', description: 'Reject liquidation requests.' },
  // ─── ADMIN: USERS ─────────────────────────────────────────────────────
  'admin:user:view:all':                { label: 'View All Users',            category: 'System Admin',          description: 'View all user accounts.' },
  'admin:user:view:pending':            { label: 'View Pending Users',        category: 'System Admin',          description: 'View pending user registration approvals.' },
  'admin:user:create':                  { label: 'Create User',               category: 'System Admin',          description: 'Create new user accounts.' },
  'admin:user:edit':                    { label: 'Edit User',                 category: 'System Admin',          description: 'Edit user accounts and assign roles.' },
  'admin:user:delete':                  { label: 'Delete User',               category: 'System Admin',          description: 'Delete user accounts.' },
  'admin:user:reset_password':          { label: 'Reset Password',            category: 'System Admin',          description: 'Force a password reset for a user.' },
  'admin:user:impersonate':             { label: 'Impersonate User',          category: 'System Admin',          description: 'Log in as another user for troubleshooting.' },
  'admin:user:deactivate':              { label: 'Deactivate User',           category: 'System Admin',          description: 'Temporarily disable a user account.' },

  // ─── ADMIN: BUSINESS UNITS ────────────────────────────────────────────
  'admin:business:view:all':            { label: 'View Business Units',       category: 'System Admin',          description: 'View all business unit records.' },
  'admin:business:create':              { label: 'Create Business Unit',      category: 'System Admin',          description: 'Create new business unit entities.' },
  'admin:business:edit':                { label: 'Edit Business Unit',        category: 'System Admin',          description: 'Edit business unit details.' },
  'admin:business:delete':              { label: 'Delete Business Unit',      category: 'System Admin',          description: 'Delete business unit entities.' },

  // ─── ADMIN: PERMISSIONS ───────────────────────────────────────────────
  'admin:permission:view':              { label: 'View Permissions',          category: 'System Admin',          description: 'View the Permission Matrix.' },
  'admin:permission:edit':              { label: 'Manage Permissions',        category: 'System Admin',          description: 'Edit the Permission Matrix for all roles.' },

  // ─── ADMIN: CHART OF ACCOUNTS ─────────────────────────────────────────
  'admin:coa:view:all':                 { label: 'View Chart of Accounts',    category: 'System Admin',          description: 'View Chart of Accounts.' },
  'admin:coa:create':                   { label: 'Create COA Entry',          category: 'System Admin',          description: 'Create new Chart of Account entries.' },
  'admin:coa:edit':                     { label: 'Edit COA Entry',            category: 'System Admin',          description: 'Edit Chart of Account entries.' },
  'admin:coa:delete':                   { label: 'Delete COA Entry',          category: 'System Admin',          description: 'Delete Chart of Account entries.' },

  // ─── ADMIN: SETTINGS ──────────────────────────────────────────────────
  'admin:settings:view':                { label: 'View System Settings',      category: 'System Admin',          description: 'View system configuration settings.' },
  'admin:settings:edit':                { label: 'Edit System Settings',      category: 'System Admin',          description: 'Edit PCF settings, approver config, tax settings, etc.' },

  // ─── ADMIN: ACTIVITY LOG ──────────────────────────────────────────────
  'admin:activity_log:view:all':        { label: 'View Activity Log',         category: 'System Admin',          description: 'View the full system activity log.' },

  // ─── INVENTORY: ITEMS ─────────────────────────────────────────────────
  'inventory:item:view:all':            { label: 'View Items',                category: 'Inventory',             description: 'View inventory items and stock levels.' },
  'inventory:item:create':              { label: 'Create Item',               category: 'Inventory',             description: 'Add new inventory items.' },
  'inventory:item:edit':                { label: 'Edit Item',                 category: 'Inventory',             description: 'Edit existing inventory items.' },
  'inventory:item:delete':              { label: 'Delete Item',               category: 'Inventory',             description: 'Delete inventory items.' },
  'inventory:item:view:bu':             { label: 'View BU Items',             category: 'Inventory',             description: 'View items scoped to assigned Business Units.' },

  // ─── INVENTORY: STOCK TAKE ────────────────────────────────────────────
  'inventory:stock_take:view:all':      { label: 'View Stock Takes',          category: 'Inventory',             description: 'View stock take records.' },
  'inventory:stock_take:create':        { label: 'Create Stock Take',         category: 'Inventory',             description: 'Record a new stock take.' },
  'inventory:stock_take:edit':          { label: 'Edit Stock Take',           category: 'Inventory',             description: 'Edit stock take entries.' },
  'inventory:stock_take:delete':        { label: 'Delete Stock Take',         category: 'Inventory',             description: 'Delete stock take records.' },
  'inventory:stock_take:view:bu':       { label: 'View BU Stock Take',        category: 'Inventory',             description: 'View stock takes for assigned BUs.' },
  'inventory:stock_take:approve_adjustment': { label: 'Approve Adjustments',  category: 'Inventory',             description: 'Approve variance adjustments after stock take.' },
  'inventory:stock_take:freeze':        { label: 'Freeze Stock',              category: 'Inventory',             description: 'Lock inventory movements during stock take.' },

  // ─── INVENTORY: GOODS RECEIVING ───────────────────────────────────────
  'inventory:receiving:view:all':       { label: 'View Goods Receiving',      category: 'Inventory',             description: 'View goods receiving records.' },
  'inventory:receiving:create':         { label: 'Create Receiving Entry',    category: 'Inventory',             description: 'Record new goods received.' },
  'inventory:receiving:edit':           { label: 'Edit Receiving Entry',      category: 'Inventory',             description: 'Edit goods receiving records.' },
  'inventory:receiving:delete':         { label: 'Delete Receiving Entry',    category: 'Inventory',             description: 'Delete goods receiving records.' },
  'inventory:receiving:view:bu':        { label: 'View BU Receiving',         category: 'Inventory',             description: 'View receiving logs for assigned BUs.' },
  'inventory:receiving:reject':         { label: 'Reject Delivery',           category: 'Inventory',             description: 'Reject incoming deliveries or specific items.' },
  'inventory:receiving:print_barcode':  { label: 'Print Barcodes',            category: 'Inventory',             description: 'Print barcode labels for received items.' },

  // ─── INVENTORY: WASTAGE ───────────────────────────────────────────────
  'inventory:wastage:view:all':         { label: 'View Wastage',              category: 'Inventory',             description: 'View wastage records.' },
  'inventory:wastage:create':           { label: 'Create Wastage Entry',      category: 'Inventory',             description: 'Record new wastage.' },
  'inventory:wastage:edit':             { label: 'Edit Wastage Entry',        category: 'Inventory',             description: 'Edit wastage records.' },
  'inventory:wastage:delete':           { label: 'Delete Wastage Entry',      category: 'Inventory',             description: 'Delete wastage records.' },
  'inventory:wastage:view:bu':          { label: 'View BU Wastage',           category: 'Inventory',             description: 'View wastage logs for assigned BUs.' },

  // ─── INVENTORY: VARIANCE ──────────────────────────────────────────────
  'inventory:variance:view:all':        { label: 'View Variance Reports',     category: 'Inventory',             description: 'View inventory variance reports.' },
  'inventory:variance:create':          { label: 'Create Variance Report',    category: 'Inventory',             description: 'Create new variance reports.' },
  'inventory:variance:edit':            { label: 'Edit Variance Report',      category: 'Inventory',             description: 'Edit variance reports.' },
  'inventory:variance:delete':          { label: 'Delete Variance Report',    category: 'Inventory',             description: 'Delete variance reports.' },

  // ─── INVENTORY: ASSETS ────────────────────────────────────────────────
  'inventory:asset:view:all':           { label: 'View Fixed Assets',         category: 'Inventory',             description: 'View fixed asset records.' },
  'inventory:asset:create':             { label: 'Create Asset',              category: 'Inventory',             description: 'Add new fixed assets.' },
  'inventory:asset:edit':               { label: 'Edit Asset',                category: 'Inventory',             description: 'Edit fixed asset records.' },
  'inventory:asset:delete':             { label: 'Delete Asset',              category: 'Inventory',             description: 'Delete fixed asset records.' },

  // ─── INVENTORY: REPORTS ───────────────────────────────────────────────
  'inventory:report:view:all':          { label: 'View Inventory Reports',    category: 'Inventory',             description: 'View inventory summary reports.' },
  'inventory:report:export':            { label: 'Export Inventory Reports',  category: 'Inventory',             description: 'Export inventory data to Excel/PDF.' },

  // ─── INVENTORY: UOM ───────────────────────────────────────────────────
  'inventory:uom:view:all':             { label: 'View Units of Measure',     category: 'Inventory',             description: 'View UOM records.' },
  'inventory:uom:create':               { label: 'Create UOM',                category: 'Inventory',             description: 'Add new units of measure.' },
  'inventory:uom:edit':                 { label: 'Edit UOM',                  category: 'Inventory',             description: 'Edit units of measure.' },
  'inventory:uom:delete':               { label: 'Delete UOM',                category: 'Inventory',             description: 'Delete units of measure.' },

  // ─── MASTER DATA: SUPPLIERS ───────────────────────────────────────────
  'master_data:supplier:view:all':      { label: 'View Suppliers',            category: 'Master Data',           description: 'View supplier records.' },
  'master_data:supplier:create':        { label: 'Create Supplier',           category: 'Master Data',           description: 'Add new suppliers.' },
  'master_data:supplier:edit':          { label: 'Edit Supplier',             category: 'Master Data',           description: 'Edit supplier records.' },
  'master_data:supplier:delete':        { label: 'Delete Supplier',           category: 'Master Data',           description: 'Delete supplier records.' },

  // ─── MASTER DATA: BUDGET LIMITS ───────────────────────────────────────
  'master_data:budget:view:all':        { label: 'View Budget Limits',        category: 'Master Data',           description: 'View budget limit configurations.' },
  'master_data:budget:create':          { label: 'Create Budget Limit',       category: 'Master Data',           description: 'Set new budget limits.' },
  'master_data:budget:edit':            { label: 'Edit Budget Limit',         category: 'Master Data',           description: 'Modify existing budget limits.' },
  'master_data:budget:delete':          { label: 'Delete Budget Limit',       category: 'Master Data',           description: 'Delete budget limit entries.' },

  // ─── MENU & KITCHEN: RECIPES ──────────────────────────────────────────
  'menu:recipe:view:all':               { label: 'View Recipes',              category: 'Menu & Kitchen',        description: 'View production recipe records.' },
  'menu:recipe:create':                 { label: 'Create Recipe',             category: 'Menu & Kitchen',        description: 'Add new production recipes.' },
  'menu:recipe:edit':                   { label: 'Edit Recipe',               category: 'Menu & Kitchen',        description: 'Edit production recipes.' },
  'menu:recipe:delete':                 { label: 'Delete Recipe',             category: 'Menu & Kitchen',        description: 'Delete production recipes.' },

  // ─── MENU & KITCHEN: PRODUCTION LOGS ─────────────────────────────────
  'menu:production_log:view:all':       { label: 'View Production Logs',      category: 'Menu & Kitchen',        description: 'View kitchen production log records.' },
  'menu:production_log:create':         { label: 'Create Production Log',     category: 'Menu & Kitchen',        description: 'Log a new production batch.' },
  'menu:production_log:edit':           { label: 'Edit Production Log',       category: 'Menu & Kitchen',        description: 'Edit production log entries.' },
  'menu:production_log:delete':         { label: 'Delete Production Log',     category: 'Menu & Kitchen',        description: 'Delete production log records.' },

  // ─── MENU & KITCHEN: FINISHED GOODS ──────────────────────────────────
  'menu:finished_goods:view:all':       { label: 'View Finished Goods',       category: 'Menu & Kitchen',        description: 'View finished goods inventory.' },
  'menu:finished_goods:create':         { label: 'Create Finished Good',      category: 'Menu & Kitchen',        description: 'Add new finished goods entries.' },
  'menu:finished_goods:edit':           { label: 'Edit Finished Good',        category: 'Menu & Kitchen',        description: 'Edit finished goods records.' },
  'menu:finished_goods:delete':         { label: 'Delete Finished Good',      category: 'Menu & Kitchen',        description: 'Delete finished goods records.' },

  // ─── POINT OF SALE: SALES ─────────────────────────────────────────────
  'pos:sales:view:all':                 { label: 'View POS Sales',            category: 'Point of Sale',         description: 'View POS sales data.' },
  'pos:sales:create':                   { label: 'Create POS Sale',           category: 'Point of Sale',         description: 'Record a new POS transaction.' },
  'pos:sales:edit':                     { label: 'Edit POS Sale',             category: 'Point of Sale',         description: 'Edit POS sales records.' },
  'pos:sales:delete':                   { label: 'Delete POS Sale',           category: 'Point of Sale',         description: 'Delete POS sales records.' },

  // ─── POINT OF SALE: IMPORT ────────────────────────────────────────────
  'pos:import:view:all':                { label: 'View POS Imports',          category: 'Point of Sale',         description: 'View imported POS data dashboards.' },
  'pos:import:create':                  { label: 'Import POS Data',           category: 'Point of Sale',         description: 'Import POS/event data from external sources.' },
  'pos:import:delete':                  { label: 'Delete POS Import',         category: 'Point of Sale',         description: 'Delete imported POS data records.' },

  // ─── UI: MODULE ACCESS ────────────────────────────────────────────────
  'ui:module_access:view:burf':         { label: 'BURF Module',               category: 'Module Access' },
  'ui:module_access:view:prf':          { label: 'PRF Module',                category: 'Module Access' },
  'ui:module_access:view:prf_tracker':  { label: 'PRF Tracker',               category: 'Module Access' },
  'ui:module_access:view:approvals':    { label: 'Approvals',                 category: 'Module Access' },
  'ui:module_access:view:approved':     { label: 'Approved List',             category: 'Module Access' },
  'ui:module_access:view:finance':      { label: 'Finance Module',            category: 'Module Access' },
  'ui:module_access:view:pcf':          { label: 'PCF Module',                category: 'Module Access' },
  'ui:module_access:view:suppliers':    { label: 'Suppliers Module',          category: 'Module Access' },
  'ui:module_access:view:coa':          { label: 'COA Module',                category: 'Module Access' },
  'ui:module_access:view:settings':     { label: 'Settings Module',           category: 'Module Access' },
  'ui:module_access:view:bank_recon':   { label: 'Bank Recon Module',         category: 'Module Access' },
  'ui:module_access:view:liquidation':  { label: 'Liquidation Module',        category: 'Module Access' },
  'ui:module_access:view:inventory':    { label: 'Inventory Module',          category: 'Module Access' },
  'ui:module_access:view:pos':          { label: 'POS Module',                category: 'Module Access' },
  'ui:module_access:view:menu':         { label: 'Menu & Kitchen Module',     category: 'Module Access' },
  'ui:module_access:view:audit':        { label: 'Audit Module',              category: 'Module Access' },
  'ui:module_access:view:activity_log': { label: 'Activity Log Module',       category: 'Module Access' },
  'ui:module_access:view:budget_request': { label: 'Budget Request Module',   category: 'Module Access' },

  // ─── UI: DASHBOARD WIDGETS ────────────────────────────────────────────
  'ui:widget:view:ready_for_prf':       { label: 'Ready for PRF Widget',      category: 'Dashboard' },
  'ui:widget:view:total_spend':         { label: 'Total Spend Widget',        category: 'Dashboard' },
  'ui:widget:view:overdue_items':       { label: 'Overdue Items Widget',      category: 'Dashboard' },
  'ui:widget:view:avg_processing':      { label: 'Avg Processing Widget',     category: 'Dashboard' },
  'ui:widget:view:completed_month':     { label: 'Completed This Month',      category: 'Dashboard' },
  'ui:widget:view:top_requesters':      { label: 'Top Requesters Widget',     category: 'Dashboard' },
  'ui:section:view:finance_head_br':      { label: 'Finance Head BR Section',     category: 'Dashboard' },
  'ui:section:view:gm_br':                { label: 'GM Budget Review Section',    category: 'Dashboard' },
  'ui:section:view:bod_br':               { label: 'BOD Budget Review Section',   category: 'Dashboard' },
  'ui:section:view:check_auth':           { label: 'Check Auth Section',          category: 'Dashboard' },
  'ui:section:view:pending_list':         { label: 'Pending List Section',         category: 'Dashboard' },
  'ui:section:view:ready_for_prf_list':   { label: 'Ready for PRF List Section',  category: 'Dashboard' },
  'ui:section:view:pending_fund_release': { label: 'Pending Fund Release Section', category: 'Dashboard' },
  'ui:section:view:pending_audit_list':   { label: 'Pending Audit List Section',   category: 'Dashboard' },
};

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION GROUPS  (drives the CRUD matrix UI)
// ═══════════════════════════════════════════════════════════════════════════

export interface CrudCell {
  permission?: Permission;
  variants?: { label: string; permission: Permission }[];
}

export interface ResourceGroup {
  id: string;
  resource: string;
  category: string;
  read?: CrudCell;
  create?: CrudCell;
  edit?: CrudCell;
  delete?: CrudCell;
  actions?: Permission[];
}

export const PERMISSION_GROUPS: ResourceGroup[] = [
  // ─── PROCUREMENT ──────────────────────────────────────────────────────
  {
    id: 'burf',
    resource: 'BURF',
    category: 'Procurement',
    read: {
      variants: [
        { label: 'Own', permission: 'procurement:burf:view:own' },
        { label: 'BU',  permission: 'procurement:burf:view:bu' },
        { label: 'All', permission: 'procurement:burf:view:all' },
      ],
    },
    create: { permission: 'procurement:burf:create' },
    edit:   { permission: 'procurement:burf:edit:draft' },
    delete: { permission: 'procurement:burf:delete' },
    actions: [
      'procurement:burf:cancel',
      'procurement:burf:approve:manager',
      'procurement:burf:approve:cic',
    ],
  },
  {
    id: 'prf',
    resource: 'PRF',
    category: 'Procurement',
    read: {
      variants: [
        { label: 'Own', permission: 'procurement:prf:view:own' },
        { label: 'All', permission: 'procurement:prf:view:all' },
      ],
    },
    create: {
      variants: [
        { label: 'Direct',    permission: 'procurement:prf:create:direct' },
        { label: 'From BURF', permission: 'procurement:prf:create:from_burf' },
      ],
    },
    edit:   { permission: 'procurement:prf:edit' },
    delete: { permission: 'procurement:prf:delete' },
    actions: ['procurement:prf:approve:manager'],
  },
  {
    id: 'prf_tracker',
    resource: 'PRF Tracker',
    category: 'Procurement',
    read:   { permission: 'procurement:prf_tracker:view:all' },
    create: { permission: 'procurement:prf_tracker:view:all' },
    edit:   { permission: 'procurement:prf_tracker:edit' },
    delete: { permission: 'procurement:prf_tracker:edit' },
  },
  {
    id: 'approved_list',
    resource: 'Approved List',
    category: 'Procurement',
    read:   { permission: 'procurement:approved:view:all' },
    create: { permission: 'procurement:approved:view:all' },
    edit:   { permission: 'procurement:approved:view:all' },
    delete: { permission: 'procurement:approved:view:all' },
  },
  {
    id: 'approvals',
    resource: 'Approval Workflow',
    category: 'Procurement',
    read:   { permission: 'procurement:approval:view:history' },
    create: { permission: 'procurement:approval:view:history' },
    edit:   { permission: 'procurement:approval:view:history' },
    delete: { permission: 'procurement:approval:view:history' },
    actions: ['procurement:approval:approve:skip_signature'],
  },

  // ─── FINANCE ──────────────────────────────────────────────────────────
  {
    id: 'finance_overview',
    resource: 'Finance Overview',
    category: 'Finance',
    read:   { permission: 'finance:overview:view:all' },
    create: { permission: 'finance:overview:view:all' },
    edit:   { permission: 'finance:overview:view:all' },
    delete: { permission: 'finance:overview:view:all' },
  },
  {
    id: 'income',
    resource: 'Income / Sales',
    category: 'Finance',
    read:   { permission: 'finance:income:view:all' },
    create: { permission: 'finance:income:create' },
    edit:   { permission: 'finance:income:edit' },
    delete: { permission: 'finance:income:delete' },
  },
  {
    id: 'transactions',
    resource: 'Transactions',
    category: 'Finance',
    read:   { permission: 'finance:transaction:view:all' },
    create: { permission: 'finance:transaction:view:all' },
    edit:   { permission: 'finance:transaction:view:all' },
    delete: { permission: 'finance:transaction:view:all' },
    actions: ['finance:transaction:export'],
  },
  {
    id: 'liquidation',
    resource: 'Liquidation',
    category: 'Finance',
    read: { permission: 'finance:liquidation:view:all' },
    create: {
      variants: [
        { label: 'Own', permission: 'finance:liquidation:create:own' },
        { label: 'All', permission: 'finance:liquidation:create:all' },
      ],
    },
    edit:   { permission: 'finance:liquidation:edit' },
    delete: { permission: 'finance:liquidation:delete' },
    actions: ['finance:liquidation:audit'],
  },
  {
    id: 'pcf',
    resource: 'Petty Cash (PCF)',
    category: 'Finance',
    read: {
      variants: [
        { label: 'All',     permission: 'finance:pcf:view:all' },
        { label: 'History', permission: 'finance:pcf:view:history' },
      ],
    },
    create: { permission: 'finance:pcf:create' },
    edit:   { permission: 'finance:pcf:edit' },
    delete: { permission: 'finance:pcf:delete' },
    actions: ['finance:pcf:approve', 'finance:pcf:cancel', 'finance:pcf:audit'],
  },
  {
    id: 'fund_release',
    resource: 'Cheque Authorization',
    category: 'Finance',
    read:   { permission: 'finance:cheque:view:all' },
    create: { permission: 'finance:cheque:view:all' },
    edit:   { permission: 'finance:cheque:view:all' },
    delete: { permission: 'finance:cheque:delete' },
    actions: ['finance:cheque:release', 'finance:cheque:upload', 'finance:cheque:authorize'],
  },
  {
    id: 'budget_request',
    resource: 'Budget Request',
    category: 'Finance',
    read:   { permission: 'finance:budget_request:view:all' },
    create: { permission: 'finance:budget_request:create' },
    edit:   { permission: 'finance:budget_request:edit' },
    delete: { permission: 'finance:budget_request:delete' },
    actions: [
      'finance:budget_request:approve:finance_head',
      'finance:budget_request:approve:gm',
      'finance:budget_request:approve:bod',
      'finance:budget_request:approve:cfo',
    ],
  },
  {
    id: 'bank_recon',
    resource: 'Bank Reconciliation',
    category: 'Finance',
    read:   { permission: 'finance:bank_recon:view:all' },
    create: { permission: 'finance:bank_recon:view:all' },
    edit:   { permission: 'finance:bank_recon:edit:remarks' },
    delete: { permission: 'finance:bank_recon:delete' },
    actions: ['finance:bank_recon:upload', 'finance:bank_recon:audit'],
  },

  // ─── AUDIT ────────────────────────────────────────────────────────────
  {
    id: 'audit_income',
    resource: 'Income Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:income:view:all' },
        { label: 'BU', permission: 'audit:income:view:bu' },
        { label: 'Own', permission: 'audit:income:view:own' },
      ],
    },
    actions: ['audit:income:approve', 'audit:income:reject'],
  },
  {
    id: 'audit_pcf',
    resource: 'PCF Audit Review',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:pcf:view:all' },
        { label: 'BU', permission: 'audit:pcf:view:bu' },
        { label: 'Own', permission: 'audit:pcf:view:own' },
      ],
    },
    actions: ['audit:pcf:approve', 'audit:pcf:reject'],
  },
  {
    id: 'audit_liquidation',
    resource: 'Liquidation Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:liquidation:view:all' },
        { label: 'BU', permission: 'audit:liquidation:view:bu' },
        { label: 'Own', permission: 'audit:liquidation:view:own' },
      ],
    },
    actions: ['audit:liquidation:approve', 'audit:liquidation:reject'],
  },
  // ─── ADMIN ────────────────────────────────────────────────────────────
  {
    id: 'admin_users',
    resource: 'Users',
    category: 'Admin',
    read: {
      variants: [
        { label: 'All', permission: 'admin:user:view:all' },
        { label: 'Pending', permission: 'admin:user:view:pending' },
      ],
    },
    create: { permission: 'admin:user:create' },
    edit:   { permission: 'admin:user:edit' },
    delete: { permission: 'admin:user:delete' },
    actions: ['admin:user:reset_password', 'admin:user:impersonate', 'admin:user:deactivate'],
  },
  {
    id: 'admin_businesses',
    resource: 'Business Units',
    category: 'Admin',
    read:   { permission: 'admin:business:view:all' },
    create: { permission: 'admin:business:create' },
    edit:   { permission: 'admin:business:edit' },
    delete: { permission: 'admin:business:delete' },
  },
  {
    id: 'admin_permissions',
    resource: 'Permissions',
    category: 'Admin',
    read:   { permission: 'admin:permission:view' },
    create: { permission: 'admin:permission:view' },
    edit:   { permission: 'admin:permission:edit' },
    delete: { permission: 'admin:permission:edit' },
  },
  {
    id: 'admin_coa',
    resource: 'Chart of Accounts',
    category: 'Admin',
    read:   { permission: 'admin:coa:view:all' },
    create: { permission: 'admin:coa:create' },
    edit:   { permission: 'admin:coa:edit' },
    delete: { permission: 'admin:coa:delete' },
  },
  {
    id: 'admin_settings',
    resource: 'System Settings',
    category: 'Admin',
    read:   { permission: 'admin:settings:view' },
    create: { permission: 'admin:settings:view' },
    edit:   { permission: 'admin:settings:edit' },
    delete: { permission: 'admin:settings:edit' },
  },
  {
    id: 'admin_activity_log',
    resource: 'Activity Log',
    category: 'Admin',
    read:   { permission: 'admin:activity_log:view:all' },
    create: { permission: 'admin:activity_log:view:all' },
    edit:   { permission: 'admin:activity_log:view:all' },
    delete: { permission: 'admin:activity_log:view:all' },
  },

  // ─── INVENTORY ────────────────────────────────────────────────────────
  {
    id: 'inventory_items',
    resource: 'Inventory Items',
    category: 'Inventory',
    read: {
      variants: [
        { label: 'All', permission: 'inventory:item:view:all' },
        { label: 'BU', permission: 'inventory:item:view:bu' }
      ]
    },
    create: { permission: 'inventory:item:create' },
    edit:   { permission: 'inventory:item:edit' },
    delete: { permission: 'inventory:item:delete' },
  },
  {
    id: 'inventory_stock_take',
    resource: 'Stock Take',
    category: 'Inventory',
    read: {
      variants: [
        { label: 'All', permission: 'inventory:stock_take:view:all' },
        { label: 'BU', permission: 'inventory:stock_take:view:bu' }
      ]
    },
    create: { permission: 'inventory:stock_take:create' },
    edit:   { permission: 'inventory:stock_take:edit' },
    delete: { permission: 'inventory:stock_take:delete' },
    actions: ['inventory:stock_take:approve_adjustment', 'inventory:stock_take:freeze'],
  },
  {
    id: 'inventory_receiving',
    resource: 'Goods Receiving',
    category: 'Inventory',
    read: {
      variants: [
        { label: 'All', permission: 'inventory:receiving:view:all' },
        { label: 'BU', permission: 'inventory:receiving:view:bu' }
      ]
    },
    create: { permission: 'inventory:receiving:create' },
    edit:   { permission: 'inventory:receiving:edit' },
    delete: { permission: 'inventory:receiving:delete' },
    actions: ['inventory:receiving:reject', 'inventory:receiving:print_barcode'],
  },
  {
    id: 'inventory_wastage',
    resource: 'Wastage',
    category: 'Inventory',
    read: {
      variants: [
        { label: 'All', permission: 'inventory:wastage:view:all' },
        { label: 'BU', permission: 'inventory:wastage:view:bu' }
      ]
    },
    create: { permission: 'inventory:wastage:create' },
    edit:   { permission: 'inventory:wastage:edit' },
    delete: { permission: 'inventory:wastage:delete' },
  },
  {
    id: 'inventory_variance',
    resource: 'Variance Reports',
    category: 'Inventory',
    read:   { permission: 'inventory:variance:view:all' },
    create: { permission: 'inventory:variance:create' },
    edit:   { permission: 'inventory:variance:edit' },
    delete: { permission: 'inventory:variance:delete' },
  },
  {
    id: 'inventory_assets',
    resource: 'Fixed Assets',
    category: 'Inventory',
    read:   { permission: 'inventory:asset:view:all' },
    create: { permission: 'inventory:asset:create' },
    edit:   { permission: 'inventory:asset:edit' },
    delete: { permission: 'inventory:asset:delete' },
  },
  {
    id: 'inventory_reports',
    resource: 'Inventory Reports',
    category: 'Inventory',
    read:   { permission: 'inventory:report:view:all' },
    create: { permission: 'inventory:report:view:all' },
    edit:   { permission: 'inventory:report:view:all' },
    delete: { permission: 'inventory:report:view:all' },
    actions: ['inventory:report:export'],
  },
  {
    id: 'inventory_uom',
    resource: 'Units of Measure',
    category: 'Inventory',
    read:   { permission: 'inventory:uom:view:all' },
    create: { permission: 'inventory:uom:create' },
    edit:   { permission: 'inventory:uom:edit' },
    delete: { permission: 'inventory:uom:delete' },
  },

  // ─── MASTER DATA ──────────────────────────────────────────────────────
  {
    id: 'suppliers',
    resource: 'Suppliers',
    category: 'Master Data',
    read:   { permission: 'master_data:supplier:view:all' },
    create: { permission: 'master_data:supplier:create' },
    edit:   { permission: 'master_data:supplier:edit' },
    delete: { permission: 'master_data:supplier:delete' },
  },
  {
    id: 'budget_limits',
    resource: 'Budget Limits',
    category: 'Master Data',
    read:   { permission: 'master_data:budget:view:all' },
    create: { permission: 'master_data:budget:create' },
    edit:   { permission: 'master_data:budget:edit' },
    delete: { permission: 'master_data:budget:delete' },
  },

  // ─── MENU & KITCHEN ───────────────────────────────────────────────────
  {
    id: 'menu_recipes',
    resource: 'Production Recipes',
    category: 'Menu & Kitchen',
    read:   { permission: 'menu:recipe:view:all' },
    create: { permission: 'menu:recipe:create' },
    edit:   { permission: 'menu:recipe:edit' },
    delete: { permission: 'menu:recipe:delete' },
  },
  {
    id: 'menu_production_logs',
    resource: 'Production Logs',
    category: 'Menu & Kitchen',
    read:   { permission: 'menu:production_log:view:all' },
    create: { permission: 'menu:production_log:create' },
    edit:   { permission: 'menu:production_log:edit' },
    delete: { permission: 'menu:production_log:delete' },
  },
  {
    id: 'menu_finished_goods',
    resource: 'Finished Goods',
    category: 'Menu & Kitchen',
    read:   { permission: 'menu:finished_goods:view:all' },
    create: { permission: 'menu:finished_goods:create' },
    edit:   { permission: 'menu:finished_goods:edit' },
    delete: { permission: 'menu:finished_goods:delete' },
  },

  // ─── POINT OF SALE ────────────────────────────────────────────────────
  {
    id: 'pos_sales',
    resource: 'POS Sales',
    category: 'Point of Sale',
    read:   { permission: 'pos:sales:view:all' },
    create: { permission: 'pos:sales:create' },
    edit:   { permission: 'pos:sales:edit' },
    delete: { permission: 'pos:sales:delete' },
  },
  {
    id: 'pos_import',
    resource: 'POS Import',
    category: 'Point of Sale',
    read:   { permission: 'pos:import:view:all' },
    create: { permission: 'pos:import:create' },
    edit:   { permission: 'pos:import:view:all' },
    delete: { permission: 'pos:import:delete' },
  },

  // ─── DASHBOARD & UI ───────────────────────────────────────────────────
  {
    id: 'dashboard_check_auth',
    resource: 'Check Authorization',
    category: 'Dashboard',
    read: { permission: 'ui:section:view:check_auth' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ROLE-TO-PERMISSION MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export const ROLES_TO_PERMISSIONS: Record<string, Permission[]> = {
  // ─── ALL-POWERFUL ─────────────────────────────────────────────────────
  [UserRole.SUPER_ADMIN]: [...ALL_PERMISSIONS],

  // ─── SYSTEM ADMIN ─────────────────────────────────────────────────────
  [UserRole.ADMIN]: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:burf:cancel',
    'procurement:approval:view:history',
    // Finance
    'finance:liquidation:create:own',
    'finance:liquidation:create:all',
    'finance:liquidation:view:all',
    'finance:pcf:view:all',
    'finance:pcf:approve',
    // Bank Recon
    'finance:bank_recon:view:all',
    'finance:bank_recon:edit:remarks',
    'finance:bank_recon:audit',
    'finance:bank_recon:upload',
    'finance:bank_recon:delete',
    // Admin
    'admin:user:view:all',
    'admin:user:view:pending',
    'admin:user:create',
    'admin:user:edit',
    'admin:user:delete',
    'admin:user:reset_password',
    'admin:user:deactivate',
    'admin:business:view:all',
    'admin:business:create',
    'admin:business:edit',
    'admin:business:delete',
    'admin:permission:view',
    'admin:permission:edit',
    'admin:coa:view:all',
    'admin:coa:create',
    'admin:coa:edit',
    'admin:coa:delete',
    'admin:settings:view',
    'admin:settings:edit',
    'admin:activity_log:view:all',
    // Inventory
    'inventory:item:view:all',
    'inventory:item:create',
    'inventory:item:edit',
    'inventory:item:delete',
    'inventory:asset:view:all',
    'inventory:asset:edit',
    'inventory:uom:view:all',
    'inventory:uom:edit',
    'inventory:report:view:all',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:approvals',
    'ui:module_access:view:approved',
    'ui:module_access:view:finance',
    'ui:module_access:view:pcf',
    'ui:module_access:view:suppliers',
    'ui:module_access:view:coa',
    'ui:module_access:view:settings',
    'ui:module_access:view:bank_recon',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:inventory',
    'ui:module_access:view:pos',
    'ui:module_access:view:activity_log',
    // Dashboard
    'ui:widget:view:ready_for_prf',
    'ui:widget:view:total_spend',
    'ui:widget:view:overdue_items',
    'ui:widget:view:avg_processing',
    'ui:widget:view:completed_month',
    'ui:widget:view:top_requesters',
    'ui:section:view:finance_head_br',
    'ui:section:view:gm_br',
    'ui:section:view:bod_br',
    'ui:section:view:check_auth',
  ],

  // ─── GENERAL MANAGER ──────────────────────────────────────────────────
  [UserRole.GENERAL_MANAGER]: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:burf:approve:manager',
    'procurement:burf:approve:cic',
    'procurement:prf:approve:manager',
    'procurement:approval:view:history',
    'procurement:approval:approve:skip_signature',
    // Finance
    'finance:cheque:release',
    'finance:budget_request:view:all',
    'finance:budget_request:approve:finance_head',
    'finance:budget_request:approve:gm',
    'finance:budget_request:approve:cfo',
    'finance:budget_request:approve:bod',
    'finance:liquidation:create:own',
    'finance:liquidation:view:all',
    'finance:pcf:view:all',
    'finance:pcf:approve',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:approvals',
    'ui:module_access:view:approved',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:pcf',
    'ui:module_access:view:budget_request',
    // Dashboard
    'ui:widget:view:ready_for_prf',
    'ui:widget:view:total_spend',
    'ui:widget:view:overdue_items',
    'ui:widget:view:avg_processing',
    'ui:widget:view:completed_month',
    'ui:widget:view:top_requesters',
    'ui:section:view:finance_head_br',
    'ui:section:view:gm_br',
    'ui:section:view:bod_br',
    'ui:section:view:check_auth',
  ],

  // ─── BOARD OF DIRECTOR ────────────────────────────────────────────────
  [UserRole.BOARD_OF_DIRECTOR]: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:approval:view:history',
    'procurement:approval:approve:skip_signature',
    // Finance
    'finance:budget_request:view:all',
    'finance:budget_request:approve:bod',
    'finance:liquidation:view:all',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:approved',
    'ui:module_access:view:approvals',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:budget_request',
    // Dashboard
    'ui:widget:view:total_spend',
    'ui:section:view:bod_br',
    'ui:section:view:check_auth',
  ],

  // ─── MANAGER ──────────────────────────────────────────────────────────
  [UserRole.MANAGER]: [
    // Procurement
    'procurement:burf:create',
    'procurement:burf:view:bu',
    'procurement:burf:approve:manager',
    'procurement:prf:approve:manager',
    'procurement:approval:view:history',
    // Finance
    'finance:liquidation:create:own',
    'finance:pcf:view:all',
    'finance:pcf:approve',
    // Inventory
    'inventory:item:view:all',
    'inventory:item:edit',
    'inventory:report:view:all',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:approvals',
    'ui:module_access:view:approved',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:pcf',
    'ui:module_access:view:inventory',
    // Dashboard
    'ui:widget:view:ready_for_prf',
    'ui:widget:view:overdue_items',
    'ui:widget:view:avg_processing',
    'ui:widget:view:completed_month',
    'ui:widget:view:top_requesters',
  ],

  // ─── EMPLOYEE ─────────────────────────────────────────────────────────
  [UserRole.EMPLOYEE]: [
    // Procurement
    'procurement:burf:create',
    'procurement:burf:view:own',
    // Finance
    'finance:liquidation:create:own',
    // Inventory (view only)
    'inventory:item:view:all',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:pcf',
    'ui:module_access:view:inventory',
  ],

  // ─── CIC ──────────────────────────────────────────────────────────────
  [UserRole.CIC]: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:burf:approve:cic',
    'procurement:approval:view:history',
    // Finance
    'finance:liquidation:view:all',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:approvals',
    'ui:module_access:view:approved',
    'ui:module_access:view:liquidation',
  ],

  // ─── PURCHASING OFFICER ───────────────────────────────────────────────
  [UserRole.PURCHASING_OFFICER]: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:prf:create:direct',
    'procurement:prf:create:from_burf',
    // Finance
    'finance:liquidation:create:own',
    'finance:liquidation:view:all',
    // Inventory
    'inventory:item:view:all',
    'inventory:item:edit',
    'inventory:asset:edit',
    'inventory:uom:edit',
    'inventory:report:view:all',
    // Master Data
    'master_data:supplier:view:all',
    'master_data:supplier:create',
    'master_data:supplier:edit',
    'master_data:supplier:delete',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:approved',
    'ui:module_access:view:suppliers',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:inventory',
    // Dashboard
    'ui:widget:view:ready_for_prf',
    'ui:widget:view:total_spend',
  ],

  // ─── FINANCE ──────────────────────────────────────────────────────────
  [UserRole.FINANCE]: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:approval:view:history',
    'procurement:approval:approve:skip_signature',
    // Finance
    'finance:cheque:release',
    'finance:cheque:upload',
    'finance:liquidation:create:own',
    'finance:liquidation:create:all',
    'finance:liquidation:view:all',
    'finance:budget_request:view:all',
    'finance:budget_request:approve:finance_head',
    'finance:budget_request:approve:gm',
    'finance:budget_request:approve:bod',
    // Bank Recon
    'finance:bank_recon:view:all',
    'finance:bank_recon:edit:remarks',
    'finance:bank_recon:audit',
    'finance:bank_recon:upload',
    'finance:bank_recon:delete',
    // Admin (COA view)
    'admin:coa:view:all',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:approvals',
    'ui:module_access:view:approved',
    'ui:module_access:view:finance',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:coa',
    'ui:module_access:view:bank_recon',
    'ui:module_access:view:budget_request',
    // Dashboard
    'ui:widget:view:total_spend',
    'ui:section:view:finance_head_br',
    'ui:section:view:gm_br',
    'ui:section:view:check_auth',
  ],

  // ─── AUDITOR ──────────────────────────────────────────────────────────
  [UserRole.AUDITOR]: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:approval:view:history',
    // Finance
    'finance:liquidation:view:all',
    'finance:liquidation:audit',
    'finance:pcf:audit',
    'finance:bank_recon:audit',
    // Audit Module
    'ui:module_access:view:audit',
    'audit:income:view:all',
    'audit:income:approve',
    'audit:income:reject',
    'audit:pcf:view:all',
    'audit:pcf:approve',
    'audit:pcf:reject',
    'audit:liquidation:view:all',
    'audit:liquidation:approve',
    'audit:liquidation:reject',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:approvals',
    'ui:module_access:view:approved',
    'ui:module_access:view:liquidation',
  ],

  // ─── FINANCE HEAD ─────────────────────────────────────────────────────
  FINANCE_HEAD: [
    // Procurement
    'procurement:burf:view:all',
    'procurement:approval:view:history',
    'procurement:approval:approve:skip_signature',
    // Finance
    'finance:cheque:release',
    'finance:cheque:upload',
    'finance:liquidation:create:own',
    'finance:liquidation:create:all',
    'finance:liquidation:view:all',
    'finance:budget_request:view:all',
    'finance:budget_request:approve:finance_head',
    // Bank Recon
    'finance:bank_recon:view:all',
    'finance:bank_recon:edit:remarks',
    'finance:bank_recon:audit',
    'finance:bank_recon:upload',
    'finance:bank_recon:delete',
    // Master Data
    'master_data:budget:view:all',
    'master_data:budget:edit',
    // Module Access
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:prf_tracker',
    'ui:module_access:view:approvals',
    'ui:module_access:view:approved',
    'ui:module_access:view:finance',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:bank_recon',
    'ui:module_access:view:budget_request',
    // Dashboard
    'ui:widget:view:total_spend',
    'ui:section:view:finance_head_br',
    'ui:section:view:check_auth',
  ],

  // ─── INVENTORY OFFICER ────────────────────────────────────────────────
  INVENTORY_OFFICER: [
    // Inventory
    'inventory:item:view:all',
    'inventory:item:create',
    'inventory:item:edit',
    'inventory:item:delete',
    'inventory:stock_take:view:all',
    'inventory:stock_take:create',
    'inventory:stock_take:edit',
    'inventory:stock_take:delete',
    'inventory:stock_take:approve_adjustment',
    'inventory:stock_take:freeze',
    'inventory:receiving:view:all',
    'inventory:receiving:create',
    'inventory:receiving:edit',
    'inventory:receiving:delete',
    'inventory:receiving:reject',
    'inventory:receiving:print_barcode',
    'inventory:wastage:view:all',
    'inventory:wastage:create',
    'inventory:wastage:edit',
    'inventory:wastage:delete',
    'inventory:asset:view:all',
    'inventory:asset:edit',
    'inventory:uom:view:all',
    'inventory:uom:edit',
    'inventory:report:view:all',
    // Module Access
    'ui:module_access:view:inventory',
    'ui:module_access:view:burf',
    'ui:module_access:view:prf_tracker',
  ],
};
