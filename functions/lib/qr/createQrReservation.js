"use strict";
/**
 * createQrReservation — Callable Cloud Function (Ops → Tables quick reservations).
 *
 * Thin onCall wrapper; all logic (RBAC, authoritative table/BU resolution, PH
 * phone validation, conflict rejection) lives in createQrReservation.handler.ts
 * so it is testable with an injected Firestore.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQrReservation = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const createQrReservation_handler_1 = require("./createQrReservation.handler");
exports.createQrReservation = (0, https_1.onCall)(request => (0, createQrReservation_handler_1.createQrReservationHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=createQrReservation.js.map