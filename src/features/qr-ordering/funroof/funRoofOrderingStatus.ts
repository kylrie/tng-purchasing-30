// TEMPORARY P0 CONTAINMENT (2026-07-10) — The Fun Roof (b1) online-ordering pause.
//
// A live checkout on Table 1 skipped the Xendit payment step: an order (QR-00019)
// was created but never paid, and the customer was sent straight to order-status.
// Until the checkout + order-status fixes are verified, Fun Roof online ordering is
// paused AT THE SOURCE: diners can still browse the full menu and build their picks,
// but the checkout CTA is blocked with a call-staff message and NO qr_orders
// document is created (no new unpaid order, no silent redirect to order-status).
//
// SCOPE: this flag is read ONLY by the Fun Roof module (business unit b1). Inflatable
// Island (b3), the POS, tables and reservations are entirely untouched.
//
// TO LIFT: set FUN_ROOF_ORDERING_PAUSED = false, rebuild `--mode production`, and
// redeploy `hosting:production` once the payment flow is validated end-to-end.
export const FUN_ROOF_ORDERING_PAUSED = true;

// Exact copy the owner approved for the containment block.
export const FUN_ROOF_ORDERING_PAUSED_MESSAGE =
    'Online ordering is temporarily unavailable. Please call our staff to place your order.';
