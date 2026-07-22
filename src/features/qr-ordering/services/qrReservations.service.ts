// QR Operations — table reservations client (Ops → Tables quick reservations).
//
// Reads: staff are signed-in, so they read `qr_reservations` DIRECTLY via a
// BU-scoped onSnapshot (firestore.rules: `allow read: if isSignedIn()`, mirroring
// the qr_orders ops feed). Writes: ONLY through the createQrReservation callable
// (`qr_reservations` is `write: if false`) — the server derives the businessUnitId
// + tableNumber from the authoritative qr_tables record and rejects conflicts, so
// a client can never book across business units or double-book a table.

import { httpsCallable } from 'firebase/functions';
import type { Unsubscribe } from 'firebase/firestore';
import { FirestoreService, where } from '../../../shared/services/firestore.service';
import { getQrFunctions } from './qrFunctions';
import type {
    QrReservation, CreateQrReservationInput, CreateQrReservationResult,
} from '../types/qrOrder.types';
import type { ReservationLite } from '../ops/tableStatus';

interface RawTimestamp { toMillis?: () => number }
interface RawReservationDoc {
    id: string;
    businessUnitId?: string;
    tableId?: string;
    tableNumber?: string;
    customerName?: string;
    customerPhone?: string;
    reservationAt?: RawTimestamp;
    holdMinutes?: number;
    status?: string;
    createdAt?: RawTimestamp;
    createdBy?: string;
}

function millis(ts: RawTimestamp | undefined): number {
    const v = ts?.toMillis?.();
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Map one raw qr_reservations doc to the ops shape. Pure + exported for testing. */
export function toReservation(doc: RawReservationDoc): QrReservation {
    return {
        id: doc.id,
        businessUnitId: typeof doc.businessUnitId === 'string' ? doc.businessUnitId : '',
        tableId: typeof doc.tableId === 'string' ? doc.tableId : '',
        tableNumber: typeof doc.tableNumber === 'string' ? doc.tableNumber : '',
        customerName: typeof doc.customerName === 'string' ? doc.customerName : '',
        customerPhone: typeof doc.customerPhone === 'string' ? doc.customerPhone : '',
        reservationAtMillis: millis(doc.reservationAt),
        holdMinutes: typeof doc.holdMinutes === 'number' ? doc.holdMinutes : 0,
        status: doc.status === 'CANCELLED' ? 'CANCELLED' : 'BOOKED',
        createdAtMillis: millis(doc.createdAt),
        createdBy: typeof doc.createdBy === 'string' ? doc.createdBy : undefined,
    };
}

/** A QrReservation is already a superset of ReservationLite (structural). */
export function toReservationLite(r: QrReservation): ReservationLite {
    return {
        id: r.id, tableId: r.tableId, reservationAtMillis: r.reservationAtMillis,
        holdMinutes: r.holdMinutes, customerName: r.customerName, customerPhone: r.customerPhone, status: r.status,
    };
}

/** Subscribe to a business unit's reservations (live). Returns the unsubscribe fn. */
export function subscribeQrReservations(
    businessUnitId: string,
    onData: (reservations: QrReservation[]) => void,
    onError: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<RawReservationDoc>(
        'qr_reservations',
        docs => onData(docs.map(toReservation)),
        [where('businessUnitId', '==', businessUnitId)],
        onError,
    );
}

/** Create a reservation. The server derives BU + tableNumber from the table record
 *  and rejects conflicts; the client passes only table + when + who. */
export async function createQrReservation(input: CreateQrReservationInput): Promise<CreateQrReservationResult> {
    const callable = httpsCallable<CreateQrReservationInput, CreateQrReservationResult>(getQrFunctions(), 'createQrReservation');
    const { data } = await callable(input);
    return data;
}

/** True when the callable rejected because the slot conflicts with an existing one. */
export function isReservationConflict(err: unknown): boolean {
    return ((err as { code?: string } | null)?.code ?? '') === 'functions/already-exists';
}

/** Staff-facing message for a failed reservation create. Never leaks internal codes. */
export function toUserFacingReservationError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/already-exists':
            return 'That table already has a reservation overlapping this time. Pick another time.';
        case 'functions/failed-precondition':
            return 'That table isn’t available for reservations right now.';
        case 'functions/not-found':
            return 'That table no longer exists.';
        case 'functions/permission-denied':
        case 'functions/unauthenticated':
            return 'You need a manager account to make reservations.';
        case 'functions/invalid-argument':
            return 'Please check the date, time, name and phone number.';
        default:
            return 'Couldn’t save the reservation. Please try again.';
    }
}
