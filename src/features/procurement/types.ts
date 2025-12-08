
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
  BURF_PENDING_MANAGER = 'BURF_PENDING_MANAGER',
  BURF_PENDING_CIC = 'BURF_PENDING_CIC',
  READY_FOR_PRF = 'READY_FOR_PRF',
  PRF_PENDING_MANAGER = 'PRF_PENDING_MANAGER',
  APPROVED_FOR_PAYMENT = 'APPROVED_FOR_PAYMENT',
  FUNDS_RELEASED = 'FUNDS_RELEASED', // Funds given to employee/supplier
  LIQUIDATION_FILED = 'LIQUIDATION_FILED', // Employee submitted receipts
  LIQUIDATION_REJECTED = 'LIQUIDATION_REJECTED', // Auditor rejected, can refile
  AUDITED_CLEARED = 'AUDITED_CLEARED', // Finance approved liquidation
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
  isVatable?: boolean; // Vatable or Non-Vat
  ewtRate?: number; // Expanded Withholding Tax rate (e.g., 1, 2, 5, 10)
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

  // Liquidation Data
  actualCost?: number;
  receiptRef?: string;
  receiptImageUrl?: string; // External link (Google Drive)
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

  // Audit
  auditNotes?: string;
  auditedBy?: string;
  auditDate?: string;
  rejectionReason?: string; // Reason for rejection
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'; // Liquidation status
}

export interface RequisitionHistory {
  date: string;
  actorId: string;
  actorName?: string;
  action: string; // 'CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'UPDATED'
  comments?: string;
  stage: RequisitionStatus;
  actionIndex?: number; // FIX BUG 6: Sequential index for server timestamp correlation
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
  chequeNumber?: string;
  chequeImageUrl?: string; // Link to cheque image

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
