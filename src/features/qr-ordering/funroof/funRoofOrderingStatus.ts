// The Fun Roof (b1) online-ordering pause switch.
//
// Client routing is fixed durably from tracked SOURCE (PAYMENTS_ENABLED_BUSINESSES
// in services/qrPaymentsGate.ts) and the server gate QR_PAYMENTS_ENABLED is now
// ON. The full path is verified up to Xendit: order -> checkout -> payment page ->
// createXenditSession — and it fails safe (never a false success).
//
// REOPENED (2026-07-11, owner P0): online ordering is unpaused for production.
// Server readiness re-verified before flipping: createXenditSession deployed,
// QR_PAYMENTS_ENABLED=true, XENDIT_SECRET_KEY + XENDIT_CALLBACK_TOKEN bound
// (Secret Manager, ENABLED), webhook remains the SOLE authority that marks PAID,
// b1 client routing true from tracked source (PAYMENTS_ENABLED_BUSINESSES), b3
// untouched. The earlier pause was the live Xendit key lacking Payment Sessions /
// Money In permission (403 REQUEST_FORBIDDEN — an owner/Xendit-dashboard fix, not
// client code); reopening was validated post-deploy with a controlled no-payment
// order that reached the Xendit hosted page. If a live session ever fails to open
// again, flip this back to `true` to re-contain. This flag is read ONLY by the
// Fun Roof module (b1); b3, POS, tables and reservations are untouched.
export const FUN_ROOF_ORDERING_PAUSED = false;

// Exact copy the owner approved for the containment block.
export const FUN_ROOF_ORDERING_PAUSED_MESSAGE =
    'Online ordering is temporarily unavailable. Please call our staff to place your order.';
