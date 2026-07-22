"use strict";
/**
 * createQrReservation — core handler (Ops → Tables quick reservations).
 *
 * Books a reservation against an EXISTING table. Server authority:
 *  - RBAC: caller must hold a QR ops role (requireStaffRole).
 *  - The businessUnitId + tableNumber are read from the AUTHORITATIVE qr_tables
 *    record (never the client) — so a b1 reservation can never land on a b3 table.
 *  - The requested window is conflict-checked against existing reservations for
 *    the same table; an overlap is rejected (no silent double-booking).
 *
 * `db` is injected so the handler is unit-testable with a FakeFirestore + an
 * injectable clock. Writes the reservation via the Admin SDK (qr_reservations is
 * `write: if false` for clients).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQrReservationHandler = createQrReservationHandler;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("./auth");
const reservationLogic_1 = require("./reservationLogic");
const MAX_NAME_LEN = 80;
async function createQrReservationHandler(db, request, opts) {
    const now = opts?.now ?? Date.now;
    const user = await (0, auth_1.requireStaffRole)(db, request.auth?.uid, auth_1.QR_OPS_ROLES);
    // 1. Shape validation.
    const tableId = request.data?.tableId;
    if (typeof tableId !== 'string' || tableId.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'tableId is required');
    }
    const reservationAtMillis = request.data?.reservationAtMillis;
    // Safe-integer guard: rejects NaN/Infinity AND absurd values (e.g. 1e20) that
    // would otherwise throw inside Timestamp.fromMillis as an opaque internal error.
    if (typeof reservationAtMillis !== 'number' || !Number.isSafeInteger(reservationAtMillis)) {
        throw new https_1.HttpsError('invalid-argument', 'A valid reservation date/time is required');
    }
    const rawName = request.data?.customerName;
    const customerName = typeof rawName === 'string' ? rawName.trim() : '';
    if (customerName === '' || customerName.length > MAX_NAME_LEN) {
        throw new https_1.HttpsError('invalid-argument', 'A customer name is required');
    }
    const customerPhone = (0, reservationLogic_1.normalizePhMobile)(request.data?.customerPhone);
    if (!customerPhone) {
        throw new https_1.HttpsError('invalid-argument', 'A valid Philippine mobile number is required');
    }
    // Reject reservations in the past (small grace window for clock skew).
    if (reservationAtMillis < now() - 60_000) {
        throw new https_1.HttpsError('invalid-argument', 'The reservation time is in the past');
    }
    // Steps 2–4 run in ONE transaction so the conflict check + write are atomic —
    // two concurrent bookings for the same table/window can't both pass (no
    // double-booking). Reads (table + this table's reservations) happen before the
    // write, as Firestore transactions require.
    const id = tableId.trim();
    const tableRef = db.collection('qr_tables').doc(id);
    const reservationsQuery = db.collection('qr_reservations').where('tableId', '==', id);
    return db.runTransaction(async (txn) => {
        // 2. Authoritative table record → businessUnitId + tableNumber (never trust client bu).
        const tableSnap = await txn.get(tableRef);
        if (!tableSnap.exists)
            throw new https_1.HttpsError('not-found', 'Table not found');
        const table = tableSnap.data();
        if (table.isActive !== true)
            throw new https_1.HttpsError('failed-precondition', 'That table is not active');
        const businessUnitId = typeof table.businessUnitId === 'string' ? table.businessUnitId : '';
        const tableNumber = typeof table.tableNumber === 'string' ? table.tableNumber : '';
        if (!businessUnitId)
            throw new https_1.HttpsError('failed-precondition', 'Table is missing a business unit');
        // BU boundary — a BU-scoped manager (MANAGER/GENERAL_MANAGER) may not reserve
        // another business unit's table; ADMIN/SUPER_ADMIN are cross-BU by design.
        if (!(0, auth_1.callerCoversBU)(user, businessUnitId)) {
            throw new https_1.HttpsError('permission-denied', 'That table belongs to another business unit');
        }
        // 3. Conflict check — overlap with an existing (non-cancelled) reservation on
        //    this exact table. Single-field equality query (no composite index).
        const existingSnap = await txn.get(reservationsQuery);
        const existing = existingSnap.docs.map(d => {
            const r = d.data();
            return {
                reservationAtMillis: r.reservationAt?.toMillis?.() ?? 0,
                holdMinutes: typeof r.holdMinutes === 'number' ? r.holdMinutes : reservationLogic_1.RESERVATION_HOLD_MINUTES,
                status: r.status,
            };
        });
        if ((0, reservationLogic_1.conflicts)(existing, reservationAtMillis, reservationLogic_1.RESERVATION_HOLD_MINUTES)) {
            throw new https_1.HttpsError('already-exists', 'That table already has a reservation overlapping this time');
        }
        // 4. Persist (Admin SDK, in-txn). Start stored as a Timestamp for consistency
        //    with the rest of the QR data; holdMinutes makes the timing rule explicit.
        const ref = db.collection('qr_reservations').doc();
        txn.set(ref, {
            id: ref.id,
            businessUnitId,
            tableId: id,
            tableNumber,
            customerName,
            customerPhone,
            reservationAt: firestore_1.Timestamp.fromMillis(reservationAtMillis),
            holdMinutes: reservationLogic_1.RESERVATION_HOLD_MINUTES,
            status: 'BOOKED',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            createdBy: request.auth?.uid ?? null,
            createdByRole: user.role,
        });
        return { reservationId: ref.id, tableId: id, tableNumber, businessUnitId, reservationAtMillis };
    });
}
//# sourceMappingURL=createQrReservation.handler.js.map