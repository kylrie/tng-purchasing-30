import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import type { Business } from "../types";

const BUSINESS_COLLECTION = "businesses";

export const fetchBusinesses = async (): Promise<Business[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, BUSINESS_COLLECTION));
        const businesses: Business[] = [];
        querySnapshot.forEach((doc) => {
            businesses.push({ ...doc.data(), id: doc.id } as Business);
        });
        return businesses;
    } catch (error) {
        console.error("Error fetching businesses:", error);
        return [];
    }
};

export const saveBusiness = async (business: Business) => {
    try {
        await setDoc(doc(db, BUSINESS_COLLECTION, business.id), business, { merge: true });
        return true;
    } catch (e) {
        console.error("Error saving business: ", e);
        return false;
    }
};
