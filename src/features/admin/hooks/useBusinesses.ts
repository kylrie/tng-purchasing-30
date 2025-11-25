import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { Business } from "../../../shared/types";

export const useBusinesses = () => {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);

    const businessesCollection = collection(db, COLLECTIONS.BUSINESSES);

    useEffect(() => {
        const fetchBusinesses = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(businessesCollection);
                const businessesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
                setBusinesses(businessesData);
            } catch (error) {
                console.error("Error fetching businesses: ", error);
            }
            setLoading(false);
        };

        fetchBusinesses();
    }, []);

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