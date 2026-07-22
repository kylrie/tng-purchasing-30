// QR Operations — pure table status + reservation-window resolver.
//
// Single source of the FREE / OCCUPIED / RESERVED rule and the "next upcoming
// reservation" ordering used by the Operations → Tables tab. Pure + framework-free
// so it is unit-testable (node:test) and cannot drift from what the UI shows.
//
// Status precedence (a live order is the real current use of the table):
//   OCCUPIED  — an active QR order references this table (isActiveStatus)
//   RESERVED  — no active order, but a reservation's hold window covers `now`
//   FREE      — neither
//
// Reservation timing: the repo had no reservation-duration convention, so v1 uses
// a single explicit hold window (RESERVATION_HOLD_MINUTES) from the reservation
// start. This is deliberately minimal and is asserted in the tests — not a full
// booking engine.

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED';

/** Explicit v1 reservation hold: a reservation blocks its table for this many
 *  minutes from its start time. Change here (and the test) to adjust the rule. */
export const RESERVATION_HOLD_MINUTES = 120;

/** The minimal reservation shape the resolver needs. */
export interface ReservationLite {
    id: string;
    tableId: string;
    reservationAtMillis: number;
    holdMinutes?: number;
    customerName: string;
    customerPhone: string;
    status?: string; // 'BOOKED' | 'CANCELLED' — absent ⇒ BOOKED
}

function hold(r: ReservationLite): number {
    return (typeof r.holdMinutes === 'number' && r.holdMinutes > 0 ? r.holdMinutes : RESERVATION_HOLD_MINUTES) * 60_000;
}

/** Epoch ms at which the reservation's hold window ends. */
export function reservationEndMillis(r: ReservationLite): number {
    return r.reservationAtMillis + hold(r);
}

/** A reservation counts unless it was explicitly cancelled. */
export function isActiveReservation(r: ReservationLite): boolean {
    return (r.status ?? 'BOOKED') !== 'CANCELLED';
}

/** True when the reservation's hold window currently covers `now`. */
export function isBlockingNow(r: ReservationLite, now: number): boolean {
    return isActiveReservation(r) && r.reservationAtMillis <= now && now < reservationEndMillis(r);
}

/** Non-expired reservations (window end still in the future), nearest start first.
 *  Includes a currently-blocking reservation (its window hasn't ended yet). */
export function upcomingReservations(reservations: ReservationLite[], now: number): ReservationLite[] {
    return reservations
        .filter(r => isActiveReservation(r) && reservationEndMillis(r) > now)
        .sort((a, b) => a.reservationAtMillis - b.reservationAtMillis);
}

/** The nearest upcoming reservation (shown first in the popup), or null. */
export function nextReservation(reservations: ReservationLite[], now: number): ReservationLite | null {
    return upcomingReservations(reservations, now)[0] ?? null;
}

/** Resolve the operational status. `hasActiveOrder` is whether any live QR order
 *  (isActiveStatus) references this table. */
export function resolveTableStatus(hasActiveOrder: boolean, reservations: ReservationLite[], now: number): TableStatus {
    if (hasActiveOrder) return 'OCCUPIED';
    if (reservations.some(r => isBlockingNow(r, now))) return 'RESERVED';
    return 'FREE';
}

/** True when a proposed reservation window overlaps an existing (non-cancelled)
 *  reservation for the same table. Used to reject conflicting bookings. Overlap =
 *  proposedStart < existingEnd AND existingStart < proposedEnd. */
export function hasReservationConflict(
    existing: ReservationLite[],
    startMillis: number,
    holdMinutes: number = RESERVATION_HOLD_MINUTES,
): boolean {
    const end = startMillis + holdMinutes * 60_000;
    return existing.some(r => isActiveReservation(r) && startMillis < reservationEndMillis(r) && r.reservationAtMillis < end);
}
