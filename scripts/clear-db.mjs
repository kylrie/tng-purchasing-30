import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function clearCollection(db, collectionRef) {
    const collectionName = collectionRef.id;
    console.log(`🗑️ Clearing collection: ${collectionName}`);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        console.log(`   ⚠️ Collection ${collectionName} is empty, skipping`);
        return 0;
    }

    let count = 0;
    let batch = db.batch();

    for (const doc of snapshot.docs) {
        // Skip super admins in the users collection
        if (collectionName === 'users') {
            const data = doc.data();
            if (data.role === 'SUPER_ADMIN') {
                console.log(`   🛡️ Skipping super admin: ${data.email || data.name || doc.id}`);
                continue;
            }
        }

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
    console.log('🔄 Database Clear Script');
    console.log('========================');
    
    if (getApps().length === 0) {
        initializeApp({ projectId: 'tng-systems' });
    }

    const db = getFirestore();
    let totalDeleted = 0;

    const collections = await db.listCollections();

    for (const collection of collections) {
        try {
            const count = await clearCollection(db, collection);
            totalDeleted += count;
        } catch (error) {
            console.error(`   ❌ Error clearing ${collection.id}:`, error.message);
        }
    }

    console.log('');
    console.log('========================');
    console.log(`✅ Clear complete! Total documents deleted: ${totalDeleted}`);
}

main().catch(console.error);
