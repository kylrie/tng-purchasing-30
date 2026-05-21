const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

// ── Source app → backup-restored database ─────────────────────────────────────
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, 'source-app');

const sourceDb = sourceApp.firestore();
sourceDb.settings({ databaseId: 'backup-restored' });

// ── Target app → tng-systems database ────────────────────────────────────────
const targetApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, 'target-app');

const targetDb = targetApp.firestore();
targetDb.settings({ databaseId: 'tng-systems' });

// ─────────────────────────────────────────────────────────────────────────────

async function clone() {
  console.log("Reading 'config/permissions' from 'backup-restored' database...");
  const sourceDocRef = sourceDb.doc('config/permissions');
  const sourceDoc = await sourceDocRef.get();

  if (!sourceDoc.exists) {
    console.error("Source document does not exist in 'backup-restored' database.");
    process.exit(1);
  }

  const data = sourceDoc.data();
  console.log("Data read successfully. Keys:", Object.keys(data));

  // Check for subcollections
  const subcollections = await sourceDocRef.listCollections();
  if (subcollections.length > 0) {
    console.log(`Found ${subcollections.length} subcollection(s):`, subcollections.map(c => c.id));
  } else {
    console.log("No subcollections found.");
  }

  console.log("\nWriting to 'tng-systems' database...");
  await targetDb.doc('config/permissions').set(data);
  console.log("✅ Clone completed successfully!");
  process.exit(0);
}

clone().catch(err => {
  console.error("Clone failed:", err);
  process.exit(1);
});
