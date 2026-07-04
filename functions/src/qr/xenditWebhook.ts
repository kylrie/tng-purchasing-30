/**
 * xenditWebhook — HTTP Cloud Function (Phase 3 · payment source of truth)
 *
 * The first `onRequest` (HTTPS) function in the repo. Thin adapter: it turns the
 * express request into the injectable handler's `{ method, headers, rawBody }`
 * shape, binds the real Firestore + the dormant release service, and writes the
 * handler's `{ statusCode, body }` back as the HTTP response. All logic + the
 * token verification live in xenditWebhook.handler.ts (unit-tested, no HTTP).
 *
 * SECRET: XENDIT_CALLBACK_TOKEN is bound via Cloud Secret Manager (defineSecret)
 * and only ever reaches the constant-time compare — never a log, never a bundle.
 *
 * The raw body is read from `req.rawBody` (Firebase preserves it) so the JSON is
 * parsed by the handler exactly as delivered.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { qrDb } from './firestore';
import { xenditWebhookHandler } from './xenditWebhook.handler';
import { releaseQrOrder } from './releaseOrder';

const XENDIT_CALLBACK_TOKEN = defineSecret('XENDIT_CALLBACK_TOKEN');

export const xenditWebhook = onRequest({ secrets: [XENDIT_CALLBACK_TOKEN] }, async (req, res) => {
    const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

    const headers: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }

    const result = await xenditWebhookHandler(
        qrDb,
        (orderId, options) => releaseQrOrder(qrDb, orderId, options),
        { method: req.method, headers, rawBody },
        { callbackToken: XENDIT_CALLBACK_TOKEN.value() },
    );

    res.status(result.statusCode).json(result.body);
});
