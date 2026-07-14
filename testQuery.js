import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "tng-systems"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Querying...");
    const q = query(collection(db, 'users'), where('role', '==', 'CHEF'));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        console.log(doc.id, JSON.stringify(doc.data(), null, 2));
    });
}
run();
