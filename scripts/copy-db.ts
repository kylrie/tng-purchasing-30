import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../firebase-adminsdk.json' assert { type: 'json' };

// Initialize Firebase Admin SDK if not already initialized
let app: App;
if (!getApps().length) {
    app = initializeApp({
        credential: cert(serviceAccount as ServiceAccount)
    });
} else {
    app = getApps()[0];
}

// Get references to both databases using the databaseId parameter
const sourceDb = getFirestore(app, 'tng-systems');
const targetDb = getFirestore(app); // (default) database

async function copyCollection(collectionName: string) {
    console.log(`\nCopying collection: ${collectionName}`);

    try {
        const snapshot = await sourceDb.collection(collectionName).get();
        console.log(`Found ${snapshot.size} documents in ${collectionName}`);

        if (snapshot.size === 0) {
            console.log(`  Skipping empty collection`);
            return;
        }

        let batch = targetDb.batch();
        let count = 0;
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const targetDocRef = targetDb.collection(collectionName).doc(doc.id);
            batch.set(targetDocRef, doc.data());
            count++;
            batchCount++;

            // Commit batch every 500 documents (Firestore limit) and create a new batch
            if (batchCount >= 500) {
                await batch.commit();
                console.log(`  Committed ${count} documents...`);
                batch = targetDb.batch(); // Create new batch
                batchCount = 0;
            }
        }

        // Commit remaining documents
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`✓ Successfully copied ${count} documents from ${collectionName}`);
    } catch (error) {
        console.error(`✗ Error copying ${collectionName}:`, error);
    }
}

async function copyDatabase() {
    console.log('Starting database copy from tng-systems to (default)...\n');

    try {
        // Get all collections from source database
        const collections = await sourceDb.listCollections();
        console.log(`Found ${collections.length} collections to copy:`);
        collections.forEach(col => console.log(`  - ${col.id}`));

        // Copy each collection
        for (const collection of collections) {
            await copyCollection(collection.id);
        }

        console.log('\n✓ Database copy completed successfully!');
    } catch (error) {
        console.error('\n✗ Database copy failed:', error);
    } finally {
        process.exit(0);
    }
}

// Run the migration
copyDatabase();
