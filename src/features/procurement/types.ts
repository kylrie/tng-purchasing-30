
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // Can manage users and settings
  ADMIN = 'ADMIN', // System Admin (Deprecated/Legacy, kept for compatibility)
  MANAGER = 'MANAGER', // Acts as Business Unit Manager (BUM)
  EMPLOYEE = 'EMPLOYEE', // Requestor
  CIC = 'CIC', // Corporate Inventory Controller
  PURCHASING_OFFICER = 'PURCHASING_OFFICER',
  FINANCE = 'FINANCE', // Treasury (Releases Budget)
  AUDITOR = 'AUDITOR', // Checks Liquidation
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  BOARD_OF_DIRECTOR = 'BOARD_OF_DIRECTOR'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE'
}

// Helper function to determine if user has global access to all business units
// Refactored to only return true for Super Admin, forcing others to use granular businessUnitIds
export const hasGlobalAccess = (role: UserRole): boolean => {
  return role === UserRole.SUPER_ADMIN;
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
  CANCELLED = 'CANCELLED' // New Status
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
  role: UserRole;
  permissionLevel?: number; // 1-5, higher is more priviledge
  avatar: string;
  email: string;
  department?: string;
  businessId: string; // Primary Business Unit (Legacy support)
  businessUnitIds?: string[]; // New: List of accessible Business Units. If empty/null, falls back to businessId.
  isPasswordSet?: boolean; // Track if Google users have set a password
  isApprover?: boolean; // New field to designate if user is an eligible approver for PRFs
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
  businessUnitIds?: string[]; // Multi-tenancy: List of Business Units this supplier belongs to
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
  dateFiled: string;
  filedBy: string;
  totalActualAmount: number;
  refundAmount: number; // (PRF Total - Actual) if positive
  reimbursementAmount: number; // (Actual - PRF Total) if positive
  auditNotes?: string;
  auditedBy?: string;
  auditDate?: string;
  rejectionReason?: string; // Reason for rejection
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'; // Liquidation status
  attachmentLink?: string; // Link to liquidation attachments
}

export interface RequisitionHistory {
  date: string;
  actorId: string;
  actorName?: string;
  action: string; // 'CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'UPDATED'
  comments?: string;
  stage: RequisitionStatus;
}

export interface Requisition {
  id: string;
  requesterId: string;
  businessId: string;
  items: RequisitionItem[];
  totalAmount: number;
  status: RequisitionStatus;
  dateCreated: string;
  description: string; // General description for the whole batch
  projectName?: string; // Project Name for PRF
  remarks?: string; // General remarks
  dateNeeded?: string; // Date needed for the request
  priority?: 'NORMAL' | 'URGENT'; // Priority level
  attachments?: string[]; // Array of attachment links
  prfIdentifier?: string; // Custom identifier for PRFs

  fundReleaseDate?: string; // Date when funds were released by Finance
  chequeNumber?: string;
  chequeImageUrl?: string; // Link to cheque image

  // PRF Specific Data
  prfDetails?: {
    supplier: SupplierDetails;
    preparedBy: string; // Purchasing Officer ID
    createdBy?: string; // User who initiated/created the PRF (optional for backward compatibility)
    datePrepared: string;
    requisitionId?: string;
    timestamp: string;
    designatedApproverId?: string; // New field for specific approver
  };

  // Liquidation Specific Data
  liquidationDetails?: LiquidationDetails;
  requisitionId?: string;
  timestamp: string;

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
  targetRoles?: UserRole[];
}
