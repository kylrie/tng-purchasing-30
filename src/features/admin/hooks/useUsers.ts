import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { COLLECTIONS } from "../../../shared/types/firebase.types";
import type { User } from "../../../shared/types";

export const useUsers = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const usersCollection = collection(db, COLLECTIONS.USERS);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(usersCollection);
                const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching users: ", error);
            }
            setLoading(false);
        };

        fetchUsers();
    }, []);

    const updateUser = async (userData: User) => {
        try {
            const userDoc = doc(db, COLLECTIONS.USERS, userData.id);
            await updateDoc(userDoc, { ...userData });
            setUsers(prev => prev.map(u => u.id === userData.id ? userData : u));
        } catch (error) {
            console.error("Error updating user: ", error);
            throw error;
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            const userDoc = doc(db, COLLECTIONS.USERS, userId);
            await deleteDoc(userDoc);
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error) {
            console.error("Error deleting user: ", error);
            throw error;
        }
    };

    return { users, setUsers, loading, updateUser, deleteUser };
};
