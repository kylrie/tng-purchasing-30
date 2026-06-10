/**
 * Migration Script: Seed Business Roles into Firestore
 * 
 * This script migrates the old hardcoded roles (MANAGER, EMPLOYEE, CIC, etc.)
 * into the Firestore `config/permissions` document so they become dynamic business roles.
 * 
 * Run this once via the browser console or as a one-time initialization.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROLES_TO_PERMISSIONS } from '../config/permissions';

// These are the business roles that should be seeded into Firestore
// SUPER_ADMIN and ADMIN are system roles and remain hardcoded
const BUSINESS_ROLES_TO_SEED = [
    'MANAGER',
    'EMPLOYEE',
    'CIC',
    'PURCHASING_OFFICER',
    'FINANCE',
    'AUDITOR',
    'GENERAL_MANAGER',
    'BOARD_OF_DIRECTOR'
] as const;

/**
 * Seeds the default business roles and their permissions into Firestore.
 * This ensures the `config/permissions` document contains all necessary roles
 * for the permission matrix to function correctly.
 * 
 * @param overwrite - If true, completely overwrites existing roles with defaults. If false (default), safely merges missing default permissions.
 */
export const seedBusinessRoles = async (overwrite: boolean = false): Promise<void> => {
    try {
        const docRef = doc(db, 'config', 'permissions');
        const docSnap = await getDoc(docRef);

        let existingRoles: string[] = [];
        let existingPermissions: Record<string, string[]> = {};

        if (docSnap.exists()) {
            const data = docSnap.data();
            existingRoles = data.roles || [];
            existingPermissions = data.roles_permissions || data.permissions || {};
        }

        // Merge roles: keep existing + add missing business roles
        const allRoles = new Set([...existingRoles, ...BUSINESS_ROLES_TO_SEED]);

        // Build permissions map: use existing or fall back to defaults from config
        const mergedPermissions: Record<string, string[]> = { ...existingPermissions };

        for (const role of BUSINESS_ROLES_TO_SEED) {
            const defaultPerms = ROLES_TO_PERMISSIONS[role as keyof typeof ROLES_TO_PERMISSIONS];
            if (defaultPerms) {
                if (!mergedPermissions[role] || overwrite) {
                    // Use the default permissions from the hardcoded config or overwrite
                    mergedPermissions[role] = [...defaultPerms];
                } else {
                    // Safely merge missing default permissions into existing role
                    const existingSet = new Set(mergedPermissions[role]);
                    for (const perm of defaultPerms) {
                        existingSet.add(perm);
                    }
                    mergedPermissions[role] = Array.from(existingSet);
                }
            }
        }

        // Also ensure SUPER_ADMIN and ADMIN have their permissions
        const systemRoles = ['SUPER_ADMIN', 'ADMIN'];
        for (const role of systemRoles) {
            const defaultPerms = ROLES_TO_PERMISSIONS[role as keyof typeof ROLES_TO_PERMISSIONS];
            if (defaultPerms) {
                if (!mergedPermissions[role] || overwrite) {
                    mergedPermissions[role] = [...defaultPerms];
                } else {
                    const existingSet = new Set(mergedPermissions[role]);
                    for (const perm of defaultPerms) {
                        existingSet.add(perm);
                    }
                    mergedPermissions[role] = Array.from(existingSet);
                }
            }
        }

        // Save to Firestore
        await setDoc(docRef, {
            roles: Array.from(allRoles),
            permissions: mergedPermissions
        }, { merge: true });

        console.log('✅ Business roles seeded successfully!');
        console.log('Roles:', Array.from(allRoles));

    } catch (error) {
        console.error('❌ Error seeding business roles:', error);
        throw error;
    }
};

/**
 * Utility function to run the migration from browser console.
 * Usage: Import this file and call `window.seedBusinessRoles()` in console.
 */
if (typeof window !== 'undefined') {
    (window as any).seedBusinessRoles = seedBusinessRoles;
}

export default seedBusinessRoles;
