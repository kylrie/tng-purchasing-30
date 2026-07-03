import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
// deleteDoc removed - user deletion handled via Firebase Console
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
                const usersData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...updateData } = userData as any;
            const userDoc = doc(db, COLLECTIONS.USERS, userData.id);
            await updateDoc(userDoc, updateData);
            setUsers(prev => prev.map(u => u.id === userData.id ? userData : u));
        } catch (error) {
            console.error("Error updating user: ", error);
            throw error;
        }
    };

    // deleteUser function removed - user deletion handled via Firebase Console
    // If needed in the future, implement soft-delete (status: 'ARCHIVED') instead of deleteDoc

    return { users, setUsers, loading, updateUser };
};
