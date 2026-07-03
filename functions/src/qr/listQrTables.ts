/**
 * listQrTables — Callable Cloud Function (Sprint 1 remediation · M3)
 *
 * Thin onCall wrapper. Logic lives in listQrTables.handler.ts. The `qr_tables`
 * read rule is admin-only, so broad/PENDING staff cannot read raw docs and thus
 * cannot harvest `qrToken`s; this callable returns a token-omitting projection.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { listQrTablesHandler, ListQrTablesInput } from './listQrTables.handler';

export const listQrTables = onCall<ListQrTablesInput>(request => listQrTablesHandler(qrDb, request));
