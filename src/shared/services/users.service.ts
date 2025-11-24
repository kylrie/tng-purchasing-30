import { FirestoreService, where } from './firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import type { FirestoreUser } from '../types/firebase.types';
import type { UserRole } from '../../features/auth/types';

/**
 * User Management Service
 * Handles user-related operations in Firestore
 */
export class UsersService {
    /**
     * Create a new user profile in Firestore
     * This is typically called after Firebase Auth user creation
     */
    static async createUserProfile(
        uid: string,
        userData: {
            email: string;
            name: string;
            role: UserRole;
            businessId: string;
            avatar?: string;
        }
    ): Promise<void> {
        await FirestoreService.setDocument<FirestoreUser>(
            COLLECTIONS.USERS,
            uid,
            userData
        );
    }

    /**
     * Get a user profile by UID
     */
    static async getUserProfile(uid: string): Promise<FirestoreUser | null> {
        return await FirestoreService.getDocument<FirestoreUser>(
            COLLECTIONS.USERS,
            uid
        );
    }

    /**
     * Update a user profile
     */
    static async updateUserProfile(
        uid: string,
        data: Partial<Omit<FirestoreUser, 'id' | 'email' | 'createdAt' | 'updatedAt'>>
    ): Promise<void> {
        await FirestoreService.updateDocument<FirestoreUser>(
            COLLECTIONS.USERS,
            uid,
            data
        );
    }

    /**
     * Get all users in a specific business
     */
    static async getUsersByBusiness(businessId: string): Promise<FirestoreUser[]> {
        return await FirestoreService.getDocuments<FirestoreUser>(
            COLLECTIONS.USERS,
            [where('businessId', '==', businessId)]
        );
    }

    /**
     * Get all users
     * Note: This should be restricted to SUPER_ADMIN role in production
     */
    static async getAllUsers(): Promise<FirestoreUser[]> {
        return await FirestoreService.getDocuments<FirestoreUser>(
            COLLECTIONS.USERS
        );
    }

    /**
     * Delete a user profile
     * Note: This does NOT delete the Firebase Auth user, only the Firestore document
     */
    static async deleteUserProfile(uid: string): Promise<void> {
        await FirestoreService.deleteDocument(COLLECTIONS.USERS, uid);
    }
}
