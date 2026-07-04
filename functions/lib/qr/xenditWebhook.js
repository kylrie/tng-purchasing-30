"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.xenditWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("./firestore");
const xenditWebhook_handler_1 = require("./xenditWebhook.handler");
const releaseOrder_1 = require("./releaseOrder");
const XENDIT_CALLBACK_TOKEN = (0, params_1.defineSecret)('XENDIT_CALLBACK_TOKEN');
exports.xenditWebhook = (0, https_1.onRequest)({ secrets: [XENDIT_CALLBACK_TOKEN] }, async (req, res) => {
    const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }
    const result = await (0, xenditWebhook_handler_1.xenditWebhookHandler)(firestore_1.qrDb, (orderId, options) => (0, releaseOrder_1.releaseQrOrder)(firestore_1.qrDb, orderId, options), { method: req.method, headers, rawBody }, { callbackToken: XENDIT_CALLBACK_TOKEN.value() });
    res.status(result.statusCode).json(result.body);
});
//# sourceMappingURL=xenditWebhook.js.map