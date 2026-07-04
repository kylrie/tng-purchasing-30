"use strict";
/**
 * postOfficialInvoice — Callable Cloud Function (Sprint 2 · Phase 3.5)
 *
 * Thin onCall wrapper. Logic lives in postOfficialInvoice.handler.ts. Staff-only
 * (RBAC inside the handler). Records a registered-POS invoice number onto a paid
 * order for reconciliation, audit-stamped. TNG issues no BIR invoice (A4).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.postOfficialInvoice = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const postOfficialInvoice_handler_1 = require("./postOfficialInvoice.handler");
exports.postOfficialInvoice = (0, https_1.onCall)(request => (0, postOfficialInvoice_handler_1.postOfficialInvoiceHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=postOfficialInvoice.js.map