import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initialBusinesses } from '../src/config/mockData.js';
import { COLLECTIONS } from '../src/shared/types/firebase.types.js';
import serviceAccount from '../../firebase-adminsdk.json' assert { type: 'json' };

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function seedBusinesses() {
  console.log('Seeding businesses...');
  const businessCollection = db.collection(COLLECTIONS.BUSINESSES);
  
  const promises = initialBusinesses.map(async (business) => {
    try {
      await businessCollection.doc(business.id).set(business);
      console.log(`  - Added: ${business.name}`);
    } catch (error) {
      console.error(`  - Error adding ${business.name}:`, error);
    }
  });

  await Promise.all(promises);
  console.log('Business seeding complete.');
}

async function main() {
  await seedBusinesses();
}

main().catch(console.error);
