import { Timestamp, QueryConstraint } from 'firebase/firestore';
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
  posPin?: string; // Legacy 4-digit PIN for Point of Sale
  posPinHash?: string; // Secure hashed 4-digit PIN for Point of Sale
}

// Main User type for the application - Re-export from single source of truth
export type User = ProcurementUser;

// Business document in Firestore
export interface FirestoreBusiness extends FirestoreDocument {
  name: string;
  currency: string;
  address: string;
  tin: string;
  hasTableManagement?: boolean;
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
  type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO' | 'ALERT' | 'REMINDER' | 'AUDIT' | 'PCF';
  message: string;
  requisitionId?: string;
  targetRoles: (UserRole | string)[];
  userId?: string; // Legacy/Optional: For backward compatibility and single-user targeting
  read: boolean;

  // Enhanced metadata for rich notifications
  subType?: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'REFILE' | 'PENDING_ACTION' | 'REMINDER' | 'CLEARED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string;       // Deep link to the relevant page
  metadata?: {
    requisitionNumber?: string;
    requesterName?: string;
    businessName?: string;
    amount?: number;
    stage?: string;         // Current workflow stage
    actorName?: string;     // Who triggered this notification
  };
  expiresAt?: Timestamp;    // Auto-cleanup after this date
  dismissedBy?: string[];   // Track per-user dismissals for role-based notifications
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
  BANK_RECON_STATEMENTS: 'bankReconStatements',
  POS_ORDERS: 'pos_orders',
  POS_SALES: 'pos_sales',
  POS_SALES_BATCHES: 'pos_sales_batches',
  STOCK_TRANSACTIONS: 'stock_transactions',
  INVENTORY_ITEMS: 'inventory_items',
  GOODS_RECEIVING_LOGS: 'goods_receiving_logs',
  BLACK_BOOK_RECIPES: 'blackBookRecipes',
} as const;

// Query constraints type
export type FirestoreConstraint = QueryConstraint;

// Re-export enums for convenience
export { UserRole, UserStatus };
