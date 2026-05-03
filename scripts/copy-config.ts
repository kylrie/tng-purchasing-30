import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Auto-detect service account file in project root
if (!getApps().length) {
    const rootDir = resolve(__dirname, '..');
    const files = readdirSync(rootDir);
    const serviceAccountFile = files.find(
        (f: string) => f.includes('firebase-adminsdk') && f.endsWith('.json')
    );
    const keyPath = serviceAccountFile
        ? resolve(rootDir, serviceAccountFile)
        : resolve(rootDir, 'serviceAccountKey.json');

    if (existsSync(keyPath)) {
        console.log(`Using service account: ${keyPath}`);
        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
        initializeApp({ credential: cert(serviceAccount), projectId: 'tng-systems' });
    } else {
        console.warn('⚠️ No service account JSON found. Trying default credentials...');
        initializeApp({ projectId: 'tng-systems' });
    }
}

const app = getApps()[0];
const sourceDb = getFirestore(app);               // (default) database
const targetDb = getFirestore(app, 'tng-systems'); // tng-systems database

async function copyCollection(collectionName: string) {
    console.log(`\nCopying collection: ${collectionName} from (default) to tng-systems`);

    try {
        const snapshot = await sourceDb.collection(collectionName).get();
        console.log(`Found ${snapshot.size} documents in ${collectionName}`);

        if (snapshot.size === 0) {
            console.log('  Skipping empty collection');
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

            // Firestore batch limit is 500 writes
            if (batchCount >= 500) {
                await batch.commit();
                console.log(`  Committed ${count} documents...`);
                batch = targetDb.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`✓ Successfully copied ${count} documents from ${collectionName}`);
    } catch (error) {
        console.error(`✗ Error copying ${collectionName}:`, error);
    }
}

async function run() {
    console.log('Starting migration...');
    await copyCollection('config');
    console.log('\nMigration complete!');
    process.exit(0);
}

run();
