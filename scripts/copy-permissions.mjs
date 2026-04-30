import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    console.log('Starting permissions migration...');
    
    if (getApps().length === 0) {
        // Find any file matching *firebase-adminsdk*.json in the root directory
        const rootDir = resolve(__dirname, '..');
        const files = readdirSync(rootDir);
        const serviceAccountFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
        
        let keyPath = null;
        if (serviceAccountFile) {
            keyPath = resolve(rootDir, serviceAccountFile);
        } else {
            keyPath = resolve(rootDir, 'serviceAccountKey.json');
        }

        if (keyPath && existsSync(keyPath)) {
            console.log(`Found service account file at ${keyPath}, using it to authenticate...`);
            const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
            initializeApp({
                credential: cert(serviceAccount),
                projectId: 'tng-systems'
            });
        } else {
            console.log('⚠️ No service account JSON found. Trying default credentials...');
            initializeApp({
                projectId: 'tng-systems'
            });
        }
    }

    const sourceDb = getFirestore(); // default db
    const targetDb = getFirestore(undefined, 'tng-systems'); // tng-systems db

    console.log('Reading config/permissions from (default) database...');
    try {
        const docRef = sourceDb.collection('config').doc('permissions');
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            console.log('⚠️ Document config/permissions does NOT exist in (default) database.');
        } else {
            const data = docSnap.data();
            console.log(`Found permissions data! Keys: ${Object.keys(data).join(', ')}`);
            
            console.log('Writing to tng-systems database...');
            await targetDb.collection('config').doc('permissions').set(data);
            console.log('✅ Successfully copied config/permissions to tng-systems database!');
        }

    } catch (e) {
        console.error('❌ Error during copy:', e.message);
    }
}

main().catch(console.error);
