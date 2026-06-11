import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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
    /**
     * Atomically saves both permissions and roles in a single Firestore write.
     * This prevents race conditions where two separate writes (updatePermissions + updateRoles)
     * could cause the roles array to be overwritten by a stale copy from another admin's session.
     *
     * IMPORTANT: This reads the latest server state first and merges custom roles/permissions
     * that may have been added by other admins, so nothing gets silently dropped.
     */
    savePermissionsAndRoles: (
        newPermissions: Record<string, Permission[]>,
        newRoles: string[]
    ) => Promise<void>;
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

    // Track whether the document has been initialized from Firestore at least once.
    // This prevents the fallback "initialize if missing" block from firing on transient
    // snapshot states (e.g. cache miss before server round-trip).
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Subscribe to the permissions document for real-time updates
        const unsub = onSnapshot(doc(db, 'config', 'permissions'), (docSnap) => {
            try {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    hasInitialized.current = true;

                    if (data.permissions) {
                        const savedPermissions: Record<string, Permission[]> = {};
                        for (const [role, perms] of Object.entries(data.permissions)) {
                            savedPermissions[role] = perms as Permission[];
                        }
                        setPermissions(savedPermissions);
                    }
                    if (data.roles && Array.isArray(data.roles)) {
                        // Merge DEFAULT_ROLES to guarantee system roles are always present,
                        // but preserve every custom role from Firestore as-is.
                        const uniqueRoles = Array.from(new Set([...DEFAULT_ROLES, ...data.roles]));
                        setRoles(uniqueRoles);
                    }
                } else if (!hasInitialized.current) {
                    // Only initialize the document if it truly doesn't exist and we've
                    // never seen it before. This prevents accidental overwrites if the
                    // snapshot temporarily reports !exists() due to cache/network issues.
                    hasInitialized.current = true;
                    setDoc(doc(db, 'config', 'permissions'), {
                        permissions: ROLES_TO_PERMISSIONS,
                        roles: DEFAULT_ROLES
                    }).catch(console.error);
                }
                setLoading(false);
            } catch (err: any) {
                console.error('Error processing permissions update:', err);
                setError(err.message);
                setLoading(false);
            }
        }, (err: Error) => {
            console.error('Error subscribing to permissions:', err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    // ------------------------------------------------------------------
    // Legacy single-field updaters (kept for backward compatibility)
    // Prefer savePermissionsAndRoles() for PermissionsMatrix saves.
    // ------------------------------------------------------------------

    const updatePermissions = useCallback(async (newPermissions: Record<string, Permission[]>) => {
        const previousPermissions = permissions;
        try {
            setPermissions(newPermissions);
            const docRef = doc(db, 'config', 'permissions');
            await setDoc(docRef, { permissions: newPermissions }, { merge: true });
        } catch (err: any) {
            console.error('Error saving permissions:', err);
            setPermissions(previousPermissions);
            throw err;
        }
    }, [permissions]);

    const updateRoles = useCallback(async (newRoles: string[]) => {
        const previousRoles = roles;
        try {
            setRoles(newRoles);
            const docRef = doc(db, 'config', 'permissions');
            await setDoc(docRef, { roles: newRoles }, { merge: true });
        } catch (err: any) {
            console.error('Error saving roles:', err);
            setRoles(previousRoles);
            throw err;
        }
    }, [roles]);

    // ------------------------------------------------------------------
    // Atomic save: reads latest server state, merges, writes once.
    // This is the PRIMARY save path used by PermissionsMatrix.
    // ------------------------------------------------------------------

    const savePermissionsAndRoles = useCallback(async (
        newPermissions: Record<string, Permission[]>,
        newRoles: string[],
        deletedRoles?: string[]
    ) => {
        const previousPermissions = permissions;
        const previousRoles = roles;

        try {
            // Optimistic local update for responsive UI
            setPermissions(newPermissions);
            setRoles(newRoles);

            const docRef = doc(db, 'config', 'permissions');

            // Read the latest server state to detect roles/permissions added by
            // other admins that our local (possibly stale) state doesn't know about.
            const serverSnap = await getDoc(docRef);
            const serverData = serverSnap.exists() ? serverSnap.data() : null;

            // --- Merge roles ---
            // Start with what the current admin intends to save, then union in any
            // roles that exist on the server but are NOT in the admin's local set.
            // This ensures that if Admin B doesn't know about Admin A's "HR" role,
            // Admin B's save won't delete it.
            const serverRoles: string[] = serverData?.roles ?? [];
            const mergedRoles = Array.from(new Set([
                ...DEFAULT_ROLES,
                ...newRoles,
                ...serverRoles.filter(r => !(deletedRoles || []).includes(r)),
            ]));

            // --- Merge permissions ---
            // For roles that the current admin explicitly manages (newRoles), use
            // the admin's version (they toggled checkboxes intentionally).
            // For roles that exist ONLY on the server (i.e. added by another admin),
            // preserve their server-side permissions unchanged.
            const serverPermissions: Record<string, Permission[]> = serverData?.permissions ?? {};
            const mergedPermissions: Record<string, Permission[]> = { ...newPermissions };

            for (const serverRole of Object.keys(serverPermissions)) {
                if (!(serverRole in mergedPermissions) && !(deletedRoles || []).includes(serverRole)) {
                    // This role exists on the server but the current admin didn't have it, and it was NOT explicitly deleted.
                    // Preserve it exactly as-is.
                    mergedPermissions[serverRole] = serverPermissions[serverRole];
                }
            }

            // Single atomic write — both roles and permissions in one setDoc call
            await setDoc(docRef, {
                roles: mergedRoles,
                permissions: mergedPermissions,
            }, { merge: true });

            // The onSnapshot listener will update local state with the merged result,
            // so no need to manually setPermissions/setRoles again here.
        } catch (err: any) {
            console.error('Error saving permissions and roles:', err);
            // Rollback on error
            setPermissions(previousPermissions);
            setRoles(previousRoles);
            throw err;
        }
    }, [permissions, roles]);

    return (
        <PermissionsContext.Provider value={{
            permissions,
            roles,
            updatePermissions,
            updateRoles,
            savePermissionsAndRoles,
            loading,
            error
        }}>
            {children}
        </PermissionsContext.Provider>
    );
};
