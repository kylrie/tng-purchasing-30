import { useState } from 'react';
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { Business } from "../../../shared/types";
import { initialBusinesses } from '../../../config/mockData';

export const useBusinesses = () => {
    const [businesses, setBusinesses] = useState<Business[]>(initialBusinesses);
    const loading = false;

    const businessesCollection = collection(db, COLLECTIONS.BUSINESSES);

    const addBusiness = async (businessData: Omit<Business, 'id'>) => {
        try {
            const docRef = await addDoc(businessesCollection, businessData);
            setBusinesses(prev => [...prev, { id: docRef.id, ...businessData }]);
        } catch (error) {
            console.error("Error adding business: ", error);
        }
    };

    return { businesses, loading, addBusiness };
};
