/**
 * getQrTableToken — Callable Cloud Function (Sprint 2 · admin table-management)
 *
 * Thin onCall wrapper. Logic lives in getQrTableToken.handler.ts. Admin-only
 * (RBAC inside the handler). Reveals one table's qrToken on explicit request.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { getQrTableTokenHandler, GetQrTableTokenInput } from './getQrTableToken.handler';

export const getQrTableToken = onCall<GetQrTableTokenInput>(request => getQrTableTokenHandler(qrDb, request));
