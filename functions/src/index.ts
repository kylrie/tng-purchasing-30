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

// QR Ordering — Sprint 1 (Real Order Persistence)
export { getPublicMenu } from './qr/getPublicMenu';
export { createQrOrder } from './qr/createQrOrder';
export { createQrTable } from './qr/createQrTable';
export { listQrTables } from './qr/listQrTables';
export { getQrTableToken } from './qr/getQrTableToken';
export { createQrReservation } from './qr/createQrReservation';

// QR Ordering — Sprint 2 (customer order-status read)
export { getQrOrder } from './qr/getQrOrder';

// QR Ordering — Sprint 2 (Phase 3.5 · cashier reconciliation)
export { postOfficialInvoice } from './qr/postOfficialInvoice';

// QR Ordering — Phase 3 (Xendit payment session creation)
export { createXenditSession } from './qr/createXenditSession';

// QR Ordering — Phase 3 (Xendit webhook · source of truth for PAID)
export { xenditWebhook } from './qr/xenditWebhook';

// QR Ordering — Operations (staff kitchen/fulfillment status transitions)
export { updateQrOrderStatus } from './qr/updateQrOrderStatus';

// QR Ordering — Automatic printing (staff control of the local Print Bridge)
export { setAutoPrint, retryPrintJob } from './qr/printControl';

// Inventory — Background Recipe Recalculation
export { onInventoryItemUpdated } from './inventory/recipeRecalculation';
export { setPosPin, verifyPosPin } from './posAuth';
export { checkoutOrder } from './posOrders';
