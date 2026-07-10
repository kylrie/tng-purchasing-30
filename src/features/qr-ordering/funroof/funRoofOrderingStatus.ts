// The Fun Roof (b1) online-ordering pause switch.
//
// Client routing is fixed durably from tracked SOURCE (PAYMENTS_ENABLED_BUSINESSES
// in services/qrPaymentsGate.ts) and the server gate QR_PAYMENTS_ENABLED is now
// ON. The full path is verified up to Xendit: order -> checkout -> payment page ->
// createXenditSession — and it fails safe (never a false success).
//
// RE-PAUSED (2026-07-10): with the gate ON, createXenditSession stopped returning
// FAILED_PRECONDITION but now fails at the Xendit API call itself with 500
// INTERNAL ("Could not start the payment"). Xendit cannot open, so ordering is
// paused pending an infra fix (most likely the enabled XENDIT_SECRET_KEY version /
// live-key activation — a server/owner action, not client code). Reopen by
// flipping to `false` AFTER a live createXenditSession succeeds. This flag is read
// ONLY by the Fun Roof module (b1); b3, POS, tables and reservations are untouched.
export const FUN_ROOF_ORDERING_PAUSED = true;

// Exact copy the owner approved for the containment block.
export const FUN_ROOF_ORDERING_PAUSED_MESSAGE =
    'Online ordering is temporarily unavailable. Please call our staff to place your order.';
