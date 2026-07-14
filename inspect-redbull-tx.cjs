const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./tng-systems-firebase-adminsdk-fbsvc-9c071a7b56.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore(app, 'tng-systems');

async function run() {
  console.log("Fetching item ID for 'RED BULL IN CAN 250ML'...");
  const itemSnap = await db.collection('inventory_items')
    .where('name', '==', 'RED BULL IN CAN 250ML')
    .get();

  if (itemSnap.empty) {
    console.log("Item not found!");
    return;
  }

  const itemId = itemSnap.docs[0].id;
  console.log(`Found item ID: ${itemId}`);

  console.log("\nFetching stock transactions for this item...");
  const txSnap = await db.collection('stock_transactions')
    .where('itemId', '==', itemId)
    .get();

  console.log(`Found ${txSnap.size} total transactions.`);
  
  const txs = [];
  txSnap.forEach(doc => {
    txs.push({ id: doc.id, ...doc.data() });
  });

  // Sort by timestamp
  txs.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

  txs.forEach(t => {
    const dateStr = t.timestamp.toDate().toISOString();
    console.log(`- Date: ${dateStr} | Type: ${t.type} | Qty: ${t.quantity} | Value: ${t.totalValue} | Notes: ${t.notes} | Ref: ${t.referenceId}`);
  });
}

run().catch(console.error);
