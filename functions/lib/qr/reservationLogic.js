"use strict";
/**
 * QR Ordering — reservation pure logic (createQrReservation · server authority).
 *
 * Mirrors the client rules (src/features/qr-ordering/utils/phMobile.ts +
 * ops/tableStatus.ts) so the server RE-VALIDATES authoritatively — the client
 * pre-check is never trusted. Kept pure + injectable so the handler is fully
 * unit-testable with a FakeFirestore (no emulator).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVATION_HOLD_MINUTES = void 0;
exports.normalizePhMobile = normalizePhMobile;
exports.conflicts = conflicts;
/** v1 reservation hold: a booking blocks its table for this many minutes from its
 *  start time. Must match the client RESERVATION_HOLD_MINUTES. */
exports.RESERVATION_HOLD_MINUTES = 120;
/**
 * Normalize a PH mobile number to `09XXXXXXXXX`, or null if invalid. Accepts
 * `09XXXXXXXXX`, `+639XXXXXXXXX`, `639XXXXXXXXX`, tolerating spaces / dashes.
 */
function normalizePhMobile(raw) {
    if (typeof raw !== 'string')
        return null;
    let d = raw.trim().replace(/[\s()\-.]/g, '');
    if (d.startsWith('+63'))
        d = '0' + d.slice(3);
    else if (d.startsWith('63') && d.length === 12)
        d = '0' + d.slice(2);
    if (/^09\d{9}$/.test(d))
        return d;
    return null;
}
function endMillis(r) {
    const h = (typeof r.holdMinutes === 'number' && r.holdMinutes > 0 ? r.holdMinutes : exports.RESERVATION_HOLD_MINUTES) * 60_000;
    return r.reservationAtMillis + h;
}
function isActive(r) {
    return (r.status ?? 'BOOKED') !== 'CANCELLED';
}
/** True when the proposed window overlaps a non-cancelled existing reservation.
 *  Overlap = proposedStart < existingEnd AND existingStart < proposedEnd. */
function conflicts(existing, startMillis, holdMinutes = exports.RESERVATION_HOLD_MINUTES) {
    const proposedEnd = startMillis + holdMinutes * 60_000;
    return existing.some(r => isActive(r) && startMillis < endMillis(r) && r.reservationAtMillis < proposedEnd);
}
//# sourceMappingURL=reservationLogic.js.map