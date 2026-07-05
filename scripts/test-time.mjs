import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import https from 'https';

async function test() {
    try {
        // Fetch real time from Google
        const realTimeMs = await new Promise((resolve) => {
            https.get('https://google.com', (res) => {
                const dateStr = res.headers.date;
                resolve(new Date(dateStr).getTime());
            });
        });
        
        const offset = realTimeMs - Date.now();
        console.log('Time offset:', offset, 'ms');
        
        // Mock Date.now and new Date()
        const OriginalDate = Date;
        global.Date = class extends OriginalDate {
            constructor(...args) {
                if (args.length === 0) {
                    super(OriginalDate.now() + offset);
                } else {
                    super(...args);
                }
            }
            static now() {
                return OriginalDate.now() + offset;
            }
        };

        const serviceAccount = JSON.parse(readFileSync('./tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json', 'utf8'));
        const app = initializeApp({
            credential: cert(serviceAccount),
            projectId: 'tng-systems'
        });
        
        console.log('App initialized.');
        const db = getFirestore(app);
        const snapshot = await db.collection('users').limit(1).get();
        console.log('Access OK. Users count:', snapshot.size);

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
