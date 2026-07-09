"use strict";
/**
 * QR Ordering — print-control Callable Cloud Functions. Thin onCall wrappers; all
 * logic + auth live in printControl.handler.ts. Server-mediated because
 * qr_print_jobs / qr_print_config are `write: if false` for clients.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryPrintJob = exports.setAutoPrint = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const printControl_handler_1 = require("./printControl.handler");
exports.setAutoPrint = (0, https_1.onCall)(request => (0, printControl_handler_1.setAutoPrintHandler)(firestore_1.qrDb, request));
exports.retryPrintJob = (0, https_1.onCall)(request => (0, printControl_handler_1.retryPrintJobHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=printControl.js.map