"use strict";
/**
 * TNG Purchasing System - Cloud Functions
 *
 * Budget Control System functions for transaction validation
 * and budget management with RBAC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPosPin = exports.setPosPin = exports.onInventoryItemUpdated = exports.updateQrOrderStatus = exports.xenditWebhook = exports.createXenditSession = exports.postOfficialInvoice = exports.getQrOrder = exports.getQrTableToken = exports.listQrTables = exports.createQrTable = exports.createQrOrder = exports.getPublicMenu = exports.aggregateStockTransactions = exports.setBudgetLimit = exports.postTransaction = void 0;
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin SDK
(0, app_1.initializeApp)();
// Export all Cloud Functions
var transactions_1 = require("./transactions");
Object.defineProperty(exports, "postTransaction", { enumerable: true, get: function () { return transactions_1.postTransaction; } });
var admin_1 = require("./admin");
Object.defineProperty(exports, "setBudgetLimit", { enumerable: true, get: function () { return admin_1.setBudgetLimit; } });
var aggregators_1 = require("./inventory/aggregators");
Object.defineProperty(exports, "aggregateStockTransactions", { enumerable: true, get: function () { return aggregators_1.aggregateStockTransactions; } });
// QR Ordering — Sprint 1 (Real Order Persistence)
var getPublicMenu_1 = require("./qr/getPublicMenu");
Object.defineProperty(exports, "getPublicMenu", { enumerable: true, get: function () { return getPublicMenu_1.getPublicMenu; } });
var createQrOrder_1 = require("./qr/createQrOrder");
Object.defineProperty(exports, "createQrOrder", { enumerable: true, get: function () { return createQrOrder_1.createQrOrder; } });
var createQrTable_1 = require("./qr/createQrTable");
Object.defineProperty(exports, "createQrTable", { enumerable: true, get: function () { return createQrTable_1.createQrTable; } });
var listQrTables_1 = require("./qr/listQrTables");
Object.defineProperty(exports, "listQrTables", { enumerable: true, get: function () { return listQrTables_1.listQrTables; } });
var getQrTableToken_1 = require("./qr/getQrTableToken");
Object.defineProperty(exports, "getQrTableToken", { enumerable: true, get: function () { return getQrTableToken_1.getQrTableToken; } });
// QR Ordering — Sprint 2 (customer order-status read)
var getQrOrder_1 = require("./qr/getQrOrder");
Object.defineProperty(exports, "getQrOrder", { enumerable: true, get: function () { return getQrOrder_1.getQrOrder; } });
// QR Ordering — Sprint 2 (Phase 3.5 · cashier reconciliation)
var postOfficialInvoice_1 = require("./qr/postOfficialInvoice");
Object.defineProperty(exports, "postOfficialInvoice", { enumerable: true, get: function () { return postOfficialInvoice_1.postOfficialInvoice; } });
// QR Ordering — Phase 3 (Xendit payment session creation)
var createXenditSession_1 = require("./qr/createXenditSession");
Object.defineProperty(exports, "createXenditSession", { enumerable: true, get: function () { return createXenditSession_1.createXenditSession; } });
// QR Ordering — Phase 3 (Xendit webhook · source of truth for PAID)
var xenditWebhook_1 = require("./qr/xenditWebhook");
Object.defineProperty(exports, "xenditWebhook", { enumerable: true, get: function () { return xenditWebhook_1.xenditWebhook; } });
// QR Ordering — Operations (staff kitchen/fulfillment status transitions)
var updateQrOrderStatus_1 = require("./qr/updateQrOrderStatus");
Object.defineProperty(exports, "updateQrOrderStatus", { enumerable: true, get: function () { return updateQrOrderStatus_1.updateQrOrderStatus; } });
// Inventory — Background Recipe Recalculation
var recipeRecalculation_1 = require("./inventory/recipeRecalculation");
Object.defineProperty(exports, "onInventoryItemUpdated", { enumerable: true, get: function () { return recipeRecalculation_1.onInventoryItemUpdated; } });
var posAuth_1 = require("./posAuth");
Object.defineProperty(exports, "setPosPin", { enumerable: true, get: function () { return posAuth_1.setPosPin; } });
Object.defineProperty(exports, "verifyPosPin", { enumerable: true, get: function () { return posAuth_1.verifyPosPin; } });
//# sourceMappingURL=index.js.map