
import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { Requisition } from "../types";

export const useRequisitions = () => {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const requisitionsCollection = collection(db, COLLECTIONS.REQUISITIONS);

    useEffect(() => {
        setLoading(true);
        // Set up real-time listener
        const unsubscribe = onSnapshot(requisitionsCollection, (snapshot) => {
            const requisitionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Requisition));
            // Sort by ID descending (newest first)
            requisitionsData.sort((a, b) => {
                if (a.id > b.id) return -1;
                if (a.id < b.id) return 1;
                return 0;
            });
            setRequisitions(requisitionsData);
            setLoading(false);
        }, (err) => {
            console.error("Error listening to requisitions: ", err);
            setError(err.message);
            setLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []); // Empty dependency array means this runs once on mount

    const createRequisition = async (requisitionData: Omit<Requisition, 'id'> | Requisition) => {
        try {
            let newId = '';

            // Check if an ID was already provided (e.g., from CounterService for PRF)
            const providedId = 'id' in requisitionData ? requisitionData.id : null;

            if (providedId) {
                // Use the provided ID (e.g., PRF-0001 from CounterService)
                newId = providedId;
                const newReqRef = doc(db, COLLECTIONS.REQUISITIONS, newId);
                await runTransaction(db, async (transaction) => {
                    transaction.set(newReqRef, { ...requisitionData, id: newId });
                });
            } else {
                // Generate a BURF ID using the counter
                await runTransaction(db, async (transaction) => {
                    const counterRef = doc(db, 'counters', 'requisitions');
                    const counterDoc = await transaction.get(counterRef);

                    let nextCount = 1;
                    if (counterDoc.exists()) {
                        nextCount = (counterDoc.data().count || 0) + 1;
                    }

                    const paddedCount = nextCount.toString().padStart(4, '0');
                    newId = `BURF-${paddedCount}`;

                    transaction.set(counterRef, { count: nextCount }, { merge: true });

                    const newReqRef = doc(db, COLLECTIONS.REQUISITIONS, newId);
                    // Ensure the data includes the ID
                    transaction.set(newReqRef, { ...requisitionData, id: newId });
                });
            }
            // No need to update local state manually, onSnapshot will handle it

        } catch (err: any) {
            console.error("Error creating requisition: ", err);
            setError(err.message);
            alert("Failed to create requisition. Please try again.");
        }
    };

    const updateRequisition = async (requisitionData: Requisition) => {
        try {
            const requisitionDoc = doc(db, COLLECTIONS.REQUISITIONS, requisitionData.id);
            await updateDoc(requisitionDoc, { ...requisitionData });
            // No need to update local state manually, onSnapshot will handle it
        } catch (err: any) {
            console.error("Error updating requisition: ", err);
            setError(err.message);
        }
    };

    return { requisitions, loading, error, createRequisition, updateRequisition };
};
