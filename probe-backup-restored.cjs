const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

// Use a separate app instance so we can talk to the named database
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, 'probe-app');

const backupDb = app.firestore();
backupDb.settings({ databaseId: 'backup-restored' });

async function probe() {
  console.log("Probing 'backup-restored' database for 'config/permissions'...");
  try {
    const doc = await backupDb.doc('config/permissions').get();
    if (doc.exists) {
      console.log("FOUND. Keys:", Object.keys(doc.data() || {}));
    } else {
      console.log("NOT FOUND in 'backup-restored'.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}

probe();
