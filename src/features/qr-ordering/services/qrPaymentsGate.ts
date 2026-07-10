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

/**
 * SOURCE-CONTROLLED, NON-SECRET default allowlist: the businesses whose QR
 * checkout routes into the Xendit hosted page by default, independent of any
 * build-time env. Committed so every production build behaves identically on
 * every machine — a missing/gitignored `.env.production` can no longer silently
 * send The Fun Roof (b1) back to the pre-payment "skip Xendit" flow.
 *
 * This is only the client checkout ROUTING gate. The authoritative money controls
 * are unchanged and server-side: functions `QR_PAYMENTS_ENABLED`, the required
 * Xendit secret, webhook-only PAID transition, server-authoritative pricing, and
 * payment idempotency. Adding an id here never charges anyone — it only decides
 * whether the client opens the Xendit checkout page.
 */
export const PAYMENTS_ENABLED_BUSINESSES: readonly string[] = ['b1']; // The Fun Roof

/**
 * The full client gate: the source-controlled {@link PAYMENTS_ENABLED_BUSINESSES}
 * default unioned with the OPTIONAL env allowlist override, then resolved. Stays
 * deterministic even when BOTH `VITE_QR_PAYMENTS_ENABLED` and
 * `VITE_QR_PAYMENTS_BUSINESSES` are absent: b1 → enabled, b3 → not enabled. The
 * env allowlist remains an additive override (e.g. to canary another venue)
 * without touching this file.
 */
export function resolveQrPaymentsEnabledWithDefaults(
    globalFlag: string | undefined,
    businessesCsv: string | undefined,
    businessId?: string,
): boolean {
    const merged = [...PAYMENTS_ENABLED_BUSINESSES, String(businessesCsv ?? '')].join(',');
    return resolveQrPaymentsEnabled(globalFlag, merged, businessId);
}
