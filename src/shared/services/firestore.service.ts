import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    QueryConstraint,
    type Unsubscribe,
    type DocumentData,
    type QuerySnapshot,
    type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { firestoreTimestamp } from '../utils/firestore.utils';

/**
 * Generic Firestore CRUD service
 * Provides type-safe methods for all database operations
 */
export class FirestoreService {
    /**
     * Create a new document in a collection with auto-generated ID
     */
    static async createDocument<T extends DocumentData>(
        collectionName: string,
        data: T
    ): Promise<string> {
        try {
            const collectionRef = collection(db, collectionName);
            const docData = {
                ...data,
                createdAt: firestoreTimestamp(),
                updatedAt: firestoreTimestamp(),
            };

            const docRef = await addDoc(collectionRef, docData);
            return docRef.id;
        } catch (error) {
            console.error(`Error creating document in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Create or update a document with a specific ID
     */
    static async setDocument<T extends DocumentData>(
        collectionName: string,
        documentId: string,
        data: T,
        merge: boolean = false
    ): Promise<void> {
        try {
            const docRef = doc(db, collectionName, documentId);
            const docData = {
                ...data,
                createdAt: firestoreTimestamp(),
                updatedAt: firestoreTimestamp(),
            };

            await setDoc(docRef, docData, { merge });
        } catch (error) {
            console.error(`Error setting document ${documentId} in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get a single document by ID
     */
    static async getDocument<T extends DocumentData>(
        collectionName: string,
        documentId: string
    ): Promise<(T & { id: string }) | null> {
        try {
            const docRef = doc(db, collectionName, documentId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as T & { id: string };
            }
            return null;
        } catch (error) {
            console.error(`Error getting document ${documentId} from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get multiple documents with optional query constraints
     */
    static async getDocuments<T extends DocumentData>(
        collectionName: string,
        constraints: QueryConstraint[] = []
    ): Promise<(T & { id: string })[]> {
        try {
            const collectionRef = collection(db, collectionName);
            const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as (T & { id: string })[];
        } catch (error) {
            console.error(`Error getting documents from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Update an existing document
     */
    static async updateDocument<T extends DocumentData>(
        collectionName: string,
        documentId: string,
        data: Partial<T>
    ): Promise<void> {
        try {
            const docRef = doc(db, collectionName, documentId);
            const updateData = {
                ...(data as object),
                updatedAt: firestoreTimestamp(),
            };

            await updateDoc(docRef, updateData);
        } catch (error) {
            console.error(`Error updating document ${documentId} in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Delete a document
     */
    static async deleteDocument(
        collectionName: string,
        documentId: string
    ): Promise<void> {
        try {
            const docRef = doc(db, collectionName, documentId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error(`Error deleting document ${documentId} from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Subscribe to a single document (real-time updates)
     */
    static subscribeToDocument<T extends DocumentData>(
        collectionName: string,
        documentId: string,
        callback: (data: (T & { id: string }) | null) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        const docRef = doc(db, collectionName, documentId);

        return onSnapshot(
            docRef,
            (docSnap: DocumentSnapshot) => {
                if (docSnap.exists()) {
                    callback({ id: docSnap.id, ...docSnap.data() } as T & { id: string });
                } else {
                    callback(null);
                }
            },
            (error) => {
                console.error(`Error subscribing to document ${documentId}:`, error);
                if (onError) onError(error as Error);
            }
        );
    }

    /**
     * Subscribe to a collection (real-time updates)
     */
    static subscribeToCollection<T extends DocumentData>(
        collectionName: string,
        callback: (data: (T & { id: string })[]) => void,
        constraints: QueryConstraint[] = [],
        onError?: (error: Error) => void
    ): Unsubscribe {
        const collectionRef = collection(db, collectionName);
        const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

        return onSnapshot(
            q,
            (querySnapshot: QuerySnapshot) => {
                const documents = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as (T & { id: string })[];
                callback(documents);
            },
            (error) => {
                console.error(`Error subscribing to collection ${collectionName}:`, error);
                if (onError) onError(error as Error);
            }
        );
    }
}

// Re-export query helpers for convenience
export { where, orderBy, limit, query };
