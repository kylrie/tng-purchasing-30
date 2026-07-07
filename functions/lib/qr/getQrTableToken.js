"use strict";
/**
 * getQrTableToken — Callable Cloud Function (Sprint 2 · admin table-management)
 *
 * Thin onCall wrapper. Logic lives in getQrTableToken.handler.ts. Admin-only
 * (RBAC inside the handler). Reveals one table's qrToken on explicit request.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQrTableToken = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const getQrTableToken_handler_1 = require("./getQrTableToken.handler");
exports.getQrTableToken = (0, https_1.onCall)(request => (0, getQrTableToken_handler_1.getQrTableTokenHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=getQrTableToken.js.map