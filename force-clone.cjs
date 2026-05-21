const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const backupDb = admin.firestore(admin.app(), 'backup-restored');
const targetDb = admin.firestore(admin.app(), 'tng-systems');

async function doClone() {
  const docPath = 'config/permissions';
  
  console.log(`Reading ${docPath} from backup-restored...`);
  const backupDoc = await backupDb.doc(docPath).get();
  const data = backupDoc.data();
  
  console.log("Roles in backup:", data.roles);

  console.log(`\nWriting exactly this data to tng-systems ${docPath}...`);
  await targetDb.doc(docPath).set(data);
  
  console.log("Write complete! Verifying...");
  const verifyDoc = await targetDb.doc(docPath).get();
  console.log("Roles in tng-systems now:", verifyDoc.data().roles);
}

doClone().catch(console.error);
