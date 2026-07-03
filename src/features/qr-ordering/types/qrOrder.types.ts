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
}

export interface CreateQrOrderResult {
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    currency: 'PHP';
    status: QrOrderStatus;         // always 'AWAITING_PAYMENT' in Sprint 1
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
}

export interface ListQrTablesResult {
    tables: QrTableSummary[];
}
