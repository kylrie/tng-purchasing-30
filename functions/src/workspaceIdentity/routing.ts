/**
 * Workspace Identity Broker — HTTP route matching (pure, no Firebase/HTTP deps).
 *
 * The broker is a SINGLE-PURPOSE, service-to-service function. It serves exactly
 * one operation — the approved contract `POST /resolve` — and rejects everything
 * else. Because Firebase Functions v2 / Cloud Run can present the pathname
 * differently depending on how the function is reached, the pathname is
 * normalized before matching:
 *
 *   - Cloud Run URL (what Workspace calls):        req.path = "/resolve"
 *   - Cloud Functions alias root, or a Functions
 *     Framework mount that stripped the name:      req.path = "/"
 *
 * Trailing slashes and accidental duplicate slashes are ignored. This is NOT a
 * generic router: only `/resolve` (and the stripped single-function root `/`)
 * are accepted, only for POST.
 */

/** Strip the query string, collapse duplicate slashes, and drop a trailing slash (except root). */
export function normalizePathname(rawPath: string | undefined): string {
  const noQuery = String(rawPath ?? '/').split('?')[0] || '/';
  const collapsed = noQuery.replace(/\/{2,}/g, '/');
  // Drop trailing slash(es) but keep a bare "/".
  return collapsed.replace(/(.)\/+$/, '$1');
}

/** The one accepted broker route. GET/OPTIONS/other methods and any other path → false. */
export function isBrokerRoute(method: string | undefined, rawPath: string | undefined): boolean {
  if (method !== 'POST') return false;
  const pathname = normalizePathname(rawPath);
  return pathname === '/resolve' || pathname === '/';
}
