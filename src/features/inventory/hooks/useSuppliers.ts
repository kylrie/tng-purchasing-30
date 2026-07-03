import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { Supplier } from "../../procurement/types";

export const useSuppliers = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    const suppliersCollection = collection(db, COLLECTIONS.SUPPLIERS);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                // Fetch ALL suppliers first, then filter client-side
                // This handles legacy data without a 'status' field
                const querySnapshot = await getDocs(suppliersCollection);
                const suppliersData = querySnapshot.docs
                    .map(doc => ({ ...doc.data(), id: doc.id } as Supplier))
                    // Filter out archived suppliers (keep those without status field = legacy/active)
                    .filter(s => s.status !== 'ARCHIVED');
                setSuppliers(suppliersData);
            } catch (error) {
                console.error("Error fetching suppliers: ", error);
            }
            setLoading(false);
        };

        fetchSuppliers();
    }, []);

    const createSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
        try {
            // Task 1: Prevent Duplicates
            // Use simple single-field queries to avoid composite index requirements
            // Then filter client-side for non-archived suppliers

            // Check for existing name (simple query, filter client-side)
            const nameQuery = query(suppliersCollection, where('name', '==', supplierData.name));
            const nameSnapshot = await getDocs(nameQuery);
            const activeNameMatch = nameSnapshot.docs.find(doc => {
                const data = doc.data();
                return data.status !== 'ARCHIVED';
            });
            if (activeNameMatch) {
                throw new Error("Supplier with this Name already exists.");
            }

            // Check for existing TIN if provided
            if (supplierData.tin) {
                const tinQuery = query(suppliersCollection, where('tin', '==', supplierData.tin));
                const tinSnapshot = await getDocs(tinQuery);
                const activeTinMatch = tinSnapshot.docs.find(doc => {
                    const data = doc.data();
                    return data.status !== 'ARCHIVED';
                });
                if (activeTinMatch) {
                    throw new Error("Supplier with this TIN already exists.");
                }
            }

            const docRef = await addDoc(suppliersCollection, { ...supplierData, status: 'ACTIVE' });
            setSuppliers(prev => [...prev, { id: docRef.id, ...supplierData, status: 'ACTIVE' }]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error creating supplier: ", error);
            throw error; // Re-throw to let component handle it
        }
    };

    const updateSupplier = async (supplierData: Supplier) => {
        try {
            const supplierDoc = doc(db, COLLECTIONS.SUPPLIERS, supplierData.id);
            await updateDoc(supplierDoc, { ...supplierData });
            setSuppliers(prev => prev.map(s => s.id === supplierData.id ? supplierData : s));
        } catch (error) {
            console.error("Error updating supplier: ", error);
        }
    };

    const deleteSupplier = async (id: string) => {
        try {
            // Task 2: Implement Soft Delete
            const supplierDoc = doc(db, COLLECTIONS.SUPPLIERS, id);
            await updateDoc(supplierDoc, { status: 'ARCHIVED' });
            // Update local state to remove it from UI
            setSuppliers(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error("Error deleting supplier: ", error);
        }
    };

    return { suppliers, loading, createSupplier, updateSupplier, deleteSupplier };
};
