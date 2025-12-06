/**
 * useRoleOptions Hook
 * 
 * Fetches available roles from the PermissionsContext and merges them
 * with system roles to provide a complete list for UI dropdowns.
 * 
 * Features:
 * - Filters out SUPER_ADMIN from user-facing dropdowns (only assignable by developers)
 * - Provides formatted labels for display
 * - Indicates whether a role is a system role or business role
 */

import { useMemo } from 'react';
import { usePermissionsContext } from '../contexts/PermissionsContext';
import {
    SystemRole,
    isSystemRole,
    formatRoleLabel,
    DEFAULT_BUSINESS_ROLES
} from '../features/procurement/types';

export interface RoleOption {
    value: string;
    label: string;
    isSystem: boolean;
    disabled?: boolean;
}

interface UseRoleOptionsReturn {
    /** All role options for dropdowns (excludes SUPER_ADMIN) */
    roleOptions: RoleOption[];
    /** All roles including SUPER_ADMIN (for admin views) */
    allRoleOptions: RoleOption[];
    /** Loading state from permissions context */
    isLoading: boolean;
    /** Default role to use in forms */
    defaultRole: string;
    /** Format a role string for display */
    formatRoleLabel: (role: string) => string;
}

/**
 * Hook to get available roles for dropdowns.
 * Merges system roles with dynamic business roles from Firestore.
 */
export const useRoleOptions = (): UseRoleOptionsReturn => {
    const { roles, loading } = usePermissionsContext();

    const allRoleOptions = useMemo((): RoleOption[] => {
        // Start with system roles
        const systemRoleOptions: RoleOption[] = Object.values(SystemRole).map(role => ({
            value: role,
            label: formatRoleLabel(role),
            isSystem: true,
        }));

        // Get unique business roles from context (or use defaults if empty)
        const businessRolesFromContext = roles.filter(r => !isSystemRole(r));
        const businessRolesToUse = businessRolesFromContext.length > 0
            ? businessRolesFromContext
            : [...DEFAULT_BUSINESS_ROLES];

        const businessRoleOptions: RoleOption[] = businessRolesToUse.map(role => ({
            value: role,
            label: formatRoleLabel(role),
            isSystem: false,
        }));

        // Combine: System roles first, then business roles
        return [...systemRoleOptions, ...businessRoleOptions];
    }, [roles]);

    // Filtered options excluding SUPER_ADMIN for regular dropdowns
    const roleOptions = useMemo((): RoleOption[] => {
        return allRoleOptions.filter(opt => opt.value !== SystemRole.SUPER_ADMIN);
    }, [allRoleOptions]);

    return {
        roleOptions,
        allRoleOptions,
        isLoading: loading,
        defaultRole: 'EMPLOYEE',
        formatRoleLabel,
    };
};

export default useRoleOptions;
