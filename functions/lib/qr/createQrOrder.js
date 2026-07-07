"use strict";
/**
 * createQrOrder — Callable Cloud Function (Sprint 1 · Real Order Persistence)
 *
 * Thin onCall wrapper. Logic lives in createQrOrder.handler.ts. No auth required
 * (anonymous diners); the Admin SDK writes server-side so firestore.rules stays
 * staff-only. Persists at status AWAITING_PAYMENT / paymentStatus UNPAID.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQrOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const createQrOrder_handler_1 = require("./createQrOrder.handler");
exports.createQrOrder = (0, https_1.onCall)(request => (0, createQrOrder_handler_1.createQrOrderHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=createQrOrder.js.map