
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { Requisition } from "../types";

export const useRequisitions = () => {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const requisitionsCollection = collection(db, COLLECTIONS.REQUISITIONS);

    const fetchRequisitions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const querySnapshot = await getDocs(requisitionsCollection);
            const requisitionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Requisition));
            // Sort by ID descending (newest first)
            requisitionsData.sort((a, b) => {
                // primitive sort for BURF-XXXX
                if (a.id > b.id) return -1;
                if (a.id < b.id) return 1;
                return 0;
            });
            setRequisitions(requisitionsData);
        } catch (err: any) {
            console.error("Error fetching requisitions: ", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequisitions();
    }, [fetchRequisitions]);

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

            // Update local state locally to avoid refetch
            if (newId) {
                setRequisitions(prev => [{ id: newId, ...requisitionData } as Requisition, ...prev]);
            }

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
            setRequisitions(prev => prev.map(r => r.id === requisitionData.id ? requisitionData : r));
        } catch (err: any) {
            console.error("Error updating requisition: ", err);
            setError(err.message);
        }
    };

    return { requisitions, loading, error, createRequisition, updateRequisition, refreshRequisitions: fetchRequisitions };
};
