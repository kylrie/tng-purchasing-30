import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Reusable helper to get costPerUnit
const getItemCost = async (itemId: string, businessUnitId: string): Promise<{ cost: number, category: string, recipeUnit: string, conversionRate: number, type: string, name: string }> => {
    const snap = await admin.firestore().collection('inventory_items').doc(itemId).get();
    if (!snap.exists) return { cost: 0, category: 'Other', recipeUnit: 'pcs', conversionRate: 1, type: 'Other', name: 'Unknown' };
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

export const aggregateStockTransactions = functions.firestore
    .document('stock_transactions/{txId}')
    .onCreate(async (snap, context) => {
        const tx = snap.data();
        if (!tx.timestamp || !tx.itemId || !tx.businessUnitId) return;

        // Convert Timestamp to YYYY-MM-DD string
        const dateStr = tx.timestamp.toDate().toISOString().split('T')[0];
        
        // Document ID: businessUnitId_YYYY-MM-DD_itemId
        const aggRef = admin.firestore().collection('inventory_aggregates')
            .doc(`${tx.businessUnitId}_${dateStr}_${tx.itemId}`);

        const itemInfo = await getItemCost(tx.itemId, tx.businessUnitId);

        const updates: any = {
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
