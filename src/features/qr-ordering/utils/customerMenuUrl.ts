// QR Ordering — public customer-menu URL for a table's QR code.
//
// The Fun Roof (business unit b1) has its own standalone customer menu module at
// /funroof/<qrToken> (see features/qr-ordering/funroof). Like every other business
// it is TOKEN-based: the token resolves to the real table + business server-side
// (getPublicMenu), which the Fun Roof order flow needs to create orders. It differs
// from other businesses only in the route prefix (/funroof vs /order) and its
// curated menu/branding. Every other business uses /order/<qrToken>
// (features/qr-ordering/customer/CustomerMenuView).
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
 * Build the public customer-menu URL a table's QR code should encode (token-based).
 * - Fun Roof (b1): `${origin}/funroof/<qrToken>`.
 * - Everyone else: `${origin}/order/<qrToken>`.
 * Returns '' when the token isn't available yet.
 */
export function buildCustomerMenuUrl(
    origin: string,
    businessUnitId: string | undefined | null,
    _tableNumber: string,
    qrToken: string,
): string {
    if (!qrToken) return '';
    const prefix = isFunRoofQrBusiness(businessUnitId) ? '/funroof/' : '/order/';
    return `${origin}${prefix}${encodeURIComponent(qrToken)}`;
}
