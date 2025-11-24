import {
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    type User as FirebaseUser,
    type NextOrObserver,
    type UserCredential,
} from 'firebase/auth';
import { auth, googleProvider } from '../../config/firebase';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { FirestoreUser } from '../types/firebase.types';
import type { UserRole } from '../../features/auth/types';

/**
 * Authentication Service
 * Handles all Firebase Auth operations
 */
export class AuthService {
    /**
     * Sign in with email and password
     */
    static async signInWithEmail(
        email: string,
        password: string
    ): Promise<UserCredential> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential;
        } catch (error) {
            console.error('Error signing in with email:', error);
            throw error;
        }
    }

    /**
     * Sign in with Google OAuth
     */
    static async signInWithGoogle(): Promise<UserCredential> {
        try {
            const userCredential = await signInWithPopup(auth, googleProvider);
            return userCredential;
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    }

    /**
     * Sign out current user
     */
    static async signOut(): Promise<void> {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    }

    /**
     * Get current authenticated user
     */
    static getCurrentUser(): FirebaseUser | null {
        return auth.currentUser;
    }

    /**
     * Listen to authentication state changes
     */
    static onAuthStateChanged(callback: NextOrObserver<FirebaseUser>): () => void {
        return onAuthStateChanged(auth, callback);
    }

    /**
     * Create a new user account
     * This creates both the Firebase Auth user and the Firestore user document
     */
    static async createUser(
        email: string,
        password: string,
        userData: {
            name: string;
            role: UserRole;
            businessId: string;
            avatar?: string;
        }
    ): Promise<UserCredential> {
        try {
            // Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Create Firestore user document
            await FirestoreService.setDocument<FirestoreUser>(
                COLLECTIONS.USERS,
                userCredential.user.uid,
                {
                    email,
                    name: userData.name,
                    role: userData.role,
                    businessId: userData.businessId,
                    avatar: userData.avatar || '',
                }
            );

            return userCredential;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    /**
     * Get user profile from Firestore
     */
    static async getUserProfile(uid: string): Promise<FirestoreUser | null> {
        try {
            return await FirestoreService.getDocument<FirestoreUser>(
                COLLECTIONS.USERS,
                uid
            );
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * Update user profile in Firestore
     */
    static async updateUserProfile(
        uid: string,
        data: Partial<Omit<FirestoreUser, 'id' | 'email' | 'createdAt' | 'updatedAt'>>
    ): Promise<void> {
        try {
            await FirestoreService.updateDocument<FirestoreUser>(
                COLLECTIONS.USERS,
                uid,
                data
            );
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }
}
