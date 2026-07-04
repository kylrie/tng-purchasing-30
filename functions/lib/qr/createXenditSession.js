"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createXenditSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("./firestore");
const createXenditSession_handler_1 = require("./createXenditSession.handler");
const xenditClient_1 = require("./xenditClient");
const XENDIT_SECRET_KEY = (0, params_1.defineSecret)('XENDIT_SECRET_KEY');
const XENDIT_API_BASE = (0, params_1.defineString)('XENDIT_API_BASE', { default: 'https://api.xendit.co' });
const QR_PUBLIC_BASE_URL = (0, params_1.defineString)('QR_PUBLIC_BASE_URL', { default: 'https://tng-systems.web.app' });
const QR_PAYMENTS_ENABLED = (0, params_1.defineBoolean)('QR_PAYMENTS_ENABLED', { default: false });
exports.createXenditSession = (0, https_1.onCall)({ secrets: [XENDIT_SECRET_KEY] }, request => {
    const secretKey = XENDIT_SECRET_KEY.value();
    const client = secretKey
        ? (0, xenditClient_1.createXenditHttpClient)({ secretKey, apiBase: XENDIT_API_BASE.value() })
        : (0, xenditClient_1.createMockXenditClient)(); // no real key ⇒ mock; never calls Xendit
    return (0, createXenditSession_handler_1.createXenditSessionHandler)(firestore_1.qrDb, client, request, {
        paymentsEnabled: QR_PAYMENTS_ENABLED.value(),
        publicBaseUrl: QR_PUBLIC_BASE_URL.value(),
    });
});
//# sourceMappingURL=createXenditSession.js.map