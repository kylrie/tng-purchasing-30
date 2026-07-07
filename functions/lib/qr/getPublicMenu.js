"use strict";
/**
 * getPublicMenu — Callable Cloud Function (Sprint 1 · MOCK-FREE, real Firestore)
 *
 * Thin onCall wrapper. Logic lives in getPublicMenu.handler.ts. No auth required
 * (anonymous diners) — the Admin SDK reads server-side, so firestore.rules is
 * never touched by the customer path (Master Plan §6.4 / A9).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicMenu = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const getPublicMenu_handler_1 = require("./getPublicMenu.handler");
exports.getPublicMenu = (0, https_1.onCall)(request => (0, getPublicMenu_handler_1.getPublicMenuHandler)(firestore_1.qrDb, request));
//# sourceMappingURL=getPublicMenu.js.map