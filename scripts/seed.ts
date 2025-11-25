import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { initialBusinesses, INITIAL_MOCK_USERS } from '../src/config/mockData.js';
import { COLLECTIONS } from '../src/shared/types/firebase.types.js';

const require = createRequire(import.meta.url);
const serviceAccount = require('../firebase-adminsdk.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Connect to the specific database 'tng-systems'
const db = getFirestore(app, 'tng-systems');

async function seedDatabase() {
  try {
    console.log('Seeding businesses...');
    const businessesCollection = db.collection(COLLECTIONS.BUSINESSES);
    for (const business of initialBusinesses) {
      await businessesCollection.add(business);
    }
    console.log('Businesses seeded successfully!');

    console.log('Seeding users...');
    const usersCollection = db.collection(COLLECTIONS.USERS);
    for (const user of INITIAL_MOCK_USERS) {
      await usersCollection.add(user);
    }
    console.log('Users seeded successfully!');

  } catch (error) {
    console.error('Error seeding database: ', error);
  } finally {
    // Close the connection to allow the script to exit
    // Not strictly necessary for one-off scripts but good practice
  }
}

seedDatabase();
