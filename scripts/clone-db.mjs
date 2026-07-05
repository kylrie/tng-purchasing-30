/**
 * Clone Firestore Database
 * Copies all documents from backup-restored database to (default) database
 * 
 * Usage: node scripts/clone-db.mjs
 * 
 * Prerequisites:
 * - Firebase Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
 * - Or run after: firebase login
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const PROJECT_ID = 'tng-systems';
const SOURCE_DATABASE = 'backup-restored';
const TARGET_DATABASE = '(default)';

// Collections to clone
const COLLECTIONS = [
    'users',
    'requisitions',
    'businesses',
    'suppliers',
    // 'roles', excluded as per user request
    'settings',
    'pcf_liquidations',
    'inventory_items',
    'stock_counts',
    'storage_areas',
    'chart_of_accounts',
    'budgets',
    'budgetReservations',
    'transactions',
    'bankReconStatements',
    'pos_orders',
    'pos_sales',
    'pos_sales_batches',
    'stock_transactions',
    'goods_receiving_logs',
    'blackBookRecipes',
    'notifications',
    'menu_items',
    'productionRecipes',
    'system_activity_logs',
    'stocktake_audit_logs'
];

async function wipeCollection(targetDb, collectionName) {
    console.log(`🧹 Wiping collection in target: ${collectionName}`);
    const targetRef = targetDb.collection(collectionName);
    
    while (true) {
        const snapshot = await targetRef.limit(500).get();
        if (snapshot.empty) break;
        
        let batch = targetDb.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`   ✓ Deleted ${snapshot.size} documents...`);
    }
    console.log(`   ✅ Wiped ${collectionName}`);
}

async function cloneCollection(sourceDb, targetDb, collectionName) {
    console.log(`📦 Cloning collection: ${collectionName}`);

    const sourceRef = sourceDb.collection(collectionName);
    const targetRef = targetDb.collection(collectionName);

    const snapshot = await sourceRef.get();

    if (snapshot.empty) {
        console.log(`   ⚠️ Collection ${collectionName} is empty, skipping`);
        return 0;
    }

    let count = 0;
    let batch = targetDb.batch();

    for (const doc of snapshot.docs) {
        batch.set(targetRef.doc(doc.id), doc.data());
        count++;

        // Firestore batch limit is 500
        if (count % 500 === 0) {
            await batch.commit();
            batch = targetDb.batch();
            console.log(`   ✓ Committed ${count} documents...`);
        }
    }

    // Commit remaining
    if (count % 500 !== 0) {
        await batch.commit();
    }

    console.log(`   ✅ Cloned ${count} documents from ${collectionName}`);
    return count;
}

async function main() {
    console.log('🔄 Database Clone Script');
    console.log('========================');
    console.log(`Source: ${SOURCE_DATABASE}`);
    console.log(`Target: ${TARGET_DATABASE}`);
    console.log('');

    // Initialize Firebase Admin
    if (getApps().length === 0) {
        const serviceAccount = JSON.parse(readFileSync('./tng-systems-firebase-adminsdk-fbsvc-9c071a7b56.json', 'utf8'));
        
        initializeApp({
            credential: cert(serviceAccount),
            projectId: PROJECT_ID
        });
    }

    const sourceDb = getFirestore(undefined, SOURCE_DATABASE);
    const targetDb = getFirestore();  // Default database

    let totalDocs = 0;

    for (const collection of COLLECTIONS) {
        try {
            await wipeCollection(targetDb, collection);
            const count = await cloneCollection(sourceDb, targetDb, collection);
            totalDocs += count;
        } catch (error) {
            console.error(`   ❌ Error cloning ${collection}:`, error.message);
        }
    }

    console.log('');
    console.log('========================');
    console.log(`✅ Clone complete! Total documents: ${totalDocs}`);
}

main().catch(console.error);
