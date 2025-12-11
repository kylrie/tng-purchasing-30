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
                            savedPermissions[role] = perms as Permission[];
                        }

                        // Add any roles from defaults that don't exist in Firestore yet
                        // (but DON'T merge their permissions - just add empty array if missing)
                        for (const role of Object.keys(ROLES_TO_PERMISSIONS)) {
                            if (!savedPermissions[role]) {
                                savedPermissions[role] = ROLES_TO_PERMISSIONS[role];
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
        try {
            const docRef = doc(db, 'config', 'permissions');

            // First, read current data from Firestore to preserve any roles not in local state
            const currentDoc = await getDoc(docRef);
            let mergedPermissions = { ...newPermissions };

            if (currentDoc.exists()) {
                const currentData = currentDoc.data();
                if (currentData.permissions) {
                    // Preserve roles from Firestore that aren't in the new permissions
                    for (const [role, perms] of Object.entries(currentData.permissions)) {
                        if (!(role in mergedPermissions)) {
                            mergedPermissions[role] = perms as Permission[];
                        }
                    }
                }
            }

            await setDoc(docRef, { permissions: mergedPermissions }, { merge: true });
            setPermissions(mergedPermissions);
        } catch (err: any) {
            console.error('Error saving permissions:', err);
            throw err;
        }
    };

    const updateRoles = async (newRoles: string[]) => {
        try {
            const docRef = doc(db, 'config', 'permissions');
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
