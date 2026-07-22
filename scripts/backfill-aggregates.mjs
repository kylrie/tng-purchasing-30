import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('tng-systems-firebase-adminsdk-fbsvc-9c071a7b56.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore('tng-systems');

async function getItemCost(itemId, businessUnitId, itemsCache) {
    const cacheKey = `${businessUnitId}_${itemId}`;
    if (itemsCache.has(cacheKey)) {
        return itemsCache.get(cacheKey);
    }

    const snap = await db.collection('inventory_items').doc(itemId).get();
    if (!snap.exists) {
        return { cost: 0, category: 'Other', recipeUnit: 'pcs', conversionRate: 1, type: 'Other', name: 'Unknown' };
    }
    const data = snap.data();
    const cost = data?.businessUnitOverrides?.[businessUnitId]?.costPerUnit || data?.costPerUnit || 0;
    const info = {
        cost,
        category: data?.category || 'Other',
        recipeUnit: data?.units?.recipeUnit || 'pcs',
        conversionRate: data?.units?.conversion || 1,
        type: data?.type || 'Other',
        name: data?.name || 'Unknown'
    };
    itemsCache.set(cacheKey, info);
    return info;
}

async function backfill() {
    console.log('Fetching all stock transactions from tng-systems...');
    const txSnapshot = await db.collection('stock_transactions').get();
    console.log(`Found ${txSnapshot.size} stock transactions.`);

    const itemsCache = new Map();
    const aggregatesMap = new Map(); // key -> updates object

    for (const doc of txSnapshot.docs) {
        const tx = doc.data();
        if (!tx.timestamp || !tx.itemId || !tx.businessUnitId) {
            console.log(`Skipping transaction ${doc.id} due to missing fields.`);
            continue;
        }

        // Convert Timestamp to YYYY-MM-DD
        const date = tx.timestamp.toDate();
        // Since we want local-timezone matching, we use the local timezone formatting
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        const dateStr = date.toISOString().split('T')[0];

        const key = `${tx.businessUnitId}_${dateStr}_${tx.itemId}`;

        if (!aggregatesMap.has(key)) {
            const itemInfo = await getItemCost(tx.itemId, tx.businessUnitId, itemsCache);
            aggregatesMap.set(key, {
                itemId: tx.itemId,
                itemName: tx.itemName || itemInfo.name,
                category: itemInfo.category,
                type: itemInfo.type,
                recipeUnit: itemInfo.recipeUnit,
                conversionRate: itemInfo.conversionRate,
                businessUnitId: tx.businessUnitId,
                date: dateStr,
                costPerUnit: itemInfo.cost,
                itemCost: itemInfo.cost, // save here for easy calculations
                qtyUpdates: {}, // type -> sum
                pesoUpdates: {} // type -> sum
            });
        }

        const agg = aggregatesMap.get(key);
        const type = tx.type;
        const qty = tx.quantity || 0;
        
        agg.qtyUpdates[type] = (agg.qtyUpdates[type] || 0) + qty;
        agg.pesoUpdates[type] = (agg.pesoUpdates[type] || 0) + (qty * agg.itemCost);
    }

    console.log(`Prepared ${aggregatesMap.size} aggregate documents. Writing in batches...`);

    let batch = db.batch();
    let count = 0;
    let batchCount = 1;

    for (const [key, agg] of aggregatesMap.entries()) {
        const docRef = db.collection('inventory_aggregates').doc(key);
        
        const updates = {
            itemId: agg.itemId,
            itemName: agg.itemName,
            category: agg.category,
            type: agg.type,
            recipeUnit: agg.recipeUnit,
            conversionRate: agg.conversionRate,
            businessUnitId: agg.businessUnitId,
            date: agg.date,
            costPerUnit: agg.costPerUnit
        };

        // Populate the increment fields
        for (const type of Object.keys(agg.qtyUpdates)) {
            updates[`${type}_qty`] = agg.qtyUpdates[type];
            updates[`${type}_peso`] = agg.pesoUpdates[type];
        }

        batch.set(docRef, updates, { merge: true });
        count++;

        if (count >= 400) {
            console.log(`Writing batch ${batchCount}...`);
            await batch.commit();
            batch = db.batch();
            count = 0;
            batchCount++;
        }
    }

    if (count > 0) {
        console.log(`Writing final batch ${batchCount}...`);
        await batch.commit();
    }

    console.log('Backfill successfully completed!');
}

backfill().catch(console.error);
