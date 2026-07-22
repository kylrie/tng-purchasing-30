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

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore, FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import { requireStaffRole, callerCoversBU, QR_OPS_ROLES } from './auth';
import { normalizePhMobile, conflicts, RESERVATION_HOLD_MINUTES, ReservationWindow } from './reservationLogic';

export interface CreateQrReservationInput {
    tableId?: string;
    reservationAtMillis?: number;
    customerName?: string;
    customerPhone?: string;
}

export interface CreateQrReservationResult {
    reservationId: string;
    tableId: string;
    tableNumber: string;
    businessUnitId: string;
    reservationAtMillis: number;
}

interface TableDoc {
    businessUnitId?: string;
    tableNumber?: string;
    isActive?: boolean;
}

const MAX_NAME_LEN = 80;

export async function createQrReservationHandler(
    db: Firestore,
    request: CallableRequest<CreateQrReservationInput>,
    opts?: { now?: () => number },
): Promise<CreateQrReservationResult> {
    const now = opts?.now ?? Date.now;
    const user = await requireStaffRole(db, request.auth?.uid, QR_OPS_ROLES);

    // 1. Shape validation.
    const tableId = request.data?.tableId;
    if (typeof tableId !== 'string' || tableId.trim() === '') {
        throw new HttpsError('invalid-argument', 'tableId is required');
    }
    const reservationAtMillis = request.data?.reservationAtMillis;
    // Safe-integer guard: rejects NaN/Infinity AND absurd values (e.g. 1e20) that
    // would otherwise throw inside Timestamp.fromMillis as an opaque internal error.
    if (typeof reservationAtMillis !== 'number' || !Number.isSafeInteger(reservationAtMillis)) {
        throw new HttpsError('invalid-argument', 'A valid reservation date/time is required');
    }
    const rawName = request.data?.customerName;
    const customerName = typeof rawName === 'string' ? rawName.trim() : '';
    if (customerName === '' || customerName.length > MAX_NAME_LEN) {
        throw new HttpsError('invalid-argument', 'A customer name is required');
    }
    const customerPhone = normalizePhMobile(request.data?.customerPhone);
    if (!customerPhone) {
        throw new HttpsError('invalid-argument', 'A valid Philippine mobile number is required');
    }
    // Reject reservations in the past (small grace window for clock skew).
    if (reservationAtMillis < now() - 60_000) {
        throw new HttpsError('invalid-argument', 'The reservation time is in the past');
    }

    // Steps 2–4 run in ONE transaction so the conflict check + write are atomic —
    // two concurrent bookings for the same table/window can't both pass (no
    // double-booking). Reads (table + this table's reservations) happen before the
    // write, as Firestore transactions require.
    const id = tableId.trim();
    const tableRef = db.collection('qr_tables').doc(id);
    const reservationsQuery = db.collection('qr_reservations').where('tableId', '==', id);

    return db.runTransaction(async (txn: Transaction) => {
        // 2. Authoritative table record → businessUnitId + tableNumber (never trust client bu).
        const tableSnap = await txn.get(tableRef);
        if (!tableSnap.exists) throw new HttpsError('not-found', 'Table not found');
        const table = tableSnap.data() as TableDoc;
        if (table.isActive !== true) throw new HttpsError('failed-precondition', 'That table is not active');
        const businessUnitId = typeof table.businessUnitId === 'string' ? table.businessUnitId : '';
        const tableNumber = typeof table.tableNumber === 'string' ? table.tableNumber : '';
        if (!businessUnitId) throw new HttpsError('failed-precondition', 'Table is missing a business unit');

        // BU boundary — a BU-scoped manager (MANAGER/GENERAL_MANAGER) may not reserve
        // another business unit's table; ADMIN/SUPER_ADMIN are cross-BU by design.
        if (!callerCoversBU(user, businessUnitId)) {
            throw new HttpsError('permission-denied', 'That table belongs to another business unit');
        }

        // 3. Conflict check — overlap with an existing (non-cancelled) reservation on
        //    this exact table. Single-field equality query (no composite index).
        const existingSnap = await txn.get(reservationsQuery);
        const existing: ReservationWindow[] = existingSnap.docs.map(d => {
            const r = d.data() as { reservationAt?: Timestamp; holdMinutes?: number; status?: string };
            return {
                reservationAtMillis: r.reservationAt?.toMillis?.() ?? 0,
                holdMinutes: typeof r.holdMinutes === 'number' ? r.holdMinutes : RESERVATION_HOLD_MINUTES,
                status: r.status,
            };
        });
        if (conflicts(existing, reservationAtMillis, RESERVATION_HOLD_MINUTES)) {
            throw new HttpsError('already-exists', 'That table already has a reservation overlapping this time');
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
            reservationAt: Timestamp.fromMillis(reservationAtMillis),
            holdMinutes: RESERVATION_HOLD_MINUTES,
            status: 'BOOKED',
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth?.uid ?? null,
            createdByRole: user.role,
        });
        return { reservationId: ref.id, tableId: id, tableNumber, businessUnitId, reservationAtMillis };
    });
}
