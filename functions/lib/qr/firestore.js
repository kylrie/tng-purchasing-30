"use strict";
/**
 * QR Ordering — shared Firestore handle (Sprint 1 remediation · M6)
 *
 * Single source of the QR callables' Firestore instance. Previously each
 * callable inlined `getFirestore(getApp(), 'tng-systems')`, so the still-open
 * P0-2 production-database decision was hardcoded in three places and could
 * drift. Centralizing it here means the eventual P0-2 outcome changes exactly
 * one line.
 *
 * NOTE (P0-2 / Master Plan O9): the target below matches the existing
 * functions (transactions.ts / admin.ts), which target 'tng-systems'. If the
 * production-database decision lands on '(default)', change ONLY this constant.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrDb = exports.QR_DATABASE_ID = void 0;
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
exports.QR_DATABASE_ID = 'tng-systems';
exports.qrDb = (0, firestore_1.getFirestore)((0, app_1.getApp)(), exports.QR_DATABASE_ID);
//# sourceMappingURL=firestore.js.map