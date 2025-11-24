import { Timestamp } from 'firebase/firestore';
import type { UserRole } from '../../features/auth/types';
import type { RequisitionStatus } from '../../features/procurement/types';

// Base Firestore document with timestamps
export interface FirestoreDocument {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// User document in Firestore
export interface FirestoreUser extends FirestoreDocument {
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  avatar?: string;
}

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
export interface FirestorePRFDetails {
  supplier: {
    name: string;
    tin: string;
    address: string;
    paymentMode: string;
    terms: string;
  };
  preparedBy: string;
  datePrepared: string;
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
  prfDetails?: FirestorePRFDetails;
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

// Collection names as constants
export const COLLECTIONS = {
  USERS: 'users',
  BUSINESSES: 'businesses',
  REQUISITIONS: 'requisitions',
  SUPPLIERS: 'suppliers',
  NOTIFICATIONS: 'notifications',
} as const;

// Query constraints type
export type FirestoreConstraint = any; // Will be typed from firebase/firestore
