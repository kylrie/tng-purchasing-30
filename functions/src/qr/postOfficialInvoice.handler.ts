/**
 * postOfficialInvoice — core handler (Sprint 2 · Phase 3.5 reconciliation)
 *
 * Records the official invoice number that the EXISTING registered POS issued,
 * back onto a paid QR order, for reconciliation. TNG never generates a BIR
 * invoice (Master Plan A4) — this only STORES a number issued elsewhere, and
 * audit-stamps who posted it and when.
 *
 * Staff-only (RBAC), BU-scoped, and only for orders that are actually paid.
 * All writes go through this callable — `qr_orders` is `write: if false`. db is
 * injected for testing; the onCall wrapper passes the real `qrDb`. No Xendit,
 * no POS sync.
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { requireStaffRole, QR_RECONCILE_ROLES, StaffUser } from './auth';

export interface PostOfficialInvoiceInput {
    orderId?: string;
    officialInvoiceNumber?: string;
}

const MAX_INVOICE_LEN = 60;
/** Order states for which reconciliation is meaningful (i.e. money has cleared). */
const RECONCILABLE_STATUSES = new Set(['PAID', 'SERVED', 'COMPLETED']);

/** Whether the caller is allowed to act on an order in this business unit. */
function callerCoversBU(user: StaffUser, businessUnitId: string): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true; // cross-BU by design
    if (user.businessId && user.businessId === businessUnitId) return true;
    if (Array.isArray(user.businessUnitIds) && user.businessUnitIds.includes(businessUnitId)) return true;
    return false;
}

export async function postOfficialInvoiceHandler(db: Firestore, request: CallableRequest<PostOfficialInvoiceInput>) {
    // 1. RBAC — authenticated staff with a reconciliation role (fails closed).
    const user = await requireStaffRole(db, request.auth?.uid, QR_RECONCILE_ROLES);

    // 2. Input validation.
    const orderIdRaw = request.data?.orderId;
    if (typeof orderIdRaw !== 'string' || orderIdRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'orderId is required');
    }
    const invoiceRaw = request.data?.officialInvoiceNumber;
    if (typeof invoiceRaw !== 'string' || invoiceRaw.trim() === '') {
        throw new HttpsError('invalid-argument', 'officialInvoiceNumber is required');
    }
    const orderId = orderIdRaw.trim();
    const officialInvoiceNumber = invoiceRaw.trim().slice(0, MAX_INVOICE_LEN);

    // 3. Resolve the order.
    const orderRef = db.collection('qr_orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'Order not found');
    }
    const order = snap.data() as Record<string, unknown>;

    // 4. BU scope — a non-admin caller may only reconcile their own BU's orders.
    if (!callerCoversBU(user, typeof order.businessUnitId === 'string' ? order.businessUnitId : '')) {
        throw new HttpsError('permission-denied', 'Order belongs to another business unit');
    }

    // 5. Only reconcile paid orders (money has actually cleared).
    const isPaid = order.paymentStatus === 'PAID' || RECONCILABLE_STATUSES.has(typeof order.status === 'string' ? order.status : '');
    if (!isPaid) {
        throw new HttpsError('failed-precondition', 'Order is not paid yet — nothing to reconcile');
    }

    // 6. Write + audit stamp.
    const uid = request.auth!.uid;
    await orderRef.update({
        officialInvoiceNumber,
        officialInvoicePostedBy: uid,
        officialInvoicePostedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    return { orderId, officialInvoiceNumber, officialInvoicePostedBy: uid };
}
