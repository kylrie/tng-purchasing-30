const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const backupDb = admin.firestore(admin.app(), 'backup-restored');
const targetDb = admin.firestore(admin.app(), 'tng-systems');

async function check() {
  console.log("Checking backup-restored config/permissions:");
  const bDoc = await backupDb.doc('config/permissions').get();
  console.log("Data keys:", Object.keys(bDoc.data() || {}));
  const bSubs = await backupDb.doc('config/permissions').listCollections();
  console.log("Subcollections:", bSubs.map(c => c.id));
  if (bSubs.length > 0) {
    for (let sub of bSubs) {
      const subDocs = await sub.get();
      console.log(` - ${sub.id}: ${subDocs.docs.length} documents`);
    }
  }

  console.log("\nChecking tng-systems config/permissions:");
  const tDoc = await targetDb.doc('config/permissions').get();
  console.log("Data keys:", Object.keys(tDoc.data() || {}));
  const tSubs = await targetDb.doc('config/permissions').listCollections();
  console.log("Subcollections:", tSubs.map(c => c.id));
  if (tSubs.length > 0) {
    for (let sub of tSubs) {
      const subDocs = await sub.get();
      console.log(` - ${sub.id}: ${subDocs.docs.length} documents`);
    }
  }
}
check().catch(console.error);
