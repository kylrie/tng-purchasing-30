/**
 * editQrTable — Callable Cloud Function (table rename · staff/admin)
 *
 * Thin onCall wrapper; all logic (RBAC, BU scope, dup check, rename-in-place)
 * lives in editQrTable.handler.ts so it is testable with an injected Firestore.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { editQrTableHandler, EditQrTableInput } from './editQrTable.handler';

export const editQrTable = onCall<EditQrTableInput>(request => editQrTableHandler(qrDb, request));
