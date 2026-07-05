import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

async function test() {
    try {
        const serviceAccount = JSON.parse(readFileSync('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json', 'utf8'));
        const app = initializeApp({
            credential: cert(serviceAccount),
            projectId: 'tng-systems'
        });
        
        console.log('App initialized.');
        const db = getFirestore(app);
        console.log('Testing access to default database...');
        const snapshot = await db.collection('users').limit(1).get();
        console.log('Default database access OK. Users count (limit 1):', snapshot.size);

        const sourceDb = getFirestore(app, 'backup-restored');
        console.log('Testing access to backup-restored database...');
        const snapshot2 = await sourceDb.collection('users').limit(1).get();
        console.log('Backup-restored access OK. Users count (limit 1):', snapshot2.size);

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
