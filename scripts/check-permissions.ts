import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Firebase configuration (you'll need to add your config)
const firebaseConfig = {
    // Add your config from src/config/firebase.ts
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkPermissions() {
    try {
        console.log('Fetching permissions from Firebase...\n');

        const docRef = doc(db, 'config', 'permissions');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            console.log('✅ Permissions document found!\n');
            console.log('='.repeat(80));
            console.log('ROLES TO PERMISSIONS MAPPING');
            console.log('='.repeat(80));

            if (data.permissions) {
                Object.entries(data.permissions).forEach(([role, perms]) => {
                    console.log(`\n${role}:`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    console.log(`  Total permissions: ${(perms as any[]).length}`);
                    console.log(`  Permissions:`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (perms as any[]).forEach(p => {
                        console.log(`    - ${p}`);
                    });
                });
            } else {
                console.log('❌ No permissions field found in document');
            }

            console.log('\n' + '='.repeat(80));
            console.log('ROLES');
            console.log('='.repeat(80));

            if (data.roles && Array.isArray(data.roles)) {
                console.log(`\nTotal roles: ${data.roles.length}`);
                data.roles.forEach((role: string) => {
                    console.log(`  - ${role}`);
                });
            } else {
                console.log('❌ No roles field found in document');
            }

        } else {
            console.log('❌ No permissions document found in Firebase');
            console.log('The system will use default permissions from config/permissions.ts');
        }
    } catch (error) {
        console.error('Error checking permissions:', error);
    }
}

checkPermissions();
