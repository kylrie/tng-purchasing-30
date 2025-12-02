import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../firebase-adminsdk.json' assert { type: 'json' };

// Initialize Firebase Admin SDK
let app: App;
if (!getApps().length) {
    app = initializeApp({
        credential: cert(serviceAccount as ServiceAccount)
    });
} else {
    app = getApps()[0];
}

// Define databases
// Source: (default)
const sourceDb = getFirestore(app);
// Target: tng-systems
const targetDb = getFirestore(app, 'tng-systems');

const UOM_COLLECTION = 'uom';
const UOM_DOC_ID = 'units';

async function copyUOM() {
    console.log('Starting UOM copy from (default) to tng-systems...\n');

    try {
        const sourceDocRef = sourceDb.collection(UOM_COLLECTION).doc(UOM_DOC_ID);
        const sourceDoc = await sourceDocRef.get();

        if (!sourceDoc.exists) {
            console.error(`Source document ${UOM_COLLECTION}/${UOM_DOC_ID} does not exist in (default) database.`);
            return;
        }

        const data = sourceDoc.data();
        console.log('Found UOM data:', JSON.stringify(data, null, 2));

        const targetDocRef = targetDb.collection(UOM_COLLECTION).doc(UOM_DOC_ID);
        await targetDocRef.set(data!);

        console.log(`\n✓ Successfully copied UOM data to tng-systems database.`);
    } catch (error) {
        console.error('\n✗ UOM copy failed:', error);
    }
}

copyUOM();
