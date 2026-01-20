import { Timestamp } from 'firebase/firestore';
import type { RequisitionStatus, User as ProcurementUser } from '../../features/procurement/types';
import { UserRole, UserStatus } from '../../features/procurement/types';

// Base Firestore document with timestamps
export interface FirestoreDocument {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// User document in Firestore
export interface FirestoreUser extends FirestoreDocument {
  email: string;
  name: string;
  employeeId?: string; // Human-readable ID (e.g., "JDOE-001")
  role: UserRole;
  businessId: string;
  businessUnitIds?: string[];
  status: UserStatus;
  avatar?: string;
  permissions?: string[]; // User-level permission overrides
}

// Main User type for the application - Re-export from single source of truth
export type User = ProcurementUser;

// Business document in Firestore
export interface FirestoreBusiness extends FirestoreDocument {
  name: string;
  currency: string;
  address: string;
  tin: string;
}

// Requisition Item
export interface FirestoreRequisitionItem {
  itemId: string;
  name: string;
  quantity: number;
  uom: string;
  stockOnHand: number;
  price: number;
  remarks?: string;
}

// PRF Details
export interface PRFDetails {
  supplier: {
    name: string;
    tin: string;
    address: string;
    paymentMode: string;
    terms: string;
  };
  preparedBy: string;
  datePrepared: string;
  timestamp: string;
}

// Requisition document in Firestore
export interface FirestoreRequisition extends FirestoreDocument {
  requesterId: string;
  businessId: string;
  description: string;
  projectName: string;
  items: FirestoreRequisitionItem[];
  totalAmount: number;
  status: RequisitionStatus;
  dateCreated: string;
  remarks?: string;
  attachments?: string[];
  prfDetails?: PRFDetails;
}

// Supplier document in Firestore
export interface FirestoreSupplier extends FirestoreDocument {
  name: string;
  category: string;
  rating: number;
  contractEnd: string;
  tin: string;
  address: string;
  paymentMode: string;
  terms: string;
}

// Notification document in Firestore
export interface FirestoreNotification extends FirestoreDocument {
  type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO';
  message: string;
  requisitionId?: string;
  targetRoles: UserRole[];
  read: boolean;
}

// Chart of Accounts document
export interface ChartOfAccount {
  code: string;           // Account No (used as doc ID)
  name: string;           // Account Name
  parentId: string;       // Parent ID for hierarchy
  classification: string; // Account Classification
  financialStatement: string; // Balance Sheet, Income Statement, etc.
  accountType: string;    // Assets, Liabilities, Equity, Revenue, Expenses
  cashFlowClassification?: string; // General C Cash Flow Classification
  isActive: boolean;      // Default true
}

// Collection names as constants
export const COLLECTIONS = {
  USERS: 'users',
  BUSINESSES: 'businesses',
  REQUISITIONS: 'requisitions',
  SUPPLIERS: 'suppliers',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  CHART_OF_ACCOUNTS: 'chart_of_accounts',
  BUDGETS: 'budgets',
  BUDGET_RESERVATIONS: 'budgetReservations',
  TRANSACTIONS: 'transactions',
} as const;

// Query constraints type
export type FirestoreConstraint = any; // Will be typed from firebase/firestore

// Re-export enums for convenience
export { UserRole, UserStatus };
