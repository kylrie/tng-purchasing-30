// Durable business identity for the ADMIN QR routes (/qr-ops, /qr-tables).
//
// P0 bug (2026-07-08): opening The Fun Roof (b1) QR manager then hard-refreshing
// silently switched the page to Inflatable Island (b3). Root cause: the selected
// business lived ONLY in transient React context (BusinessUnitContext, an
// in-memory useState('all') with no persistence). On refresh the context reset
// to 'all', and the views fell back to the signed-in admin's home business
// (currentUser.businessId = b3) — a silent cross-business switch.
//
// Fix: business identity is carried in the URL query (?bu=<businessUnitId>) so it
// survives hard refresh, new tab, cold open, direct paste and back/forward. The
// URL is authoritative; there is NO fallback to a default/home business. When no
// business is durably identified the caller shows an explicit "choose a business"
// state — never a silent default.

/** URL query key that carries the durable admin business-unit id. */
export const BUSINESS_PARAM = 'bu';

/** Read the durable businessUnitId from a `location.search` string ('' if absent). */
export function readBusinessParam(search: string | undefined | null): string {
    if (!search) return '';
    try {
        return new URLSearchParams(search).get(BUSINESS_PARAM)?.trim() ?? '';
    } catch {
        return '';
    }
}

/**
 * Append/replace `?bu=<businessUnitId>` on an app path so navigation carries the
 * durable business identity forward. No-op (returns the path unchanged) when the
 * id is empty — we never write an empty/ambiguous business into the URL.
 */
export function withBusinessParam(path: string, businessUnitId: string | undefined | null): string {
    const id = (businessUnitId ?? '').trim();
    if (!id) return path;
    const hashIdx = path.indexOf('#');
    const hash = hashIdx >= 0 ? path.slice(hashIdx) : '';
    const base = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
    const qIdx = base.indexOf('?');
    const pathname = qIdx >= 0 ? base.slice(0, qIdx) : base;
    const sp = new URLSearchParams(qIdx >= 0 ? base.slice(qIdx + 1) : '');
    sp.set(BUSINESS_PARAM, id);
    return `${pathname}?${sp.toString()}${hash}`;
}

export interface AdminBusinessResolution {
    /** ?bu= from the URL — the durable, refresh-safe source of truth. */
    urlBusinessUnitId: string;
    /** Transient global business switcher value ('all' = nothing chosen). */
    selectedBusinessUnit: string;
}

/**
 * Resolve which business an admin QR route (/qr-ops, /qr-tables) is scoped to.
 *
 * Precedence:
 *   1. the durable URL param (?bu) — survives refresh / new tab / cold open;
 *   2. the transient switcher, ONLY when a real business is chosen (not 'all') —
 *      covers in-session navigation before any refresh.
 *
 * It NEVER falls back to the signed-in user's home business — that fallback is
 * exactly what turned Fun Roof (b1) into Inflatable (b3) after a refresh. Returns
 * '' when no business is durably identified; the caller must then show an
 * explicit "choose a business" state rather than defaulting to anything.
 */
export function resolveAdminBusinessUnit(r: AdminBusinessResolution): string {
    const url = (r.urlBusinessUnitId ?? '').trim();
    if (url) return url;
    const sel = (r.selectedBusinessUnit ?? '').trim();
    if (sel && sel !== 'all') return sel;
    return '';
}
