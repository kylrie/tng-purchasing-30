/**
 * deleteQrTable — Callable Cloud Function (hard delete · staff/admin)
 *
 * Thin onCall wrapper; all logic (RBAC, BU scope, active-order/reservation
 * guards, hard delete) lives in deleteQrTable.handler.ts so it is testable with
 * an injected Firestore.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { deleteQrTableHandler, DeleteQrTableInput } from './deleteQrTable.handler';

export const deleteQrTable = onCall<DeleteQrTableInput>(request => deleteQrTableHandler(qrDb, request));
