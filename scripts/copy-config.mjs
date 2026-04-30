import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'tng-systems';

async function copyCollection(sourceDb, targetDb, collectionName) {
    console.log(`\nCopying collection: ${collectionName} from (default) to tng-systems`);

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

async function main() {
    console.log('Starting migration...');
    
    // Initialize Firebase Admin using default credentials
    if (getApps().length === 0) {
        initializeApp({
            projectId: PROJECT_ID
        });
    }

    const sourceDb = getFirestore(); // (default) database
    const targetDb = getFirestore(undefined, 'tng-systems'); // tng-systems database

    await copyCollection(sourceDb, targetDb, 'config');
    
    console.log('\nMigration complete!');
    process.exit(0);
}

main().catch(console.error);
