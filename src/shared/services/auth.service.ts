import {
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    type User as FirebaseUser,
    type NextOrObserver,
    type UserCredential,
    getAuth,
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, googleProvider, firebaseConfig } from '../../config/firebase';
import { FirestoreService, Timestamp } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { FirestoreUser } from '../types/firebase.types';
import type { UserRole, UserStatus } from '../../features/procurement/types';
import { generateEmployeeId } from '../utils/employeeId';

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
        let secondaryApp;
        try {
            // Initialize a secondary app to avoid signing out the current user
            secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);

            // Create Firebase Auth user using the secondary app
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

            // Generate human-readable employee ID from name
            const employeeId = await generateEmployeeId(userData.name);

            const newDoc = {
                email,
                name: userData.name,
                employeeId, // Add human-readable ID
                role: userData.role,
                businessId: userData.businessId,
                avatar: userData.avatar || '',
                status: 'active' as UserStatus,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            // Create Firestore user document using the MAIN app (authenticated as Admin)
            await FirestoreService.setDocument<FirestoreUser>(
                COLLECTIONS.USERS,
                userCredential.user.uid,
                newDoc as FirestoreUser
            );

            // Sign out the new user from the secondary app to clean up
            await firebaseSignOut(secondaryAuth);

            return userCredential;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        } finally {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
            }
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
        data: Partial<Omit<FirestoreUser, 'id' | 'email' | 'createdAt'>>
    ): Promise<void> {
        try {
            await FirestoreService.updateDocument<FirestoreUser>(
                COLLECTIONS.USERS,
                uid,
                { ...data, updatedAt: Timestamp.now() }
            );
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }
}
