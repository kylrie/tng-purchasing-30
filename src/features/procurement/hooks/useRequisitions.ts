
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { Requisition } from "../types";

export const useRequisitions = () => {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);

    const requisitionsCollection = collection(db, COLLECTIONS.REQUISITIONS);

    useEffect(() => {
        const fetchRequisitions = async () => {
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
            } catch (error) {
                console.error("Error fetching requisitions: ", error);
            }
            setLoading(false);
        };

        fetchRequisitions();
    }, []);

    const createRequisition = async (requisitionData: Omit<Requisition, 'id'>) => {
        try {
            let newId = '';
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

            // Update local state locally to avoid refetch
            if (newId) {
                setRequisitions(prev => [{ id: newId, ...requisitionData } as Requisition, ...prev]);
            }

        } catch (error) {
            console.error("Error creating requisition: ", error);
            alert("Failed to create requisition. Please try again.");
        }
    };

    const updateRequisition = async (requisitionData: Requisition) => {
        try {
            const requisitionDoc = doc(db, COLLECTIONS.REQUISITIONS, requisitionData.id);
            await updateDoc(requisitionDoc, { ...requisitionData });
            setRequisitions(prev => prev.map(r => r.id === requisitionData.id ? requisitionData : r));
        } catch (error) {
            console.error("Error updating requisition: ", error);
        }
    };

    return { requisitions, loading, createRequisition, updateRequisition };
};
