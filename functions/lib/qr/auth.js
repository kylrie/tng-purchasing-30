"use strict";
/**
 * QR Ordering — callable authorization helper (Sprint 1 remediation · H1)
 *
 * Mirrors the existing app RBAC pattern (admin.ts / setBudgetLimit): roles live
 * in the `users/{uid}` document (no custom claims), and a callable checks the
 * caller's role against an allow-list. Extracted here so staff-only QR callables
 * (createQrTable, listQrTables) share one implementation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QR_OPS_ROLES = exports.QR_RECONCILE_ROLES = exports.QR_TABLE_ADMIN_ROLES = void 0;
exports.requireStaffRole = requireStaffRole;
const https_1 = require("firebase-functions/v2/https");
/**
 * Roles permitted to manage QR tables. Table management is an admin action;
 * ADMIN/SUPER_ADMIN are cross-business-unit by design in this app (see the
 * `belongsToSameBU` rules helper). If a narrower, dedicated permission key is
 * later confirmed in `config/permissions`, tighten to that.
 */
exports.QR_TABLE_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
/**
 * Roles permitted to post an official (registered-POS) invoice number back onto
 * a paid QR order for reconciliation (Phase 3.5). Cashier/finance duty — there is
 * no dedicated CASHIER role in the current dynamic role set, so this is the
 * nearest reasonable staff set. Confirm the exact allow-list with Fred before
 * go-live. Fails closed for any role not listed here.
 */
exports.QR_RECONCILE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'FINANCE'];
/**
 * Roles permitted to advance a QR order through kitchen/fulfillment
 * (updateQrOrderStatus: PAID→IN_KITCHEN→READY→SERVED→COMPLETED). Front-of-house
 * / kitchen / management duty. There is no dedicated KITCHEN role in the current
 * dynamic role set, so this is the nearest reasonable staff set — confirm the
 * exact allow-list with Fred before go-live. Fails closed for any role not
 * listed here. These transitions touch NO financial fields.
 */
exports.QR_OPS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'MANAGER'];
/**
 * Assert the caller is authenticated and holds one of `allowedRoles`.
 * Returns the caller's user record (for downstream BU checks). Throws a typed
 * HttpsError otherwise. Fails closed — an unknown/missing role is rejected.
 */
async function requireStaffRole(db, uid, allowedRoles) {
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'User profile not found');
    }
    const user = userSnap.data();
    if (typeof user.role !== 'string' || !allowedRoles.includes(user.role)) {
        throw new https_1.HttpsError('permission-denied', `Requires one of: ${allowedRoles.join(', ')}`);
    }
    return user;
}
//# sourceMappingURL=auth.js.map