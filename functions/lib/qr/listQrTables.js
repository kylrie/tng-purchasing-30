"use strict";
/**
 * listQrTables — Callable Cloud Function (Sprint 1 remediation · M3)
 *
 * Thin onCall wrapper. Logic lives in listQrTables.handler.ts. The `qr_tables`
 * read rule is admin-only, so broad/PENDING staff cannot read raw docs and thus
 * cannot harvest `qrToken`s; this callable returns a token-omitting projection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQrTables = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const listQrTables_handler_1 = require("./listQrTables.handler");
exports.listQrTables = (0, https_1.onCall)(request => (0, listQrTables_handler_1.listQrTablesHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=listQrTables.js.map