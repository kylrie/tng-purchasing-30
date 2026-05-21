const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const defaultDb = admin.firestore();
const targetDb = admin.firestore(admin.app(), 'tng-systems');

async function check() {
  console.log("Checking collections in default DB:");
  const defaultCollections = await defaultDb.listCollections();
  console.log(defaultCollections.map(c => c.id));

  console.log("Checking documents in config collection (default DB):");
  try {
    const defaultDocs = await defaultDb.collection('config').get();
    console.log(defaultDocs.docs.map(d => d.id));
  } catch(e) {}

  console.log("Checking documents in config collection (target DB):");
  try {
    const targetDocs = await targetDb.collection('config').get();
    console.log(targetDocs.docs.map(d => d.id));
  } catch(e) {}
}

check().catch(console.error);
