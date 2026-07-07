/**
 * postOfficialInvoice — Callable Cloud Function (Sprint 2 · Phase 3.5)
 *
 * Thin onCall wrapper. Logic lives in postOfficialInvoice.handler.ts. Staff-only
 * (RBAC inside the handler). Records a registered-POS invoice number onto a paid
 * order for reconciliation, audit-stamped. TNG issues no BIR invoice (A4).
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { postOfficialInvoiceHandler, PostOfficialInvoiceInput } from './postOfficialInvoice.handler';

export const postOfficialInvoice = onCall<PostOfficialInvoiceInput>(request => postOfficialInvoiceHandler(qrDb, request));
