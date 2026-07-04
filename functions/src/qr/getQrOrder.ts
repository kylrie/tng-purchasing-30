/**
 * getQrOrder — Callable Cloud Function (Sprint 2 · customer order-status read)
 *
 * Thin onCall wrapper. Logic lives in getQrOrder.handler.ts. No auth required
 * (anonymous diners) — the Admin SDK reads server-side, so firestore.rules is
 * never touched by the customer path. Read-only: no payment, no Xendit, no
 * kitchen writes.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { getQrOrderHandler, GetQrOrderInput } from './getQrOrder.handler';

export const getQrOrder = onCall<GetQrOrderInput>(request => getQrOrderHandler(qrDb, request));
