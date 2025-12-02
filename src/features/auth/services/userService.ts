import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    where
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { User } from "../../procurement/types";

const USERS_COLLECTION = "users";

export const fetchUsers = async (businessId?: string): Promise<User[]> => {
    try {
        const usersRef = collection(db, USERS_COLLECTION);
        let q;

        if (businessId) {
            q = query(usersRef, where("businessId", "==", businessId));
        } else {
            q = query(usersRef);
        }

        const querySnapshot = await getDocs(q);
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as User);
        });
        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
};

export const fetchUserByEmail = async (email: string): Promise<User | null> => {
    try {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() } as User;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user by email:", error);
        return null;
    }
};

export const saveUser = async (user: User) => {
    try {
        await setDoc(doc(db, USERS_COLLECTION, user.id), user, { merge: true });
        return true;
    } catch (e) {
        console.error("Error saving user: ", e);
        return false;
    }
};
