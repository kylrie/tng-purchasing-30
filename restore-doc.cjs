const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const backupDb = admin.firestore(admin.app(), 'backup-restored');
const targetDb = admin.firestore(admin.app(), 'tng-systems');
const defaultDb = admin.firestore();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function restore() {
  console.log("Checking if backup-restored database is ready...");
  let ready = false;
  while (!ready) {
    try {
      await backupDb.listCollections();
      ready = true;
      console.log("Backup database is ready.");
    } catch (e) {
      console.log("Waiting for backup database to be ready...");
      await delay(5000);
    }
  }

  const docPaths = ['config/permissions', 'config/permission'];
  let restored = false;
  
  for (const docPath of docPaths) {
    console.log(`Checking ${docPath} in backup-restored...`);
    const backupDoc = await backupDb.doc(docPath).get();
    
    if (backupDoc.exists) {
      restored = true;
      const data = backupDoc.data();
      console.log(`Found ${docPath}! Data keys:`, Object.keys(data).length);
      
      console.log(`Writing ${docPath} to tng-systems database...`);
      await targetDb.doc(docPath).set(data);
      
      console.log(`Writing ${docPath} to (default) database...`);
      await defaultDb.doc(docPath).set(data);
      
      console.log("Restore complete for", docPath);
    } else {
      console.log(`${docPath} not found in backup.`);
    }
  }

  if (!restored) {
    console.log("Failed to find config/permission or config/permissions in the backup.");
  }
}

restore().catch(console.error);
