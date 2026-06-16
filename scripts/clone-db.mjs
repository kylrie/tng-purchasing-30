/**
 * Clone Firestore Database
 * Copies all documents from tng-systems database to (default) database
 * 
 * Usage: node scripts/clone-db.mjs
 * 
 * Prerequisites:
 * - Firebase Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
 * - Or run after: firebase login
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'tng-systems';
const SOURCE_DATABASE = 'tng-systems';
const TARGET_DATABASE = '(default)';

// Collections to clone
const COLLECTIONS = [
    'users',
    'requisitions',
    'businesses',
    'suppliers',
    'roles',
    'settings',
    'pcf_liquidations',
    'inventory_items',
    'stock_counts',
    'storage_areas'
];

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
        initializeApp({
            projectId: PROJECT_ID
        });
    }

    const sourceDb = getFirestore(undefined, SOURCE_DATABASE);
    const targetDb = getFirestore();  // Default database

    let totalDocs = 0;

    for (const collection of COLLECTIONS) {
        try {
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
