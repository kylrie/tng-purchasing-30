import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
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
            // IMPORTANT: spread doc.data() FIRST, then override id with doc.id
            // This prevents stale 'id' fields in document data from overwriting the real Firestore document ID
            const bizData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Business));
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
            // Strip any stale 'id' field before adding
// eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _stripId, ...cleanData } = businessData as any;
            await addDoc(businessesCollection, cleanData);
        } catch (error) {
            console.error("Error adding business: ", error);
            throw new Error("Failed to add business unit.");
        }
    };

    const updateBusiness = async (id: string, updates: Partial<Business>) => {
        try {
            // Strip the 'id' field from updates — it should only be used as the document reference, not stored as data
// eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _stripId, ...cleanUpdates } = updates as any;
            const bizRef = doc(db, COLLECTIONS.BUSINESSES, id);
            await updateDoc(bizRef, cleanUpdates);
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
