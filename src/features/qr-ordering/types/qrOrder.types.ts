import type { Timestamp } from 'firebase/firestore';

/**
 * QR Ordering — shared type contract (Sprint 1: Real Order Persistence)
 *
 * Frozen per docs/QR_SPRINT1_IMPLEMENTATION_PLAN.md §2. This is the single
 * source of truth for the `qr_orders` / `qr_tables` document shapes and the
 * callable I/O contracts. Sprint 1 only ever WRITES the `AWAITING_PAYMENT` /
 * `UNPAID` states and the fields marked "Sprint 1"; the remaining fields are
 * declared now so downstream sprints (payment, kitchen, reconciliation) build
 * against a shape that never needs a breaking migration.
 *
 * MVP boundary reminders (Master Plan A4): TNG never issues BIR invoices; the
 * `officialInvoice*` fields only STORE a number the registered POS issued.
 */

// ── Lifecycle unions (full state machine declared up-front) ──────────────
export type QrOrderStatus =
    | 'AWAITING_PAYMENT'   // ← the only status Sprint 1 writes
    | 'PAID'
    | 'IN_KITCHEN'
    | 'IN_BAR'
    | 'READY'
    | 'SERVED'
    | 'COMPLETED'
    | 'PAYMENT_FAILED'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'REFUNDED';

export type QrPaymentStatus =
    | 'UNPAID'             // ← the only paymentStatus Sprint 1 writes
    | 'AWAITING_PAYMENT'
    | 'PAID'
    | 'FAILED'
    | 'EXPIRED'
    | 'REFUNDED';

export type QrOrderType = 'DINE_IN' | 'TAKEOUT'; // TAKEOUT declared but unused in MVP (O3 = dine-in only)

// ── Line item (mirrors POSOrderItem, Master Plan §6.3 / A7) ──────────────
export interface QrOrderItem {
    menuItemId: string;
    productName: string;
    quantity: number;
    unitPrice: number;   // server-authoritative price captured at order time
    subtotal: number;    // unitPrice * quantity
    notes?: string;
    category: string;
}

// ── qr_orders/{orderId} ──────────────────────────────────────────────────
export interface QrOrder {
    id: string;
    businessUnitId: string;
    tableId: string;
    tableNumber: string;            // denormalized from qr_tables at creation (client kitchen/bar reads)
    orderNumber: string;            // via the QR counter → "QR-00001"

    items: QrOrderItem[];
    customerName?: string;
    orderType: QrOrderType;
    subtotal: number;
    taxAmount: number;              // 0 in Sprint 1 (O5 pending)
    totalAmount: number;
    currency: 'PHP';

    status: QrOrderStatus;
    paymentStatus: QrPaymentStatus;

    // Payment lifecycle (Sprint 2 — absent/null until then)
    paymentReference?: string;
    xenditPaymentSessionId?: string;
    xenditPaymentRequestId?: string;
    xenditPaymentId?: string;
    xenditChannelCode?: string;
    paidAt?: Timestamp;

    // Session-creation fields (Phase 3 · createXenditSession) — additive, written
    // by createXenditSession; never touched by the client (Admin SDK only).
    paymentLinkUrl?: string;          // hosted-checkout URL of the current session (transient)
    paymentAttempt?: number;          // increments per retry → distinct reference_id per session
    sessionExpiresAtMillis?: number;  // current session expiry (epoch ms) — drives ACTIVE-session reuse
    paymentMethodType?: string;       // set by the webhook once paid (declared now to avoid a migration)

    // Release to fulfillment (DORMANT until payment exists — written server-side
    // by the release service once a PAID order is released to the kitchen/bar).
    released?: boolean;                          // metadata: has this order been released
    releasedAt?: Timestamp;                      // metadata: when it was released
    releaseSource?: 'XENDIT_WEBHOOK' | 'MANUAL' | 'SYSTEM'; // metadata: what authorized it
    releasedBy?: string;                         // audit: uid / system id that released it
    releaseEventId?: string;                     // audit: authorizing event id (e.g. Xendit payment_id)

    // Reconciliation (Sprint 3.5 — absent until the cashier posts it)
    officialInvoiceNumber?: string;
    officialInvoicePostedAt?: Timestamp;
    officialInvoicePostedBy?: string;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ── qr_tables/{tableId} ──────────────────────────────────────────────────
export interface QrTable {
    id: string;
    businessUnitId: string;
    tableNumber: string;
    qrToken: string;                // opaque, unguessable; never regenerated in place
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ── Sanitized public menu projection (getPublicMenu output) ──────────────
// NEVER includes cost / margin / recipe fields (Master Plan §6.4).
export interface PublicMenuItemDTO {
    id: string;
    name: string;
    category: string;
    sellingPrice: number;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;           // mapped from MenuItem.isActive
}

// ── Callable I/O contracts ───────────────────────────────────────────────
export interface GetPublicMenuInput {
    /** Resolve the customer's table + business unit from the scanned QR token. */
    qrToken: string;
}

export interface GetPublicMenuResult {
    tableId: string;
    tableNumber: string;
    businessUnitId: string;
    items: PublicMenuItemDTO[];
}

export interface CreateQrOrderLineInput {
    menuItemId: string;
    quantity: number;
    notes?: string;
}

export interface CreateQrOrderInput {
    tableId: string;
    items: CreateQrOrderLineInput[];
    customerName?: string;
    /**
     * Optional client-generated dedupe key (8–64 of [A-Za-z0-9_-]). Reused
     * across retries of the same submit so a double-tap / lost-response retry
     * returns the original order instead of creating a duplicate.
     */
    idempotencyKey?: string;
}

export interface CreateQrOrderResult {
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    currency: 'PHP';
    status: QrOrderStatus;         // always 'AWAITING_PAYMENT' in Sprint 1
}

/** createXenditSession input — only the orderId; amount/price is never trusted
 *  from the client (read from the server order document). */
export interface CreateXenditSessionInput {
    orderId: string;
}

/** createXenditSession output — the hosted-checkout link the phone redirects to. */
export interface CreateXenditSessionResult {
    paymentLinkUrl: string;
    reference: string;            // the reference_id used for this session/attempt
    expiresAtMillis: number;      // session expiry (epoch ms)
}

export interface GetQrOrderInput {
    orderId: string;
}

/** Sanitized order line returned to the diner (no menuItemId / cost fields). */
export interface PublicQrOrderLine {
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    category: string;
}

/** Sanitized customer-facing order projection (getQrOrder output). Exposes the
 *  (non-sensitive) businessUnitId for branding; NEVER includes tableId / xendit* /
 *  officialInvoice* fields. */
export interface GetQrOrderResult {
    orderId: string;
    /** Venue id (e.g. 'b1' The Fun Roof, 'b3' Inflatable Island) — drives the
     *  customer pages' business branding/theme from authoritative order data. */
    businessUnitId: string;
    orderNumber: string;
    tableNumber: string;
    status: QrOrderStatus;
    paymentStatus: QrPaymentStatus;
    items: PublicQrOrderLine[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency: 'PHP';
    customerName?: string;
    createdAtMillis?: number;
}

export interface CreateQrTableInput {
    businessUnitId: string;
    tableNumber: string;
}

export interface CreateQrTableResult {
    tableId: string;
    tableNumber: string;
    qrToken: string;
}

export interface ListQrTablesInput {
    businessUnitId: string;
}

/** Token-omitting projection returned to the admin table-management UI (M3). */
export interface QrTableSummary {
    id: string;
    tableNumber: string;
    isActive: boolean;
    businessUnitId: string;
    createdAtMillis: number;
}

export interface ListQrTablesResult {
    tables: QrTableSummary[];
}

/** Reveal a single table's qrToken on explicit admin request (never in lists). */
export interface GetQrTableTokenInput {
    tableId: string;
}

export interface GetQrTableTokenResult {
    tableId: string;
    tableNumber: string;
    qrToken: string;
}
