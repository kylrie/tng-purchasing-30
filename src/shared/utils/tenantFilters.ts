/**
 * Tenant Filters Utility
 * 
 * Centralized helper for generating Firestore QueryConstraints
 * that restrict data visibility based on a user's assigned Business Units.
 * 
 * Rules:
 *  - SUPER_ADMIN and OWNER roles bypass all filters (see all data).
 *  - If user.businessUnitIds has entries, use `where(fieldName, 'in', ids)`.
 *  - Fallback: use `where(fieldName, '==', user.businessId)`.
 */

import { where, type QueryConstraint } from 'firebase/firestore';
import { UserRole } from '../../features/procurement/types';
import type { User } from '../../features/procurement/types';

/** Roles that have global visibility and bypass tenant filtering. */
const GLOBAL_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

/**
 * Returns Firestore QueryConstraints that scope data to the user's
 * assigned Business Units.
 *
 * @param user           The current authenticated user.
 * @param fieldName      The Firestore document field to filter on
 *                       (e.g. 'businessId' or 'businessUnitId').
 * @returns              An array of QueryConstraint[]. Empty array means "no restriction".
 */
export function getTenantConstraints(
    user: User | null,
    fieldName: string = 'businessId'
): QueryConstraint[] {
    // No user → no data (safety net)
    if (!user) return [where(fieldName, '==', '__none__')];

    // Global roles or 'ALL' boundary see everything
    if (GLOBAL_ROLES.includes(user.role) || (user.businessUnitIds && user.businessUnitIds.includes('ALL'))) return [];

    // Multi-BU assignment
    const buIds = user.businessUnitIds;
    if (buIds && buIds.length > 0) {
        // Firestore 'in' queries support up to 30 elements (expanded from 10).
        // If a user has more than 30 BUs, we'd need query batching at the caller.
        return [where(fieldName, 'in', buIds)];
    }

    // Fallback: single business
    if (user.businessId) {
        return [where(fieldName, '==', user.businessId)];
    }

    // No BU info at all → block everything
    return [where(fieldName, '==', '__none__')];
}

/**
 * Checks whether the given user has global (unrestricted) visibility.
 * Useful for UI decisions like showing "All BU" dropdown options.
 */
export function isGlobalRole(user: User | null): boolean {
    if (!user) return false;
    return GLOBAL_ROLES.includes(user.role) || !!(user.businessUnitIds && user.businessUnitIds.includes('ALL'));
}

/**
 * Returns the list of Business Unit IDs the user is authorized to see.
 * Returns null for global-role users (meaning "all").
 */
export function getUserVisibleBuIds(user: User | null): string[] | null {
    if (!user) return [];
    if (GLOBAL_ROLES.includes(user.role) || (user.businessUnitIds && user.businessUnitIds.includes('ALL'))) return null; // null = all

    const buIds = user.businessUnitIds;
    if (buIds && buIds.length > 0) return buIds;
    if (user.businessId) return [user.businessId];
    return [];
}
