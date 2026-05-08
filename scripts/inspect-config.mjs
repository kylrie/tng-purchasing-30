import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function inspect() {
    if (getApps().length === 0) {
        initializeApp({ projectId: 'tng-systems' });
    }
    const db = getFirestore(); // default db
    const targetDb = getFirestore(undefined, 'tng-systems'); // default db
    
    console.log("--- Default Database ---");
    const snapshot = await db.collection('config').get();
    for (const doc of snapshot.docs) {
        console.log(`Doc: ${doc.id}`);
        const collections = await doc.ref.listCollections();
        if (collections.length > 0) {
            console.log(`  Subcollections: ${collections.map(c => c.id).join(', ')}`);
        }
    }

    console.log("\n--- tng-systems Database ---");
    const targetSnapshot = await targetDb.collection('config').get();
    for (const doc of targetSnapshot.docs) {
        console.log(`Doc: ${doc.id}`);
        const collections = await doc.ref.listCollections();
        if (collections.length > 0) {
            console.log(`  Subcollections: ${collections.map(c => c.id).join(', ')}`);
        }
    }

    process.exit(0);
}

inspect().catch(console.error);
