// QR Ordering — client for the createXenditSession Cloud Function (Phase 3 wiring).
//
// Turns an already-created `qr_orders` document (status AWAITING_PAYMENT) into a
// Xendit hosted-checkout link and hands the browser off to it. The client NEVER
// sees the Xendit secret: the payment_link_url is minted server-side; this
// module only calls the callable with { orderId } and reads back the link.
//
// It NEVER marks an order paid — payment truth comes only from the webhook
// (createXenditSession just issues the link; the customer pays on Xendit's page
// and the order flips to PAID via xenditWebhook). See docs/QR_XENDIT_IMPLEMENTATION_PLAN.md §1.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from './qrFunctions';
import type { CreateXenditSessionInput, CreateXenditSessionResult } from '../types/qrOrder.types';

/**
 * Client feature flag mirroring the server QR_PAYMENTS_ENABLED. Default OFF
 * (dark launch): only when explicitly 'true' does the client route a real order
 * through Xendit checkout — otherwise the pre-payment flow is preserved. The
 * server callable ALSO refuses when its flag is off, so this is a UX gate, not a
 * security control.
 */
export function isQrPaymentsEnabled(): boolean {
    return String(import.meta.env.VITE_QR_PAYMENTS_ENABLED ?? '').toLowerCase() === 'true';
}

/** Create a payment session for an existing order and return the hosted-checkout link. */
export async function createXenditSession(orderId: string): Promise<CreateXenditSessionResult> {
    const callable = httpsCallable<CreateXenditSessionInput, CreateXenditSessionResult>(
        getQrFunctions(),
        'createXenditSession',
    );
    const { data } = await callable({ orderId });
    return data;
}

/** True when the callable refused because online payments are switched off
 *  (server QR_PAYMENTS_ENABLED=false → failed-precondition). Lets the UI show a
 *  "pay at the counter" state instead of an unhelpful retry. */
export function isPaymentsDisabledError(err: unknown): boolean {
    return ((err as { code?: string } | null)?.code ?? '') === 'functions/failed-precondition';
}

/**
 * Only follow a payment link we trust. Xendit hosted checkout is an absolute
 * https URL; the local mock returns an app-relative path ('/checkout/demo…').
 * Everything else (javascript:, data:, non-https) is refused — defense in depth
 * so a malformed/compromised link can never drive an unsafe navigation.
 */
export function isSafePaymentLink(url: unknown): url is string {
    if (typeof url !== 'string' || url.length === 0) return false;
    if (url.startsWith('/')) return true; // app-relative (mock)
    try {
        const u = new URL(url);
        return u.protocol === 'https:' || (import.meta.env.DEV && u.protocol === 'http:');
    } catch {
        return false;
    }
}

/** Hand the browser off to the hosted checkout. Isolated so it's the single,
 *  swappable navigation seam (and unit-testable). Full-page navigation — the app
 *  does NOT set any paid state here; the order flips to PAID only via the webhook. */
export function redirectToPaymentLink(url: string): void {
    window.location.assign(url);
}

/** Map a createXenditSession error to a diner-friendly message. Never surfaces
 *  internal codes/ids (keeps L4 closed on the client). */
export function toUserFacingSessionError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/failed-precondition':
            return 'Online payment isn’t available right now. Please pay at the counter or ask our staff for help.';
        case 'functions/not-found':
            return 'We couldn’t find your order. Please rescan the QR code on your table and try again.';
        case 'functions/resource-exhausted':
            return 'You’re trying very quickly. Please wait a few seconds and try again.';
        case 'functions/unavailable':
            return 'We couldn’t reach the payment service. Please check your connection and try again.';
        default:
            return 'We couldn’t start your payment. Please try again.';
    }
}
