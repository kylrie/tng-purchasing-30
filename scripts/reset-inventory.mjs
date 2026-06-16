import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function clearCollection(db, collectionName) {
    console.log(`🗑️ Clearing collection: ${collectionName}`);
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        console.log(`   ⚠️ Collection ${collectionName} is empty, skipping`);
        return 0;
    }

    let count = 0;
    let batch = db.batch();

    for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;

        if (count % 500 === 0) {
            await batch.commit();
            batch = db.batch();
            console.log(`   ✓ Deleted ${count} documents...`);
        }
    }

    if (count % 500 !== 0) {
        await batch.commit();
    }

    console.log(`   ✅ Deleted ${count} documents from ${collectionName}`);
    return count;
}

async function main() {
    console.log('🔄 Targeted Inventory Reset Script');
    console.log('=================================');
    
    if (getApps().length === 0) {
        // Find the service account key in the project root
        const serviceAccountPath = join(__dirname, '..', 'tng-systems-firebase-adminsdk-fbsvc-e2c2bb4cf9.json');
        let credential;
        try {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
            credential = cert(serviceAccount);
        } catch (e) {
            console.log("Service account key not found, attempting default credentials...");
        }

        initializeApp({
            credential,
            projectId: 'tng-systems'
        });
    }

    // We must ensure we connect to the tng-systems database, not the default one!
    const db = getFirestore('tng-systems');
    let totalDeleted = 0;

    const collectionsToClear = [
        'pos_sales',
        'pos_sales_batches',
        'goods_receiving_logs',
        'stock_transactions',
        'recon_history',
        'inventory_investigations'
    ];

    for (const collectionName of collectionsToClear) {
        try {
            const count = await clearCollection(db, collectionName);
            totalDeleted += count;
        } catch (error) {
            console.error(`   ❌ Error clearing ${collectionName}:`, error.message);
        }
    }

    console.log('');
    console.log('=================================');
    console.log(`✅ Reset complete! Total documents deleted: ${totalDeleted}`);
    console.log(`ℹ️ Note: inventory_items stock levels were NOT modified, as requested.`);
}

main().catch(console.error);
