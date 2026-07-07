/**
 * createQrOrder — Callable Cloud Function (Sprint 1 · Real Order Persistence)
 *
 * Thin onCall wrapper. Logic lives in createQrOrder.handler.ts. No auth required
 * (anonymous diners); the Admin SDK writes server-side so firestore.rules stays
 * staff-only. Persists at status AWAITING_PAYMENT / paymentStatus UNPAID.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { createQrOrderHandler } from './createQrOrder.handler';

export const createQrOrder = onCall(request => createQrOrderHandler(qrDb, request));
