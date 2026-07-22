"use strict";
/**
 * QR Ordering — payment-method → Xendit channel resolution (server authority).
 *
 * The branded checkout lets the diner pick ONE method (gcash / maya / qrph / card)
 * BEFORE leaving for Xendit. We carry that choice into the Payment Session via
 * `allowed_payment_channels` so the hosted page opens straight into the chosen
 * channel instead of asking the customer to pick again ("no duplicate customer
 * actions"). `allowed_payment_channels` is the documented mechanism on the
 * `/sessions` API (docs.xendit.co/apidocs/create-session): "Specify the list of
 * payment channels for your customer to select from the Xendit Hosted Checkout
 * page." Restricting it to the single chosen channel is the narrowest supported
 * behaviour — Xendit does not expose a deeper "open this exact channel" field on
 * this API version, so a one-element allowlist is the correct fit.
 *
 * SERVER AUTHORITY: the browser never sends a raw Xendit channel code. It sends
 * one of the fixed tokens below; the server maps it to the PH channel code. A
 * non-blank unknown token is REJECTED (invalid). A missing/blank token falls back
 * to the unrestricted hosted checkout (all channels) — preserving prior behaviour
 * for any caller that does not send a method (e.g. the Inflatable flow today).
 *
 * PH channel codes confirmed against the Xendit payment-channels reference
 * (allowed_payment_channels enum): GCASH / PAYMAYA / QRPH / CARDS.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_METHOD_CHANNEL = void 0;
exports.resolveAllowedPaymentChannels = resolveAllowedPaymentChannels;
/** Canonical client method token → Xendit PH channel code (allowed_payment_channels). */
exports.PAYMENT_METHOD_CHANNEL = {
    gcash: 'GCASH',
    maya: 'PAYMAYA',
    qrph: 'QRPH',
    card: 'CARDS',
};
/**
 * Pure: resolve a client-supplied payment-method token to a channel restriction.
 * Never throws — the handler maps `invalid` to an HttpsError('invalid-argument').
 */
function resolveAllowedPaymentChannels(method) {
    if (method === undefined || method === null)
        return { kind: 'all' };
    if (typeof method !== 'string')
        return { kind: 'invalid' };
    const key = method.trim().toLowerCase();
    if (key === '')
        return { kind: 'all' };
    const code = exports.PAYMENT_METHOD_CHANNEL[key];
    if (!code)
        return { kind: 'invalid' };
    return { kind: 'restricted', channels: [code] };
}
//# sourceMappingURL=paymentChannel.js.map