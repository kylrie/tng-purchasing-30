// QR Ordering — client for the getPublicMenu Cloud Function (Sprint 1 wiring).
//
// This is the only Firebase-touching module in the customer menu path. It calls
// the anonymous callable (no auth — the Admin SDK reads server-side, so
// firestore.rules is never involved) and maps the sanitized response to the UI
// shape. Production DB target is fixed server-side to `tng-systems` (Gate A /
// P0-2 closed); nothing about the DB target lives here.
//
// App Check enforcement is NOT enabled here (task rule): if the app initialises
// App Check elsewhere the token rides along automatically, but we do not force
// attestation for this callable.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from './qrFunctions';
import { mapPublicMenuResponse } from './publicMenu.mapper';
import type { GetPublicMenuResponse, PublicMenuResult } from './publicMenu.mapper';

/** Call getPublicMenu with the opaque QR token and return the mapped menu. */
export async function fetchPublicMenu(qrToken: string): Promise<PublicMenuResult> {
    const callable = httpsCallable<{ qrToken: string }, GetPublicMenuResponse>(
        getQrFunctions(),
        'getPublicMenu',
    );
    const { data } = await callable({ qrToken });
    return mapPublicMenuResponse(data);
}

/** Transport-level failure (function not deployed / network / cold-start timeout)
 *  — distinct from a real business error like not-found or failed-precondition.
 *  Used only to permit a mock fallback during local dev. */
export function isCallableUnavailable(err: unknown): boolean {
    const code = (err as { code?: string } | null)?.code ?? '';
    return (
        code === 'functions/unavailable' ||
        code === 'functions/internal' ||
        code === 'functions/deadline-exceeded' ||
        code === 'unavailable' ||
        code === 'internal'
    );
}

/** Map a callable error to a diner-friendly message. Never surfaces internal
 *  error codes or ids to the client (keeps L4 closed on the client side). */
export function toUserFacingMenuError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/not-found':
            return 'We couldn’t find this table. Please rescan the QR code on your table.';
        case 'functions/failed-precondition':
            return 'This table isn’t taking orders right now. Please ask our staff for help.';
        case 'functions/resource-exhausted':
            return 'The menu is very busy right now. Please wait a few seconds and try again.';
        case 'functions/invalid-argument':
            return 'This menu link looks incomplete. Please rescan the QR code on your table.';
        default:
            return 'We couldn’t load the menu. Please check your connection and try again.';
    }
}
