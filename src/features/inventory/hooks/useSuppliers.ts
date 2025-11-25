
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
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
                const querySnapshot = await getDocs(suppliersCollection);
                const suppliersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
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
            const docRef = await addDoc(suppliersCollection, supplierData);
            setSuppliers(prev => [...prev, { id: docRef.id, ...supplierData }]);
        } catch (error) {
            console.error("Error creating supplier: ", error);
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
            const supplierDoc = doc(db, COLLECTIONS.SUPPLIERS, id);
            await deleteDoc(supplierDoc);
            setSuppliers(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error("Error deleting supplier: ", error);
        }
    };

    return { suppliers, loading, createSupplier, updateSupplier, deleteSupplier };
};
