/**
 * QR Ordering — reservation pure logic (createQrReservation · server authority).
 *
 * Mirrors the client rules (src/features/qr-ordering/utils/phMobile.ts +
 * ops/tableStatus.ts) so the server RE-VALIDATES authoritatively — the client
 * pre-check is never trusted. Kept pure + injectable so the handler is fully
 * unit-testable with a FakeFirestore (no emulator).
 */

/** v1 reservation hold: a booking blocks its table for this many minutes from its
 *  start time. Must match the client RESERVATION_HOLD_MINUTES. */
export const RESERVATION_HOLD_MINUTES = 120;

/**
 * Normalize a PH mobile number to `09XXXXXXXXX`, or null if invalid. Accepts
 * `09XXXXXXXXX`, `+639XXXXXXXXX`, `639XXXXXXXXX`, tolerating spaces / dashes.
 */
export function normalizePhMobile(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    let d = raw.trim().replace(/[\s()\-.]/g, '');
    if (d.startsWith('+63')) d = '0' + d.slice(3);
    else if (d.startsWith('63') && d.length === 12) d = '0' + d.slice(2);
    if (/^09\d{9}$/.test(d)) return d;
    return null;
}

/** The stored fields the conflict check needs. */
export interface ReservationWindow {
    reservationAtMillis: number;
    holdMinutes?: number;
    status?: string;
}

function endMillis(r: ReservationWindow): number {
    const h = (typeof r.holdMinutes === 'number' && r.holdMinutes > 0 ? r.holdMinutes : RESERVATION_HOLD_MINUTES) * 60_000;
    return r.reservationAtMillis + h;
}

function isActive(r: ReservationWindow): boolean {
    return (r.status ?? 'BOOKED') !== 'CANCELLED';
}

/** True when the proposed window overlaps a non-cancelled existing reservation.
 *  Overlap = proposedStart < existingEnd AND existingStart < proposedEnd. */
export function conflicts(
    existing: ReservationWindow[],
    startMillis: number,
    holdMinutes: number = RESERVATION_HOLD_MINUTES,
): boolean {
    const proposedEnd = startMillis + holdMinutes * 60_000;
    return existing.some(r => isActive(r) && startMillis < endMillis(r) && r.reservationAtMillis < proposedEnd);
}
