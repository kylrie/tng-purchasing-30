import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROLES_TO_PERMISSIONS } from '../config/permissions';
import type { Permission } from '../config/permissions';
import { SystemRole, DEFAULT_BUSINESS_ROLES } from '../features/procurement/types';

// Default roles: System roles + default business roles
const DEFAULT_ROLES: string[] = [
    ...Object.values(SystemRole),
    ...DEFAULT_BUSINESS_ROLES
];

interface PermissionsContextType {
    permissions: Record<string, Permission[]>;
    roles: string[]; // Changed to string[] for dynamic roles
    updatePermissions: (newPermissions: Record<string, Permission[]>) => Promise<void>;
    updateRoles: (newRoles: string[]) => Promise<void>;
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
    const [permissions, setPermissions] = useState<Record<string, Permission[]>>(ROLES_TO_PERMISSIONS);
    const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
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
                        // FIX: Firestore permissions are authoritative - don't merge with defaults
                        // This ensures unchecked permissions stay unchecked after refresh
                        const savedPermissions: Record<string, Permission[]> = {};

                        // Load permissions exactly as saved in Firestore
                        for (const [role, perms] of Object.entries(data.permissions)) {
                            const permsList = perms as Permission[];
                            // If Firestore has empty array but we have defaults, use defaults
                            // This fixes the issue where custom roles (like FINANCE_HEAD) were created 
                            // with empty permissions and the user couldn't save via UI
                            if (permsList.length === 0 && ROLES_TO_PERMISSIONS[role as keyof typeof ROLES_TO_PERMISSIONS]) {
                                savedPermissions[role] = ROLES_TO_PERMISSIONS[role as keyof typeof ROLES_TO_PERMISSIONS];
                            } else {
                                savedPermissions[role] = permsList;
                            }
                        }

                        // Add any roles from defaults that don't exist in Firestore yet
                        // (but DON'T merge their permissions - just add empty array if missing)
                        for (const role of Object.keys(ROLES_TO_PERMISSIONS)) {
                            if (!savedPermissions[role]) {
                                savedPermissions[role] = ROLES_TO_PERMISSIONS[role as keyof typeof ROLES_TO_PERMISSIONS];
                            }
                        }

                        setPermissions(savedPermissions);
                    }
                    if (data.roles && Array.isArray(data.roles)) {
                        // Ensure we have unique roles: defaults + Firestore roles
                        const uniqueRoles = Array.from(new Set([...DEFAULT_ROLES, ...data.roles]));
                        setRoles(uniqueRoles);
                    }
                } else {
                    // Initialize Firestore with defaults
                    await setDoc(docRef, {
                        permissions: ROLES_TO_PERMISSIONS,
                        roles: DEFAULT_ROLES
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

    const updatePermissions = async (newPermissions: Record<string, Permission[]>) => {
        // Store previous state for rollback on error
        const previousPermissions = permissions;

        try {
            // Optimistic update - set local state immediately for responsive UI
            setPermissions(newPermissions);

            const docRef = doc(db, 'config', 'permissions');

            // Save directly - the UI passes the complete final state
            // No need to merge with existing data since the matrix represents final state
            await setDoc(docRef, { permissions: newPermissions }, { merge: true });
        } catch (err: any) {
            console.error('Error saving permissions:', err);
            // Rollback on error - restore previous state
            setPermissions(previousPermissions);
            throw err;
        }
    };

    const updateRoles = async (newRoles: string[]) => {
        // Store previous state for rollback on error
        const previousRoles = roles;

        try {
            // Optimistic update - set local state immediately
            setRoles(newRoles);

            const docRef = doc(db, 'config', 'permissions');
            await setDoc(docRef, { roles: newRoles }, { merge: true });
        } catch (err: any) {
            console.error('Error saving roles:', err);
            // Rollback on error - restore previous state
            setRoles(previousRoles);
            throw err;
        }
    };

    return (
        <PermissionsContext.Provider value={{ permissions, roles, updatePermissions, updateRoles, loading, error }}>
            {children}
        </PermissionsContext.Provider>
    );
};
