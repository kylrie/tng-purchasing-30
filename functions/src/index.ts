/**
 * TNG Purchasing System - Cloud Functions
 * 
 * Budget Control System functions for transaction validation
 * and budget management with RBAC.
 */

import { initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
initializeApp();

// Export all Cloud Functions
export { postTransaction } from './transactions';
export { setBudgetLimit } from './admin';
export { aggregateStockTransactions } from './inventory/aggregators';
