"use strict";
/**
 * getQrOrder — Callable Cloud Function (Sprint 2 · customer order-status read)
 *
 * Thin onCall wrapper. Logic lives in getQrOrder.handler.ts. No auth required
 * (anonymous diners) — the Admin SDK reads server-side, so firestore.rules is
 * never touched by the customer path. Read-only: no payment, no Xendit, no
 * kitchen writes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQrOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const getQrOrder_handler_1 = require("./getQrOrder.handler");
exports.getQrOrder = (0, https_1.onCall)(request => (0, getQrOrder_handler_1.getQrOrderHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=getQrOrder.js.map