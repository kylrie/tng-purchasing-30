const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const backupDb = admin.firestore(admin.app(), 'backup-restored');
const backupMay11Db = admin.firestore(admin.app(), 'backup-restored-may11');
const targetDb = admin.firestore(admin.app(), 'tng-systems');

async function compare() {
  const bDoc = await backupDb.doc('config/permissions').get();
  const b11Doc = await backupMay11Db.doc('config/permissions').get();
  const tDoc = await targetDb.doc('config/permissions').get();
  
  const bData = bDoc.data() || {};
  const b11Data = b11Doc.data() || {};
  const tData = tDoc.data() || {};
  
  console.log("backup-restored hash length:", JSON.stringify(bData).length);
  console.log("backup-restored-may11 hash length:", JSON.stringify(b11Data).length);
  console.log("tng-systems hash length:", JSON.stringify(tData).length);
  
  // Show diffs
  if (JSON.stringify(bData) === JSON.stringify(tData)) {
    console.log("tng-systems is EXACTLY the same as backup-restored (May 12).");
  } else {
    console.log("tng-systems is DIFFERENT from backup-restored (May 12).");
  }
  
  if (JSON.stringify(b11Data) === JSON.stringify(tData)) {
    console.log("tng-systems is EXACTLY the same as backup-restored-may11.");
  } else {
    console.log("tng-systems is DIFFERENT from backup-restored-may11.");
  }
}
compare().catch(console.error);
