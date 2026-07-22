"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateStockTransactions = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const db = (0, firestore_2.getFirestore)((0, app_1.getApp)(), 'tng-systems');
// Reusable helper to get costPerUnit
const getItemCost = async (itemId, businessUnitId) => {
    const snap = await db.collection('inventory_items').doc(itemId).get();
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
exports.aggregateStockTransactions = (0, firestore_1.onDocumentCreated)({
    document: 'stock_transactions/{txId}',
    database: 'tng-systems'
}, async (event) => {
    const tx = event.data?.data();
    if (!tx || !tx.timestamp || !tx.itemId || !tx.businessUnitId)
        return;
    // Convert Timestamp to YYYY-MM-DD string
    const dateStr = tx.timestamp.toDate().toISOString().split('T')[0];
    // Document ID: businessUnitId_YYYY-MM-DD_itemId
    const aggRef = db.collection('inventory_aggregates')
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
    updates[`${tx.type}_qty`] = firestore_2.FieldValue.increment(tx.quantity);
    // For peso, we generally want positive value for the report logic, but if tx.quantity was negative (loss),
    // we should track it signed.
    const signedPeso = tx.quantity * itemInfo.cost;
    updates[`${tx.type}_peso`] = firestore_2.FieldValue.increment(signedPeso);
    await aggRef.set(updates, { merge: true });
});
//# sourceMappingURL=aggregators.js.map