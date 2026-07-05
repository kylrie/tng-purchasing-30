"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateStockTransactions = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Reusable helper to get costPerUnit
const getItemCost = async (itemId, businessUnitId) => {
    const snap = await admin.firestore().collection('inventory_items').doc(itemId).get();
    if (!snap.exists)
        return { cost: 0, category: 'Other', recipeUnit: 'pcs', conversionRate: 1, type: 'Other', name: 'Unknown' };
    const data = snap.data();
    // Prioritize business unit specific cost, fallback to default
    const cost = data?.businessUnitOverrides?.[businessUnitId]?.costPerUnit || data?.costPerUnit || 0;
    return {
        cost,
        category: data?.category || 'Other',
        recipeUnit: data?.units?.recipeUnit || 'pcs',
        conversionRate: data?.units?.conversion || 1,
        type: data?.type || 'Other',
        name: data?.name || 'Unknown'
    };
};
exports.aggregateStockTransactions = functions.firestore
    .document('stock_transactions/{txId}')
    .onCreate(async (snap, context) => {
    const tx = snap.data();
    if (!tx.timestamp || !tx.itemId || !tx.businessUnitId)
        return;
    // Convert Timestamp to YYYY-MM-DD string
    const dateStr = tx.timestamp.toDate().toISOString().split('T')[0];
    // Document ID: businessUnitId_YYYY-MM-DD_itemId
    const aggRef = admin.firestore().collection('inventory_aggregates')
        .doc(`${tx.businessUnitId}_${dateStr}_${tx.itemId}`);
    const itemInfo = await getItemCost(tx.itemId, tx.businessUnitId);
    const updates = {
        itemId: tx.itemId,
        itemName: tx.itemName || itemInfo.name,
        category: itemInfo.category,
        type: itemInfo.type,
        recipeUnit: itemInfo.recipeUnit,
        conversionRate: itemInfo.conversionRate,
        businessUnitId: tx.businessUnitId,
        date: dateStr,
        costPerUnit: itemInfo.cost // Latest cost per unit known
    };
    // Increment specific transaction type buckets using atomic increments
    // We preserve the sign of tx.quantity for ADJUSTMENT and other signed types
    updates[`${tx.type}_qty`] = admin.firestore.FieldValue.increment(tx.quantity);
    // For peso, we generally want positive value for the report logic, but if tx.quantity was negative (loss),
    // we should track it signed.
    const signedPeso = tx.quantity * itemInfo.cost;
    updates[`${tx.type}_peso`] = admin.firestore.FieldValue.increment(signedPeso);
    await aggRef.set(updates, { merge: true });
});
//# sourceMappingURL=aggregators.js.map