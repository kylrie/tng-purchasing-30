import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
    if (getApps().length === 0) {
        initializeApp({ projectId: 'tng-systems' });
    }
    const db = getFirestore();
    const docRef = db.doc('config/permissions');

    const snap = await docRef.get();
    if (!snap.exists) {
        console.log('Permissions doc not found!');
        return;
    }

    const data = snap.data();
    let roles = data.roles || [];
    let permissions = data.permissions || {};

    const rolesToRemove = ['OWNER', 'GM', 'CHEF', 'INVENTORY_OFFICER'];

    const newRoles = roles.filter(r => !rolesToRemove.includes(r));
    
    rolesToRemove.forEach(r => {
        delete permissions[r];
    });

    console.log('Old roles:', roles);
    console.log('New roles:', newRoles);

    await docRef.set({
        roles: newRoles,
        permissions: permissions
    }, { merge: false }); // merge: false ensures the deleted keys in permissions are actually removed since we are writing the whole map

    console.log('Roles removed successfully.');
}

main().catch(console.error);
