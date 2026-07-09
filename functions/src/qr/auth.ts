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
 * Roles permitted to post an official (registered-POS) invoice number back onto
 * a paid QR order for reconciliation (Phase 3.5). Cashier/finance duty — there is
 * no dedicated CASHIER role in the current dynamic role set, so this is the
 * nearest reasonable staff set. Confirm the exact allow-list with Fred before
 * go-live. Fails closed for any role not listed here.
 */
export const QR_RECONCILE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'FINANCE'];

/**
 * Roles permitted to advance a QR order through kitchen/fulfillment
 * (updateQrOrderStatus: PAID→IN_KITCHEN→READY→SERVED→COMPLETED). Front-of-house
 * / kitchen / management duty. There is no dedicated KITCHEN role in the current
 * dynamic role set, so this is the nearest reasonable staff set — confirm the
 * exact allow-list with Fred before go-live. Fails closed for any role not
 * listed here. These transitions touch NO financial fields.
 */
export const QR_OPS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'];

/**
 * Whether the caller may act on a resource in this business unit. SUPER_ADMIN /
 * ADMIN are cross-BU by design; other staff must be provisioned for the BU
 * (`businessId` match or `businessUnitIds` membership). Mirrors the check in
 * updateQrOrderStatus / postOfficialInvoice so BU boundaries are enforced the
 * same way everywhere. Fails closed.
 */
export function callerCoversBU(user: StaffUser, businessUnitId: string): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    if (user.businessId && user.businessId === businessUnitId) return true;
    if (Array.isArray(user.businessUnitIds) && user.businessUnitIds.includes(businessUnitId)) return true;
    return false;
}

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
