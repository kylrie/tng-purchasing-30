const admin = require('firebase-admin');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const defaultDb = admin.firestore();

async function inspect() {
  console.log("Checking 'config' collection...");
  const configSnapshot = await defaultDb.collection('config').get();
  console.log(`Found ${configSnapshot.size} documents in 'config' collection.`);
  
  if (configSnapshot.size > 0) {
    configSnapshot.forEach(doc => {
      console.log(` - Doc: ${doc.id}`);
    });
  }

  console.log("\Checking if 'config/permissions' exists as a document...");
  const permDoc = await defaultDb.doc('config/permissions').get();
  if (permDoc.exists) {
    console.log("YES, 'config/permissions' is a document. Keys:", Object.keys(permDoc.data() || {}));
  } else {
    console.log("NO, 'config/permissions' document does not exist.");
  }
}

inspect().catch(console.error);
