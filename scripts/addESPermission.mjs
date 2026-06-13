/**
 * Add finance:budget_request:approve:bod to the ES role
 * in the config/permissions Firestore document.
 * Uses firebase-admin with application default credentials.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
  projectId: 'tng-systems',
});

const db = getFirestore('tng-systems');

async function main() {
  const docRef = db.collection('config').doc('permissions');
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.error('config/permissions document does not exist!');
    process.exit(1);
  }

  const data = docSnap.data();
  const esPerms = data?.permissions?.ES;

  if (!esPerms || !Array.isArray(esPerms)) {
    console.error('ES role not found or permissions is not an array');
    process.exit(1);
  }

  const permToAdd = 'finance:budget_request:approve:bod';

  if (esPerms.includes(permToAdd)) {
    console.log(`ES role already has "${permToAdd}"`);
    return;
  }

  // Use arrayUnion to atomically add the permission
  await docRef.update({
    'permissions.ES': FieldValue.arrayUnion(permToAdd),
  });

  console.log(`✅ Successfully added "${permToAdd}" to ES role`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
