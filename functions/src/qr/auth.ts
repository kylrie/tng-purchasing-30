/**
 * QR Ordering — callable authorization helper (Sprint 1 remediation · H1)
 *
 * Mirrors the existing app RBAC pattern (admin.ts / setBudgetLimit): roles live
 * in the `users/{uid}` document (no custom claims), and a callable checks the
 * caller's role against an allow-list. Extracted here so staff-only QR callables
 * (createQrTable, listQrTables) share one implementation.
 */

import { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export interface StaffUser {
    role: string;
    businessId?: string;
    businessUnitIds?: string[];
}

/**
 * Roles permitted to manage QR tables. Table management is an admin action;
 * ADMIN/SUPER_ADMIN are cross-business-unit by design in this app (see the
 * `belongsToSameBU` rules helper). If a narrower, dedicated permission key is
 * later confirmed in `config/permissions`, tighten to that.
 */
export const QR_TABLE_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Assert the caller is authenticated and holds one of `allowedRoles`.
 * Returns the caller's user record (for downstream BU checks). Throws a typed
 * HttpsError otherwise. Fails closed — an unknown/missing role is rejected.
 */
export async function requireStaffRole(
    db: Firestore,
    uid: string | undefined,
    allowedRoles: string[],
): Promise<StaffUser> {
    if (!uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new HttpsError('not-found', 'User profile not found');
    }
    const user = userSnap.data() as StaffUser;
    if (typeof user.role !== 'string' || !allowedRoles.includes(user.role)) {
        throw new HttpsError('permission-denied', `Requires one of: ${allowedRoles.join(', ')}`);
    }
    return user;
}
