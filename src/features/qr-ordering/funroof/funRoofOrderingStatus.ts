// The Fun Roof (b1) online-ordering pause switch.
//
// History: a 2026-07-10 live checkout (QR-00019) created an unpaid order but
// skipped Xendit because a stale build baked the b1 payment gate to false. That
// root cause is now fixed durably — b1 checkout routing is enabled from tracked
// SOURCE (see PAYMENTS_ENABLED_BUSINESSES in services/qrPaymentsGate.ts), so no
// build can silently skip Xendit for the Fun Roof — and ordering is RE-OPENED.
//
// Flip back to `true` to instantly pause Fun Roof online ordering again (browse
// stays available; the checkout CTA becomes a call-staff notice and no qr_orders
// doc is created). This flag is read ONLY by the Fun Roof module (b1); Inflatable
// Island (b3), the POS, tables and reservations are untouched.
export const FUN_ROOF_ORDERING_PAUSED = false;

// Exact copy the owner approved for the containment block.
export const FUN_ROOF_ORDERING_PAUSED_MESSAGE =
    'Online ordering is temporarily unavailable. Please call our staff to place your order.';
