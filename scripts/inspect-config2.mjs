import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function inspect() {
    if (getApps().length === 0) {
        initializeApp({ projectId: 'tng-systems' });
    }
    const db = getFirestore();
    
    console.log("Checking config/permissions...");
    const pDoc = await db.doc('config/permissions').get();
    console.log(`Document config/permissions exists: ${pDoc.exists}`);
    if (pDoc.exists) {
        console.log(`Data keys: ${Object.keys(pDoc.data() || {}).join(', ')}`);
    }

    const subcols = await db.doc('config/permissions').listCollections();
    console.log(`Subcollections of config/permissions: ${subcols.map(c => c.id).join(', ')}`);

    // Let's also check if 'permissions' is just a top-level collection inside config
    const rootCols = await db.listCollections();
    console.log(`\nAll Root collections: ${rootCols.map(c => c.id).join(', ')}`);
    
    process.exit(0);
}

inspect().catch(console.error);
