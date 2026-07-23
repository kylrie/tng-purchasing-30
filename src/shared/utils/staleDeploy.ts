// Detect + recover from a STALE frontend bundle after a production deploy.
//
// A returning client can hold an old index.html — kept by the browser HTTP cache
// or, more stubbornly, by the PWA service-worker precache — that references hashed
// JS chunks the newest deploy has already replaced. Requesting a missing
// /assets/<oldhash>.js 404s, and the SPA rewrite returns index.html (text/html),
// so the ES-module loader throws "…is not a valid JavaScript MIME type" or a
// Chunk/preload load error. To the customer this surfaced as a broken
// Vite/config-looking screen during a live demo.
//
// The correct recovery is a SINGLE reload: the production shell is served
// `Cache-Control: no-cache` (firebase.json), so a reload re-fetches the CURRENT
// index.html and its matching chunks. This module is pure + framework-free so it
// can be used from the entry point and the error boundary alike.

/** sessionStorage guard so we reload AT MOST once per session (no reload loops). */
const RELOAD_GUARD_KEY = 'tng:stale-deploy-reloaded';

/**
 * True when an error looks like a stale-bundle / failed dynamic-import after a
 * deploy (as opposed to a genuine application bug). Matches the browser/Vite
 * messages for chunk-load and module-MIME failures. Never throws.
 */
export function isStaleDeployError(err: unknown): boolean {
    const parts: string[] = [];
    if (err instanceof Error) {
        parts.push(err.name, err.message);
    } else if (typeof err === 'string') {
        parts.push(err);
    } else if (err && typeof err === 'object') {
        const anyErr = err as { name?: unknown; message?: unknown };
        if (typeof anyErr.name === 'string') parts.push(anyErr.name);
        if (typeof anyErr.message === 'string') parts.push(anyErr.message);
    }
    const text = parts.join(' ');
    if (!text) return false;
    return /ChunkLoadError|Loading chunk|Loading CSS chunk|error loading dynamically imported module|Importing a module script failed|module script failed|Failed to fetch dynamically imported module|valid JavaScript MIME|preload(?:ing)? .*?(?:module|css)|vite:preloadError/i.test(
        text,
    );
}

/**
 * Reload ONCE per session to pick up the current shell. Returns true if it
 * triggered a reload; false if we already tried this session (so callers can fall
 * back to a clean "please reload" message instead of looping). Never throws.
 */
export function reloadForStaleDeployOnce(): boolean {
    try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
        // sessionStorage blocked (private mode) — fall through to a best-effort reload.
    }
    try {
        window.location.reload();
    } catch {
        /* noop */
    }
    return true;
}

/**
 * Clear the one-shot guard once the app is confirmed healthy (call a few seconds
 * after a successful mount), so a LATER deploy in the same long-lived session can
 * still auto-recover. Never throws.
 */
export function clearStaleDeployGuard(): void {
    try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
        /* noop */
    }
}
