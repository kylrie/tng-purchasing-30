// QR Ordering — public customer-menu URL for a table's QR code.
//
// The Fun Roof (business unit b1) has a STANDALONE, browse-only customer menu at
// /funroof/<tableNumber> (see features/qr-ordering/funroof). It is deliberately NOT
// part of the token-based ordering flow, so its QR links carry the human-readable
// table number directly (no order/payment, nothing private to protect). Every other
// business uses the shared token-based ordering route /order/<qrToken>
// (features/qr-ordering/customer/CustomerMenuView), which resolves the token to the
// business + menu server-side.
//
// This is the single source of truth for "what URL does a table's QR encode?" —
// TableManagementView builds the QR/customer link from it.

/** Business unit whose QR tables open the standalone Fun Roof menu module. */
export const FUN_ROOF_BUSINESS_ID = 'b1';

/** True when a business unit uses the standalone Fun Roof customer menu. */
export function isFunRoofQrBusiness(businessUnitId: string | undefined | null): boolean {
    return businessUnitId === FUN_ROOF_BUSINESS_ID;
}

/**
 * Build the public customer-menu URL a table's QR code should encode.
 * - Fun Roof (b1): `${origin}/funroof/<tableNumber>` (browse-only; no token needed).
 * - Everyone else: `${origin}/order/<qrToken>` (token-based ordering flow).
 * Returns '' when the required input for the chosen route is missing.
 */
export function buildCustomerMenuUrl(
    origin: string,
    businessUnitId: string | undefined | null,
    tableNumber: string,
    qrToken: string,
): string {
    if (isFunRoofQrBusiness(businessUnitId)) {
        return tableNumber ? `${origin}/funroof/${encodeURIComponent(tableNumber)}` : '';
    }
    return qrToken ? `${origin}/order/${qrToken}` : '';
}
