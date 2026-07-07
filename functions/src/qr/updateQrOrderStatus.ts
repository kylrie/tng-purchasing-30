/**
 * updateQrOrderStatus — Callable Cloud Function (QR Operations · kitchen transitions)
 *
 * Thin onCall wrapper. All logic lives in updateQrOrderStatus.handler.ts (staff
 * RBAC + BU scope + strict forward-transition validation inside the handler).
 * Persists the ONLY sanctioned kitchen/fulfillment transitions onto a qr_order
 * (which is `write: if false` for clients) and appends an audit history entry.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { updateQrOrderStatusHandler, UpdateQrOrderStatusInput } from './updateQrOrderStatus.handler';

export const updateQrOrderStatus = onCall<UpdateQrOrderStatusInput>(request =>
    updateQrOrderStatusHandler(qrDb, request),
);
