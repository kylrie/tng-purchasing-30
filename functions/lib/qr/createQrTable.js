"use strict";
/**
 * createQrTable — Callable Cloud Function (Sprint 1 · staff/admin)
 *
 * Thin onCall wrapper; all logic (RBAC H1, BU/duplicate checks M5) lives in
 * createQrTable.handler.ts so it is testable with an injected Firestore.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQrTable = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const createQrTable_handler_1 = require("./createQrTable.handler");
exports.createQrTable = (0, https_1.onCall)(request => (0, createQrTable_handler_1.createQrTableHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=createQrTable.js.map