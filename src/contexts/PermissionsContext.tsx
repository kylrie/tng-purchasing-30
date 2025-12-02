import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROLES_TO_PERMISSIONS } from '../config/permissions';
import type { Permission } from '../config/permissions';
import { UserRole } from '../features/procurement/types';

interface PermissionsContextType {
    permissions: Record<UserRole, Permission[]>;
    roles: UserRole[];
    updatePermissions: (newPermissions: Record<UserRole, Permission[]>) => Promise<void>;
    updateRoles: (newRoles: UserRole[]) => Promise<void>;
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
    const [roles, setRoles] = useState<UserRole[]>(Object.values(UserRole));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const docRef = doc(db, 'config', 'permissions');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.permissions) {
                        setPermissions({ ...ROLES_TO_PERMISSIONS, ...data.permissions });
                    }
                    if (data.roles && Array.isArray(data.roles)) {
                        // Ensure we have unique roles merging defaults + custom
                        const uniqueRoles = Array.from(new Set([...Object.values(UserRole), ...data.roles]));
                        setRoles(uniqueRoles as UserRole[]);
                    }
                } else {
                    // Initialize with defaults
                    await setDoc(docRef, { 
                        permissions: ROLES_TO_PERMISSIONS, 
                        roles: Object.values(UserRole) 
                    });
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
            // We only update the 'permissions' field
            await setDoc(docRef, { permissions: newPermissions }, { merge: true });
            setPermissions(newPermissions);
        } catch (err: any) {
            console.error('Error saving permissions:', err);
            throw err;
        }
    };

    const updateRoles = async (newRoles: UserRole[]) => {
        try {
            const docRef = doc(db, 'config', 'permissions');
            // We only update the 'roles' field
            await setDoc(docRef, { roles: newRoles }, { merge: true });
            setRoles(newRoles);
        } catch (err: any) {
            console.error('Error saving roles:', err);
            throw err;
        }
    };

    return (
        <PermissionsContext.Provider value={{ permissions, roles, updatePermissions, updateRoles, loading, error }}>
            {children}
        </PermissionsContext.Provider>
    );
};
