// QR Ordering — pure decision for the client payment-routing gate.
//
// Split out from createSession.service so it can be unit-tested without importing
// the Firebase app (that module reads import.meta.env at load). Behaviour is
// identical to the inline logic it replaces; this file has NO side effects and no
// import.meta.env access — the caller passes the raw env values in.

/**
 * Given the raw client env values, decide whether a created order should route
 * into the Xendit hosted checkout for `businessId`.
 *
 *  - Global `VITE_QR_PAYMENTS_ENABLED === 'true'` → enabled for every venue.
 *  - Otherwise a venue is enabled only if its id is in the comma-separated
 *    `VITE_QR_PAYMENTS_BUSINESSES` allowlist (trimmed, case-insensitive).
 *
 * Callers with no `businessId` (or an empty/whitespace one) only honour the
 * global flag, so an unrelated venue can never be enabled by a stray allowlist
 * fragment.
 */
export function resolveQrPaymentsEnabled(
    globalFlag: string | undefined,
    businessesCsv: string | undefined,
    businessId?: string,
): boolean {
    if (String(globalFlag ?? '').toLowerCase() === 'true') return true;
    const target = String(businessId ?? '').trim().toLowerCase();
    if (target === '') return false;
    const allow = String(businessesCsv ?? '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    return allow.includes(target);
}
