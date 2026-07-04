/**
 * createXenditSession — Callable Cloud Function (Phase 3 · payment session)
 *
 * Thin onCall wrapper. All logic lives in createXenditSession.handler.ts (kept
 * injectable + unit-tested with a stub client). This file is the ONLY place the
 * real Xendit secret and runtime config are read, and the ONLY place the live
 * HTTP client is constructed.
 *
 * SECRET: XENDIT_SECRET_KEY is bound via Cloud Secret Manager (defineSecret) and
 * only ever reaches the client wrapper's Basic-auth header — never a log, never
 * the client bundle (the payment_link_url is minted server-side).
 *
 * MOCK MODE: with no secret configured (local emulator / design-preview), the
 * mock client returns a `/checkout/demo`-style link and never calls Xendit
 * (QR_XENDIT_IMPLEMENTATION_PLAN §3).
 *
 * KILL SWITCH: QR_PAYMENTS_ENABLED defaults to FALSE — the callable refuses
 * until an operator turns payments on (dark launch / instant rollback, §8–9).
 *
 * NOTE (H2, pending): like the other anonymous customer callables, App Check is
 * not yet enforced here; the per-table SESSION_CREATE_LIMIT is today's defense.
 * Enforcing App Check is the tracked H2 prerequisite before public traffic.
 */

import { onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString, defineBoolean } from 'firebase-functions/params';
import { qrDb } from './firestore';
import { createXenditSessionHandler } from './createXenditSession.handler';
import { createXenditHttpClient, createMockXenditClient, XenditClient } from './xenditClient';

const XENDIT_SECRET_KEY = defineSecret('XENDIT_SECRET_KEY');
const XENDIT_API_BASE = defineString('XENDIT_API_BASE', { default: 'https://api.xendit.co' });
const QR_PUBLIC_BASE_URL = defineString('QR_PUBLIC_BASE_URL', { default: 'https://tng-systems.web.app' });
const QR_PAYMENTS_ENABLED = defineBoolean('QR_PAYMENTS_ENABLED', { default: false });

export const createXenditSession = onCall({ secrets: [XENDIT_SECRET_KEY] }, request => {
    const secretKey = XENDIT_SECRET_KEY.value();
    const client: XenditClient = secretKey
        ? createXenditHttpClient({ secretKey, apiBase: XENDIT_API_BASE.value() })
        : createMockXenditClient(); // no real key ⇒ mock; never calls Xendit

    return createXenditSessionHandler(qrDb, client, request, {
        paymentsEnabled: QR_PAYMENTS_ENABLED.value(),
        publicBaseUrl: QR_PUBLIC_BASE_URL.value(),
    });
});
