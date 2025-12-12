/**
 * Firestore Data Backup and Copy Script
 * 
 * This script:
 * 1. Backs up the destination (default) database to a JSON file
 * 2. Exports data from source database (tng-systems)
 * 3. Imports data to destination database (default)
 * 
 * Usage: node scripts/firestore-copy.mjs
 */

import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SOURCE_PROJECT_ID = 'tng-systems';
const DEST_PROJECT_ID = 'tng-systems'; // Same project, different database
const SOURCE_DATABASE_ID = '(default)'; // This is actually the main one
const DEST_DATABASE_ID = '(default)'; // Where we want to copy TO

// Collections to copy
const COLLECTIONS_TO_COPY = [
    'users',
    'businesses',
    'requisitions',
    'pcf_liquidations',
    'suppliers',
    'counters',
    'config'
];

// Create backup directory
const BACKUP_DIR = resolve(__dirname, '../backups');
if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILE = resolve(BACKUP_DIR, `firestore-backup-${timestamp}.json`);

// Helper to get service account path
function getServiceAccountPath() {
    const possiblePaths = [
        resolve(__dirname, '../serviceAccountKey.json'),
        resolve(__dirname, '../service-account.json'),
        resolve(__dirname, '../firebase-admin-key.json'),
    ];

    for (const p of possiblePaths) {
        if (existsSync(p)) {
            console.log(`Found service account at: ${p}`);
            return p;
        }
    }

    throw new Error(
        'Service account key not found. Please download it from Firebase Console:\n' +
        '1. Go to Project Settings > Service Accounts\n' +
        '2. Click "Generate New Private Key"\n' +
        '3. Save as serviceAccountKey.json in project root'
    );
}

async function exportCollection(db, collectionName) {
    console.log(`  Exporting ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    const data = {};

    for (const doc of snapshot.docs) {
        data[doc.id] = doc.data();

        // Handle subcollections (like history in requisitions)
        const subcollections = await doc.ref.listCollections();
        if (subcollections.length > 0) {
            data[doc.id]._subcollections = {};
            for (const subcol of subcollections) {
                const subSnap = await subcol.get();
                data[doc.id]._subcollections[subcol.id] = {};
                subSnap.docs.forEach(subDoc => {
                    data[doc.id]._subcollections[subcol.id][subDoc.id] = subDoc.data();
                });
            }
        }
    }

    console.log(`  ✓ Exported ${snapshot.size} documents from ${collectionName}`);
    return data;
}

async function importCollection(db, collectionName, data) {
    console.log(`  Importing ${collectionName}...`);
    const batch = db.batch();
    let count = 0;

    for (const [docId, docData] of Object.entries(data)) {
        const subcollections = docData._subcollections;
        delete docData._subcollections;

        const docRef = db.collection(collectionName).doc(docId);
        batch.set(docRef, docData, { merge: true });
        count++;

        // Handle subcollections separately (can't be in batch)
        if (subcollections) {
            for (const [subcolName, subcolData] of Object.entries(subcollections)) {
                for (const [subDocId, subDocData] of Object.entries(subcolData)) {
                    await docRef.collection(subcolName).doc(subDocId).set(subDocData, { merge: true });
                }
            }
        }

        // Commit batch every 500 documents
        if (count % 500 === 0) {
            await batch.commit();
            console.log(`    Committed ${count} documents...`);
        }
    }

    if (count % 500 !== 0) {
        await batch.commit();
    }

    console.log(`  ✓ Imported ${count} documents to ${collectionName}`);
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' Firestore Data Backup and Copy');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Source: ${SOURCE_PROJECT_ID} (database: ${SOURCE_DATABASE_ID})`);
    console.log(`Destination: ${DEST_PROJECT_ID} (database: ${DEST_DATABASE_ID})`);
    console.log(`Backup file: ${BACKUP_FILE}`);
    console.log('');

    try {
        // Initialize Firebase Admin
        const serviceAccountPath = getServiceAccountPath();
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

        // Clear existing apps
        for (const app of getApps()) {
            await deleteApp(app);
        }

        const app = initializeApp({
            credential: cert(serviceAccount),
            projectId: SOURCE_PROJECT_ID
        });

        const db = getFirestore(app);

        // Step 1: Create backup of current data
        console.log('\n📦 Step 1: Creating backup of current database...');
        const backupData = {};
        for (const collection of COLLECTIONS_TO_COPY) {
            try {
                backupData[collection] = await exportCollection(db, collection);
            } catch (err) {
                console.log(`  ⚠ Collection ${collection} not found or error: ${err.message}`);
                backupData[collection] = {};
            }
        }

        writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2));
        console.log(`\n✅ Backup saved to: ${BACKUP_FILE}`);

        console.log('\n════════════════════════════════════════════════════════');
        console.log(' BACKUP COMPLETE!');
        console.log('════════════════════════════════════════════════════════');
        console.log('\nThe data has been backed up. To copy data between databases,');
        console.log('you would need two separate Firebase projects or use the');
        console.log('Firebase Console to export/import between databases.');
        console.log('\nBackup location:', BACKUP_FILE);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();
