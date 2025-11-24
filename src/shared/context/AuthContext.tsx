import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../services/users.service';
import type { User } from '../types';

interface AuthContextType {
    currentUser: User | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Listen to Firebase Auth state changes
    useEffect(() => {
        const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
            setFirebaseUser(user);

            if (user) {
                try {
                    // Fetch user profile from Firestore
                    const userProfile = await UsersService.getUserProfile(user.uid);

                    if (userProfile) {
                        setCurrentUser({
                            id: userProfile.id,
                            email: userProfile.email,
                            name: userProfile.name,
                            role: userProfile.role,
                            businessId: userProfile.businessId,
                            avatar: userProfile.avatar || '',
                        });
                    } else {
                        setError('User profile not found');
                        setCurrentUser(null);
                    }
                } catch (err) {
                    console.error('Error fetching user profile:', err);
                    setError('Failed to load user profile');
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            setError(null);
            setLoading(true);
            await AuthService.signInWithEmail(email, password);
            // The onAuthStateChanged listener will handle setting the user
        } catch (err: any) {
            console.error('Sign in error:', err);
            setError(err.message || 'Failed to sign in');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        try {
            setError(null);
            setLoading(true);
            await AuthService.signInWithGoogle();
            // The onAuthStateChanged listener will handle setting the user
        } catch (err: any) {
            console.error('Google sign in error:', err);
            setError(err.message || 'Failed to sign in with Google');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setError(null);
            await AuthService.signOut();
            setCurrentUser(null);
            setFirebaseUser(null);
        } catch (err: any) {
            console.error('Sign out error:', err);
            setError(err.message || 'Failed to sign out');
            throw err;
        }
    };

    const value: AuthContextType = {
        currentUser,
        firebaseUser,
        loading,
        error,
        signIn,
        signInWithGoogle,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
