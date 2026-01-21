
// =============================================================================
// HYBRID ROLE SYSTEM
// =============================================================================
// SystemRole: Hardcoded critical roles for type-safe checks
// RoleType: Union type allowing system roles + dynamic business roles from Firestore
// =============================================================================

/**
 * System Roles - Hardcoded, critical roles that require type-safe checks.
 * These roles have special privileges in the application logic.
 */
export enum SystemRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // Developer/God-mode - full system access
  ADMIN = 'ADMIN',             // System Configuration - manages users and settings
}

/**
 * Default Business Roles - These exist as constants for backward compatibility
 * but are fetched dynamically from Firestore at runtime.
 * New business roles can be added via the Permission Matrix without code changes.
 */
export const DEFAULT_BUSINESS_ROLES = [
  'MANAGER',           // Business Unit Manager (BUM)
  'EMPLOYEE',          // Requestor
  'CIC',               // Corporate Inventory Controller
  'PURCHASING_OFFICER',
  'FINANCE',           // Treasury (Releases Budget)
  'FINANCE_HEAD',      // Finance Head (Budget Review)
  'AUDITOR',           // Checks Liquidation
  'GENERAL_MANAGER',
  'BOARD_OF_DIRECTOR',
] as const;

/**
 * RoleType - Union of system roles + any string (for dynamic business roles)
 * This allows type-safe checks for SystemRole while accepting dynamic roles.
 */
export type RoleType = SystemRole | string;

/**
 * @deprecated Use RoleType instead. Kept for backward compatibility.
 * UserRole is now an alias to RoleType to allow gradual migration.
 */
export type UserRole = RoleType;

// Re-export SystemRole values as UserRole for backward compatibility
export const UserRole = {
  ...SystemRole,
  // Business roles as string constants (not enum) for backward compatibility
  MANAGER: 'MANAGER' as const,
  EMPLOYEE: 'EMPLOYEE' as const,
  CIC: 'CIC' as const,
  PURCHASING_OFFICER: 'PURCHASING_OFFICER' as const,
  FINANCE: 'FINANCE' as const,
  FINANCE_HEAD: 'FINANCE_HEAD' as const,  // FIX: Added for consistency
  AUDITOR: 'AUDITOR' as const,
  GENERAL_MANAGER: 'GENERAL_MANAGER' as const,
  BOARD_OF_DIRECTOR: 'BOARD_OF_DIRECTOR' as const,
} as const;

/**
 * Type guard to check if a role is a system role (SUPER_ADMIN or ADMIN)
 */
export const isSystemRole = (role: string): role is SystemRole => {
  return Object.values(SystemRole).includes(role as SystemRole);
};

/**
 * Type guard to check if a role is SUPER_ADMIN specifically
 */
export const isSuperAdmin = (role: string): boolean => {
  return role === SystemRole.SUPER_ADMIN;
};

/**
 * Type guard to check if a role is ADMIN or SUPER_ADMIN
 */
export const isAdminOrSuperAdmin = (role: string): boolean => {
  return role === SystemRole.SUPER_ADMIN || role === SystemRole.ADMIN;
};

/**
 * Format a role string for display (e.g., 'SUPER_ADMIN' -> 'Super Admin')
 */
export const formatRoleLabel = (role: string): string => {
  return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE'
}

// Helper function to determine if user has global access to all business units
// Only SUPER_ADMIN has global access, all others use granular businessUnitIds
export const hasGlobalAccess = (role: RoleType): boolean => {
  return role === SystemRole.SUPER_ADMIN;
};

export enum RequisitionStatus {
  DRAFT = 'DRAFT', // Initial draft state

  // BURF Workflow
  BURF_PENDING_MANAGER = 'BURF_PENDING_MANAGER',
  BURF_PENDING_CIC = 'BURF_PENDING_CIC',
  READY_FOR_PRF = 'READY_FOR_PRF',
  BURF_PARTIALLY_PROCESSED = 'BURF_PARTIALLY_PROCESSED', // Some items converted to PRF, some remaining

  // PRF 8-Stage Approval Workflow
  PRF_PENDING_MANAGER = 'PRF_PENDING_MANAGER', // Step 1: BUM (Business Unit Manager) Approval
  PENDING_GM_PRF_APPROVAL = 'PENDING_GM_PRF_APPROVAL', // Step 2 (if amount >= 50k): GM checks PRF details
  PENDING_FINANCE_HEAD_BR_APPROVAL = 'PENDING_FINANCE_HEAD_BR_APPROVAL', // Step 3: Finance Head Budget Review (BU-specific)
  PENDING_GM_BR_APPROVAL = 'PENDING_GM_BR_APPROVAL', // Step 4: GM Final Budget Approval
  PENDING_BOD_APPROVAL = 'PENDING_BOD_APPROVAL', // Step 5: BOD Approval (Any BOD approver)
  FOR_CHECK_PREPARATION = 'FOR_CHECK_PREPARATION', // Step 6: Finance uploads check number + link
  PENDING_CHECK_AUTH_BOD = 'PENDING_CHECK_AUTH_BOD', // Step 7: BOD Check Authorization
  FOR_FUND_RELEASE = 'FOR_FUND_RELEASE', // Step 8: Ready for Fund Release

  // Legacy status (kept for backward compatibility with existing data)
  PENDING_CFO_APPROVAL = 'PENDING_CFO_APPROVAL', // Deprecated: Old CFO approval step

  // Legacy status (mapped to FOR_FUND_RELEASE in new workflow)
  APPROVED_FOR_PAYMENT = 'APPROVED_FOR_PAYMENT',

  // Post-Approval Statuses
  FUNDS_RELEASED = 'FUNDS_RELEASED', // Funds given to employee/supplier
  LIQUIDATION_FILED = 'LIQUIDATION_FILED', // Employee submitted receipts
  LIQUIDATION_REJECTED = 'LIQUIDATION_REJECTED', // Auditor rejected, can refile
  AUDITED_CLEARED = 'AUDITED_CLEARED', // Finance approved liquidation

  // Terminal Statuses
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED', // Cancelled by user
  BURF_COMPLETED = 'BURF_COMPLETED' // All items have been converted to PRFs
}

export interface Business {
  id: string;
  name: string;
  currency: string;
  address?: string;
  tin?: string;
}

export interface User {
  id: string;
  employeeId?: string; // Human-readable ID (e.g., "JDOE-001") - generated from name
  name: string;
  role: RoleType; // Changed from UserRole enum to RoleType for dynamic roles
  permissionLevel?: number; // 1-5, higher is more priviledge
  avatar: string;
  email: string;
  department?: string;
  businessId: string; // Primary Business Unit (Legacy support)
  businessUnitIds?: string[]; // New: List of accessible Business Units. If empty/null, falls back to businessId.
  isPasswordSet?: boolean; // Track if Google users have set a password
  isApprover?: boolean; // New field to designate if user is an eligible approver for PRFs
  pcfCeiling?: number; // Petty Cash Fund ceiling amount for the user
  status: UserStatus;
  permissions?: string[]; // User-level permission overrides (takes precedence over role permissions)
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  rating: number;
  contractEnd: string;
  // Extended details
  tin?: string;
  address?: string;
  paymentMode?: string;
  terms?: string;
  bankDetails?: BankDetails;
  isVatable?: boolean; // Informational: Indicates if supplier is VAT-registered (VAT/EWT now set at PRF level)
  businessUnitIds?: string[]; // Multi-tenancy: List of Business Units this supplier belongs to
  status?: 'ACTIVE' | 'ARCHIVED';
}

// Used for the PRF details
export interface SupplierDetails {
  name: string;
  tin: string;
  address: string;
  paymentMode: string;
  terms?: string;
  bankDetails?: BankDetails;
  isVatable?: boolean;
}

export interface RequisitionItem {
  itemId: string; // can be a generated ID for ad-hoc items
  name: string;
  quantity: number;
  uom: string; // Unit of Measure
  stockOnHand: number;
  price: number; // Estimated in BURF, Actual in PRF
  remarks?: string; // Item specific justification

  // Budget Integration - COA per item (Phase 1)
  coaCode?: string; // Chart of Account code
  coaName?: string; // Account name for display

  // Liquidation Data
  actualCost?: number;
  receiptRef?: string;
  receiptImageUrl?: string; // External link (Google Drive)
}

// Chart of Account for budget integration
export interface ChartOfAccount {
  code: string;
  name: string;
  type?: string;
  category?: string;
}

// FIX: Extracted expense structure as standalone type for reuse
export interface LiquidationExpense {
  id: string;
  date: string;
  supplier?: string;          // Legacy: supplier name
  vendorId?: string;          // New: supplier ID for linking
  vendorName?: string;        // New: supplier name for display
  tin?: string;               // TIN from supplier
  address?: string;           // Address from supplier
  invoiceNo?: string;         // Legacy: invoice number
  orNo?: string;              // New: OR No.
  coaCode: string;
  coaName: string;
  amount: number;
  description: string;
  vat?: number;               // VAT amount
  ewt?: number;               // EWT amount
  buId?: string;              // Business Unit ID
  buName?: string;            // Business Unit Name
  isAdditionalExpense?: boolean; // True if this is an added row (reimbursable to employee)
}

export interface LiquidationDetails {
  // Submission info
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: string;
  dateFiled: string;
  filedBy: string;

  // Items with actual costs
  items?: Array<{
    itemId: string;
    name: string;
    quantity: number;
    estimatedCost: number;
    actualCost: number;
    receiptRef: string;
  }>;

  // Totals
  totalBudget?: number; // Original budget (advance)
  totalActualAmount: number;
  variance?: number; // positive = surplus (to return), negative = deficit (to reimburse)
  refundAmount: number; // (PRF Total - Actual) if positive
  reimbursementAmount: number; // (Actual - PRF Total) if positive

  // Links and notes
  receiptsLink?: string; // Google Drive link or receipts URL
  remarks?: string;
  attachmentLink?: string; // Link to liquidation attachments

  // Dynamic expense rows with COA (new structure)
  expenses?: LiquidationExpense[];

  // Audit
  auditNotes?: string;
  auditedBy?: string;
  auditDate?: string;
  auditRemarks?: string;    // Auditor's remarks when clearing the liquidation
  auditClearedAt?: string;  // Timestamp when audit was cleared
  rejectionReason?: string; // Reason for rejection
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'; // Liquidation status
}

export interface RequisitionHistory {
  date: string; // Legacy: date only (YYYY-MM-DD)
  timestamp?: string; // New: ISO 8601 with time (e.g., "2024-12-15T17:30:00Z")
  actorId: string;
  actorName?: string;
  action: string; // 'CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'UPDATED'
  comments?: string;
  stage: RequisitionStatus;
  actionIndex?: number; // FIX BUG 6: Sequential index for server timestamp correlation
}

// ============================================================
// COST ALLOCATION - Corporate Expense Sharing
// ============================================================
export interface CostAllocation {
  buId: string;
  buName: string;
  amount: number;
  percentage: number;
}

export interface Requisition {
  id: string;
  requesterId: string;
  requesterName?: string; // Denormalized: User's display name at time of creation
  requesterPhotoUrl?: string; // Denormalized: User's photo URL at time of creation
  businessId: string;
  externalLink?: string; // External reference link (Google Drive, etc.)
  items: RequisitionItem[];
  totalAmount: number;

  // VAT/EWT Tax Calculations (optional)
  applyVat?: boolean;           // Whether VAT is applied
  vatPercentage?: number;       // VAT percentage (e.g., 12)
  vatAmount?: number;           // Computed VAT amount
  applyEwt?: boolean;           // Whether EWT is applied
  ewtPercentage?: number;       // EWT percentage (e.g., 1, 2, 5, 10)
  ewtAmount?: number;           // Computed EWT amount
  netAmount?: number;           // Total - EWT (what is actually paid)

  // Corporate Expense Sharing - Cost allocation breakdown
  costAllocation?: CostAllocation[];

  status: RequisitionStatus;
  dateCreated: string;
  description: string; // General description for the whole batch
  projectName?: string; // Project Name for PRF
  remarks?: string; // General remarks
  dateNeeded?: string; // Date needed for the request
  priority?: 'NORMAL' | 'URGENT'; // Priority level
  isUrgent?: boolean; // Auto-calculated: true if dateNeeded < 5 days from filing
  attachments?: string[]; // Array of attachment links
  prfIdentifier?: string; // Custom identifier for PRFs
  parentBurfId?: string; // Link to parent BURF for batch PRF tracking

  fundReleaseDate?: string; // Date when funds were released by Finance
  chequeNumber?: string; // Legacy: kept for backward compatibility
  chequeImageUrl?: string; // Legacy: Link to cheque image

  // Step 6: Bank Reference (Check Prep)
  bankRefNumber?: string; // Bank Reference Number entered during Check Prep
  bankRefLink?: string; // Link to bank reference document

  // Step 8: Check Voucher (Fund Release)
  checkVoucherNumber?: string; // Check Voucher Number entered during Fund Release
  checkVoucherLink?: string; // Link to check voucher document

  // PRF Specific Data
  prfDetails?: {
    supplier: SupplierDetails;
    preparedBy: string; // Purchasing Officer ID
    preparedByName?: string; // Denormalized: Admin name who prepared the PRF
    createdBy?: string; // User who initiated/created the PRF (optional for backward compatibility)
    datePrepared: string;
    requisitionId?: string; // Original BURF ID for conversions
    timestamp: string;
    designatedApproverId?: string; // New field for specific approver
  };

  // Liquidation Specific Data
  liquidationDetails?: LiquidationDetails;
  requisitionId?: string;
  timestamp: string;

  // PCF Replenishment link - used to update parent PCF status when funds are released
  linkedPcfId?: string;
  // Flag to skip liquidation for PCF replenishments (already liquidated via PCF form)
  isPcfReplenishment?: boolean;

  // Workflow Assignment - UID of the currently assigned approver (for dashboard filtering)
  currentApproverId?: string;

  // BURF Processing - Track which items have been converted to PRFs
  convertedItemIds?: string[]; // IDs of items already converted to PRF (preserves original items array)
  batchCounter?: number; // Counter for generating batch PRF IDs

  // Budget Integration
  purchaseType?: 'EVENT' | 'PAR_STOCKING'; // Type of purchase for budget categorization
  budgetStatus?: 'PENDING' | 'RESERVED' | 'COMMITTED' | 'RELEASED'; // Budget reservation status
  reservedBudgetAmount?: number; // Amount reserved from budget
  reservedBudgetId?: string; // Reference to budget reservation record
  coaCode?: string; // Chart of Account code for PRF-level budget tracking

  // New Enhancements
  history?: RequisitionHistory[];
}

export interface NotificationItem {
  id: string;
  type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO';
  message: string;
  requisitionId?: string;
  timestamp: string;
  read: boolean;
  targetRoles?: RoleType[]; // Changed to RoleType to support dynamic roles
}
