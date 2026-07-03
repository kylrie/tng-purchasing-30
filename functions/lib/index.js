"use strict";
/**
 * TNG Purchasing System - Cloud Functions
 *
 * Budget Control System functions for transaction validation
 * and budget management with RBAC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQrTables = exports.createQrTable = exports.createQrOrder = exports.getPublicMenu = exports.setBudgetLimit = exports.postTransaction = void 0;
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin SDK
(0, app_1.initializeApp)();
// Export all Cloud Functions
var transactions_1 = require("./transactions");
Object.defineProperty(exports, "postTransaction", { enumerable: true, get: function () { return transactions_1.postTransaction; } });
var admin_1 = require("./admin");
Object.defineProperty(exports, "setBudgetLimit", { enumerable: true, get: function () { return admin_1.setBudgetLimit; } });
// QR Ordering — Sprint 1 (Real Order Persistence)
var getPublicMenu_1 = require("./qr/getPublicMenu");
Object.defineProperty(exports, "getPublicMenu", { enumerable: true, get: function () { return getPublicMenu_1.getPublicMenu; } });
var createQrOrder_1 = require("./qr/createQrOrder");
Object.defineProperty(exports, "createQrOrder", { enumerable: true, get: function () { return createQrOrder_1.createQrOrder; } });
var createQrTable_1 = require("./qr/createQrTable");
Object.defineProperty(exports, "createQrTable", { enumerable: true, get: function () { return createQrTable_1.createQrTable; } });
var listQrTables_1 = require("./qr/listQrTables");
Object.defineProperty(exports, "listQrTables", { enumerable: true, get: function () { return listQrTables_1.listQrTables; } });
//# sourceMappingURL=index.js.map