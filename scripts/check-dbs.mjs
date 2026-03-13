import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('../firebase-adminsdk.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

async function checkDb(dbName) {
    console.log(`\n--- Checking Database: ${dbName || '(default)'} ---`);
    try {
        const db = getFirestore(dbName);
        const collections = await db.listCollections();
        if (collections.length === 0) {
            console.log('No collections found.');
        } else {
            console.log(`Found ${collections.length} collections:`);
            for (const collection of collections) {
                const snapshot = await collection.limit(1).get();
                console.log(`- ${collection.id}: ${snapshot.empty ? 'Empty' : 'Has documents'}`);
            }
        }
    } catch (error) {
        console.error(`Error checking database ${dbName || '(default)'}:`, error.message);
    }
}

async function main() {
    await checkDb();
    await checkDb('tng-systems');
}

main().catch(console.error);
