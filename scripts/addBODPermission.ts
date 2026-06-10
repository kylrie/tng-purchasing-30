import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../../firebase-adminsdk.json' assert { type: 'json' };

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function main() {
  console.log('Adding BOD approval permission to ADMIN role...');
  const docRef = db.collection('config').doc('permissions');
  
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    const data = docSnap.data();
    const permissions = data?.permissions || {};
    
    if (permissions['ADMIN']) {
      const adminPerms = permissions['ADMIN'];
      if (!adminPerms.includes('finance:budget_request:approve:bod')) {
        adminPerms.push('finance:budget_request:approve:bod');
        await docRef.update({
          'permissions.ADMIN': adminPerms
        });
        console.log('Successfully added finance:budget_request:approve:bod to ADMIN');
      } else {
        console.log('ADMIN already has the permission');
      }
    } else {
      console.log('ADMIN role not found in permissions doc');
    }
  } else {
    console.log('config/permissions document does not exist');
  }
}

main().catch(console.error);
