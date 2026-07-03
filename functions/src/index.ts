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

// QR Ordering — Sprint 1 (Real Order Persistence)
export { getPublicMenu } from './qr/getPublicMenu';
export { createQrOrder } from './qr/createQrOrder';
export { createQrTable } from './qr/createQrTable';
export { listQrTables } from './qr/listQrTables';
