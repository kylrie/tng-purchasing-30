import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROLES_TO_PERMISSIONS } from '../config/permissions';
import type { Permission } from '../config/permissions';
import { UserRole } from '../features/procurement/types';

interface PermissionsContextType {
    permissions: Record<UserRole, Permission[]>;
    updatePermissions: (newPermissions: Record<UserRole, Permission[]>) => Promise<void>;
    loading: boolean;
    error: string | null;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const usePermissionsContext = () => {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissionsContext must be used within a PermissionsProvider');
    }
    return context;
};

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [permissions, setPermissions] = useState<Record<UserRole, Permission[]>>(ROLES_TO_PERMISSIONS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const docRef = doc(db, 'config', 'permissions');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.roles) {
                        // Merge with default permissions to ensure all roles exist
                        setPermissions({ ...ROLES_TO_PERMISSIONS, ...data.roles });
                    }
                } else {
                    // If no config exists, save the defaults
                    await setDoc(docRef, { roles: ROLES_TO_PERMISSIONS });
                }
            } catch (err: any) {
                console.error('Error fetching permissions:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, []);

    const updatePermissions = async (newPermissions: Record<UserRole, Permission[]>) => {
        try {
            const docRef = doc(db, 'config', 'permissions');
            await setDoc(docRef, { roles: newPermissions }, { merge: true });
            setPermissions(newPermissions);
        } catch (err: any) {
            console.error('Error saving permissions:', err);
            throw err;
        }
    };

    return (
        <PermissionsContext.Provider value={{ permissions, updatePermissions, loading, error }}>
            {children}
        </PermissionsContext.Provider>
    );
};
