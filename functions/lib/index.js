"use strict";
/**
 * TNG Purchasing System - Cloud Functions
 *
 * Budget Control System functions for transaction validation
 * and budget management with RBAC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBudgetLimit = exports.postTransaction = void 0;
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin SDK
(0, app_1.initializeApp)();
// Export all Cloud Functions
var transactions_1 = require("./transactions");
Object.defineProperty(exports, "postTransaction", { enumerable: true, get: function () { return transactions_1.postTransaction; } });
var admin_1 = require("./admin");
Object.defineProperty(exports, "setBudgetLimit", { enumerable: true, get: function () { return admin_1.setBudgetLimit; } });
//# sourceMappingURL=index.js.map