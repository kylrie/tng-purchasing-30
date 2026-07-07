/**
 * QR Ordering — pure, framework-free logic (Sprint 1)
 *
 * No firebase-admin / firebase-functions imports here on purpose: everything
 * in this file is deterministic and unit-testable in isolation (see
 * orderLogic.test.ts). The callable wrappers (getPublicMenu / createQrOrder /
 * createQrTable) do the I/O and delegate every business rule to this module.
 */

// ── Minimal shapes read from Firestore (only the fields we actually use) ──
export interface RawMenuItem {
    id: string;
    businessUnitId: string;
    name: string;
    category: string;
    sellingPrice: number;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
    // cost/margin/recipe fields intentionally NOT modelled here — the whole
    // point is that this module can never leak them.
}

export interface PublicMenuItemDTO {
    id: string;
    name: string;
    category: string;
    sellingPrice: number;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
}

export interface OrderLineInput {
    menuItemId: string;
    quantity: number;
    notes?: string;
}

export interface PricedLine {
    menuItemId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    category: string;
}

export interface OrderTotals {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
}

export const MAX_CUSTOMER_NAME_LEN = 80;
export const MAX_NOTE_LEN = 120;
export const MAX_LINES = 50;
export const MAX_QTY_PER_LINE = 99;
export const ORDER_NUMBER_PAD = 5;

/**
 * Client-supplied idempotency key (a.k.a. clientRequestId): 8–64 chars of
 * URL/doc-id-safe characters. A UUID (36 chars) or a 32-char hex string both
 * qualify. Deliberately excludes ':' and '/' so it composes safely into the
 * `${tableId}:${key}` idempotency document id.
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Sanitized customer-facing projection of a menu item. Explicitly whitelists
 * fields — cost/margin/recipe can never appear because they are not read.
 * `isActive` (menu on/off) maps to the customer-facing `isAvailable`.
 */
export function sanitizeMenuItem(raw: RawMenuItem): PublicMenuItemDTO {
    const dto: PublicMenuItemDTO = {
        id: raw.id,
        name: raw.name,
        category: raw.category,
        sellingPrice: raw.sellingPrice,
        isAvailable: raw.isActive === true,
    };
    if (raw.description !== undefined) dto.description = raw.description;
    if (raw.imageUrl !== undefined) dto.imageUrl = raw.imageUrl;
    return dto;
}

/** Round to 2 decimals without binary-float drift (e.g. 0.1+0.2). */
export function money(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Re-price a single line from the SERVER's menu item — the client-submitted
 * price (if any) is never trusted. Throws a typed error string on any bad ref.
 */
export function repriceLine(
    line: OrderLineInput,
    menuItem: RawMenuItem | undefined,
    expectedBusinessUnitId: string,
): PricedLine {
    if (!menuItem) throw new Error(`MENU_ITEM_NOT_FOUND:${line.menuItemId}`);
    if (menuItem.businessUnitId !== expectedBusinessUnitId) {
        throw new Error(`MENU_ITEM_WRONG_BU:${line.menuItemId}`);
    }
    if (menuItem.isActive !== true) throw new Error(`MENU_ITEM_UNAVAILABLE:${line.menuItemId}`);
    if (!Number.isFinite(menuItem.sellingPrice) || menuItem.sellingPrice < 0) {
        throw new Error(`MENU_ITEM_BAD_PRICE:${line.menuItemId}`);
    }

    const priced: PricedLine = {
        menuItemId: menuItem.id,
        productName: menuItem.name,
        quantity: line.quantity,
        unitPrice: menuItem.sellingPrice,
        subtotal: money(menuItem.sellingPrice * line.quantity),
        category: menuItem.category,
    };
    const note = normalizeNote(line.notes);
    if (note) priced.notes = note;
    return priced;
}

/** Sprint 1 tax = 0 pending O5 (VAT display decision). */
export function computeOrderTotals(lines: PricedLine[]): OrderTotals {
    const subtotal = money(lines.reduce((sum, l) => sum + l.subtotal, 0));
    const taxAmount = 0;
    return { subtotal, taxAmount, totalAmount: money(subtotal + taxAmount) };
}

export function formatOrderNumber(nextValue: number, prefix = 'QR', pad = ORDER_NUMBER_PAD): string {
    return `${prefix}-${String(nextValue).padStart(pad, '0')}`;
}

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Encode random bytes to a base62 token. Pure: the randomness source is
 * injected so this is deterministic under test. Never derived from the table
 * number or any guessable sequence (plan §2.2).
 */
export function encodeQrToken(bytes: Uint8Array | number[]): string {
    let out = '';
    for (const b of bytes) out += BASE62[b % 62];
    return out;
}

export function normalizeNote(note: string | undefined): string | undefined {
    if (typeof note !== 'string') return undefined;
    const trimmed = note.trim().slice(0, MAX_NOTE_LEN);
    return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeCustomerName(name: unknown): string | undefined {
    if (typeof name !== 'string') return undefined;
    const trimmed = name.trim().slice(0, MAX_CUSTOMER_NAME_LEN);
    return trimmed.length > 0 ? trimmed : undefined;
}

export interface ValidatedOrderInput {
    tableId: string;
    lines: OrderLineInput[];
    customerName?: string;
    /** Optional client-supplied dedupe key (idempotencyKey / clientRequestId). */
    idempotencyKey?: string;
}

/**
 * Validate the raw callable payload shape (not business rules — those need the
 * server's menu data). Returns a normalized input or throws a typed error.
 */
export function validateCreateOrderInput(raw: unknown): ValidatedOrderInput {
    if (typeof raw !== 'object' || raw === null) throw new Error('INVALID_INPUT:not-an-object');
    const data = raw as Record<string, unknown>;

    if (typeof data.tableId !== 'string' || data.tableId.trim() === '') {
        throw new Error('INVALID_INPUT:tableId');
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('INVALID_INPUT:items-empty');
    }
    if (data.items.length > MAX_LINES) throw new Error('INVALID_INPUT:too-many-lines');

    const lines: OrderLineInput[] = data.items.map((item, i) => {
        if (typeof item !== 'object' || item === null) throw new Error(`INVALID_INPUT:item-${i}`);
        const it = item as Record<string, unknown>;
        if (typeof it.menuItemId !== 'string' || it.menuItemId.trim() === '') {
            throw new Error(`INVALID_INPUT:item-${i}-menuItemId`);
        }
        if (!Number.isInteger(it.quantity) || (it.quantity as number) < 1 || (it.quantity as number) > MAX_QTY_PER_LINE) {
            throw new Error(`INVALID_INPUT:item-${i}-quantity`);
        }
        const line: OrderLineInput = { menuItemId: it.menuItemId, quantity: it.quantity as number };
        const note = normalizeNote(it.notes as string | undefined);
        if (note) line.notes = note;
        return line;
    });

    const result: ValidatedOrderInput = { tableId: data.tableId, lines };
    const customerName = normalizeCustomerName(data.customerName);
    if (customerName) result.customerName = customerName;

    // Optional idempotency key — accept either `idempotencyKey` or `clientRequestId`.
    const rawKey = data.idempotencyKey ?? data.clientRequestId;
    if (rawKey !== undefined && rawKey !== null) {
        if (typeof rawKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(rawKey)) {
            throw new Error('INVALID_INPUT:idempotencyKey');
        }
        result.idempotencyKey = rawKey;
    }
    return result;
}
