/**
 * createQrTable — Callable Cloud Function (Sprint 1 · staff/admin)
 *
 * Thin onCall wrapper; all logic (RBAC H1, BU/duplicate checks M5) lives in
 * createQrTable.handler.ts so it is testable with an injected Firestore.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { createQrTableHandler, CreateQrTableInput } from './createQrTable.handler';

export const createQrTable = onCall<CreateQrTableInput>(request => createQrTableHandler(qrDb, request));
