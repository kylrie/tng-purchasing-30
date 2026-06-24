import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
    if (getApps().length === 0) {
        initializeApp({ projectId: 'tng-systems' });
    }

    const db = getFirestore();
    
    // Find Beach Bosses business unit
    const buSnapshot = await db.collection('businesses').where('name', '==', 'Beach Bosses').get();
    
    if (buSnapshot.empty) {
        console.log('Business unit "Beach Bosses" not found.');
        return;
    }
    
    const beachBossesId = buSnapshot.docs[0].id;
    console.log(`Found "Beach Bosses" with ID: ${beachBossesId}`);
    
    // Find menu items
    const menuSnapshot = await db.collection('menu_items').where('businessUnitId', '==', beachBossesId).get();
    console.log(`Found ${menuSnapshot.size} menu items for Beach Bosses.`);
    
    let linkedInventoryCount = 0;
    for (const doc of menuSnapshot.docs) {
        const data = doc.data();
        if (data.linkedInventoryItemId) {
            const invDoc = await db.collection('inventory_items').doc(data.linkedInventoryItemId).get();
            if (invDoc.exists) {
                linkedInventoryCount++;
            }
        }
    }
    console.log(`Found ${linkedInventoryCount} linked inventory items (Finished Goods).`);
}

main().catch(console.error);
