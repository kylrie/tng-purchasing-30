import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json' assert { type: 'json' };

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function patchPermissions() {
  console.log('Patching permissions...');
  const docRef = db.collection('config').doc('permissions');
  
  const doc = await docRef.get();
  if (!doc.exists) {
    console.error('config/permissions document does not exist!');
    return;
  }

  const data = doc.data();
  const permissions = data.permissions || {};
  
  const rolesToPatch = ['BOARD_OF_DIRECTOR', 'BOD', 'ADMIN', 'FINANCE_HEAD'];
  const newPermission = 'finance:cheque:authorize';
  
  let updated = false;

  rolesToPatch.forEach(role => {
    if (permissions[role]) {
      if (!permissions[role].includes(newPermission)) {
        permissions[role].push(newPermission);
        console.log(`Added ${newPermission} to ${role}`);
        updated = true;
      } else {
        console.log(`${role} already has ${newPermission}`);
      }
    }
  });

  if (updated) {
    await docRef.update({ permissions });
    console.log('Successfully updated config/permissions document in Firestore!');
  } else {
    console.log('No updates were necessary.');
  }
}

patchPermissions().catch(console.error);
