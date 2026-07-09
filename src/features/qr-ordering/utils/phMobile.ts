// Philippine mobile number normalize/validate.
//
// The repo had no existing PH phone convention when quick reservations were added,
// so this is the single small source of truth (client-side pre-validation; the
// server re-validates authoritatively via functions/src/qr/reservationLogic.ts,
// which mirrors this exact rule). Accepts the common local + international forms
// and normalizes to the canonical local 11-digit `09XXXXXXXXX`.

/**
 * Normalize a PH mobile number to `09XXXXXXXXX`, or return null if it isn't a
 * valid PH mobile. Accepts `09XXXXXXXXX`, `+639XXXXXXXXX`, `639XXXXXXXXX`, and
 * tolerates spaces / dashes / parentheses.
 */
export function normalizePhMobile(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    let d = raw.trim().replace(/[\s()\-.]/g, '');
    if (d.startsWith('+63')) d = '0' + d.slice(3);
    else if (d.startsWith('63') && d.length === 12) d = '0' + d.slice(2);
    if (/^09\d{9}$/.test(d)) return d;
    return null;
}

/** True when `raw` is a valid PH mobile number. */
export function isValidPhMobile(raw: unknown): boolean {
    return normalizePhMobile(raw) !== null;
}
