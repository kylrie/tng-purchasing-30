"use strict";
/**
 * updateQrOrderStatus — Callable Cloud Function (QR Operations · kitchen transitions)
 *
 * Thin onCall wrapper. All logic lives in updateQrOrderStatus.handler.ts (staff
 * RBAC + BU scope + strict forward-transition validation inside the handler).
 * Persists the ONLY sanctioned kitchen/fulfillment transitions onto a qr_order
 * (which is `write: if false` for clients) and appends an audit history entry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQrOrderStatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const updateQrOrderStatus_handler_1 = require("./updateQrOrderStatus.handler");
exports.updateQrOrderStatus = (0, https_1.onCall)(request => (0, updateQrOrderStatus_handler_1.updateQrOrderStatusHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=updateQrOrderStatus.js.map