const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const defaultDb = admin.firestore();
const targetDb = admin.firestore(admin.app(), 'tng-systems');

async function check() {
  console.log("Checking 'tng-systems' database for 'config/permissions'...");
  try {
    const permDoc = await targetDb.doc('config/permissions').get();
    if (permDoc.exists) {
      console.log("YES, 'config/permissions' exists in 'tng-systems'. Keys:", Object.keys(permDoc.data() || {}));
    } else {
      console.log("NO, 'config/permissions' does NOT exist in 'tng-systems'.");
    }
  } catch (err) {
    console.error("Error accessing 'tng-systems' database:", err.message);
  }
}

check().catch(console.error);
