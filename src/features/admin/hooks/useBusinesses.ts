import { useState, useEffect } from 'react';
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { Business } from "../../../shared/types";

export const useBusinesses = () => {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);

    const businessesCollection = collection(db, COLLECTIONS.BUSINESSES);

    useEffect(() => {
        // setLoading(true); // Removed to avoid setState in effect, initial state is true
        const unsubscribe = onSnapshot(businessesCollection, (snapshot) => {
            const bizData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
            setBusinesses(bizData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching businesses: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const addBusiness = async (businessData: Omit<Business, 'id'>) => {
        try {
            await addDoc(businessesCollection, businessData);
        } catch (error) {
            console.error("Error adding business: ", error);
            throw new Error("Failed to add business unit.");
        }
    };

    const updateBusiness = async (id: string, updates: Partial<Business>) => {
        try {
            const bizRef = doc(db, COLLECTIONS.BUSINESSES, id);
            await setDoc(bizRef, updates, { merge: true });
        } catch (error) {
            console.error("Error updating business: ", error);
            throw new Error("Failed to update business unit.");
        }
    };

    const deleteBusiness = async (id: string) => {
        try {
            const bizRef = doc(db, COLLECTIONS.BUSINESSES, id);
            await deleteDoc(bizRef);
        } catch (error) {
            console.error("Error deleting business: ", error);
            throw new Error("Failed to delete business unit.");
        }
    };

    return { businesses, loading, addBusiness, updateBusiness, deleteBusiness };
};
