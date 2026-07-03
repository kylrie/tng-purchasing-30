"use strict";
/**
 * QR Ordering — pure, framework-free logic (Sprint 1)
 *
 * No firebase-admin / firebase-functions imports here on purpose: everything
 * in this file is deterministic and unit-testable in isolation (see
 * orderLogic.test.ts). The callable wrappers (getPublicMenu / createQrOrder /
 * createQrTable) do the I/O and delegate every business rule to this module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_NUMBER_PAD = exports.MAX_QTY_PER_LINE = exports.MAX_LINES = exports.MAX_NOTE_LEN = exports.MAX_CUSTOMER_NAME_LEN = void 0;
exports.sanitizeMenuItem = sanitizeMenuItem;
exports.money = money;
exports.repriceLine = repriceLine;
exports.computeOrderTotals = computeOrderTotals;
exports.formatOrderNumber = formatOrderNumber;
exports.encodeQrToken = encodeQrToken;
exports.normalizeNote = normalizeNote;
exports.normalizeCustomerName = normalizeCustomerName;
exports.validateCreateOrderInput = validateCreateOrderInput;
exports.MAX_CUSTOMER_NAME_LEN = 80;
exports.MAX_NOTE_LEN = 120;
exports.MAX_LINES = 50;
exports.MAX_QTY_PER_LINE = 99;
exports.ORDER_NUMBER_PAD = 5;
/**
 * Sanitized customer-facing projection of a menu item. Explicitly whitelists
 * fields — cost/margin/recipe can never appear because they are not read.
 * `isActive` (menu on/off) maps to the customer-facing `isAvailable`.
 */
function sanitizeMenuItem(raw) {
    const dto = {
        id: raw.id,
        name: raw.name,
        category: raw.category,
        sellingPrice: raw.sellingPrice,
        isAvailable: raw.isActive === true,
    };
    if (raw.description !== undefined)
        dto.description = raw.description;
    if (raw.imageUrl !== undefined)
        dto.imageUrl = raw.imageUrl;
    return dto;
}
/** Round to 2 decimals without binary-float drift (e.g. 0.1+0.2). */
function money(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
/**
 * Re-price a single line from the SERVER's menu item — the client-submitted
 * price (if any) is never trusted. Throws a typed error string on any bad ref.
 */
function repriceLine(line, menuItem, expectedBusinessUnitId) {
    if (!menuItem)
        throw new Error(`MENU_ITEM_NOT_FOUND:${line.menuItemId}`);
    if (menuItem.businessUnitId !== expectedBusinessUnitId) {
        throw new Error(`MENU_ITEM_WRONG_BU:${line.menuItemId}`);
    }
    if (menuItem.isActive !== true)
        throw new Error(`MENU_ITEM_UNAVAILABLE:${line.menuItemId}`);
    if (!Number.isFinite(menuItem.sellingPrice) || menuItem.sellingPrice < 0) {
        throw new Error(`MENU_ITEM_BAD_PRICE:${line.menuItemId}`);
    }
    const priced = {
        menuItemId: menuItem.id,
        productName: menuItem.name,
        quantity: line.quantity,
        unitPrice: menuItem.sellingPrice,
        subtotal: money(menuItem.sellingPrice * line.quantity),
        category: menuItem.category,
    };
    const note = normalizeNote(line.notes);
    if (note)
        priced.notes = note;
    return priced;
}
/** Sprint 1 tax = 0 pending O5 (VAT display decision). */
function computeOrderTotals(lines) {
    const subtotal = money(lines.reduce((sum, l) => sum + l.subtotal, 0));
    const taxAmount = 0;
    return { subtotal, taxAmount, totalAmount: money(subtotal + taxAmount) };
}
function formatOrderNumber(nextValue, prefix = 'QR', pad = exports.ORDER_NUMBER_PAD) {
    return `${prefix}-${String(nextValue).padStart(pad, '0')}`;
}
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/**
 * Encode random bytes to a base62 token. Pure: the randomness source is
 * injected so this is deterministic under test. Never derived from the table
 * number or any guessable sequence (plan §2.2).
 */
function encodeQrToken(bytes) {
    let out = '';
    for (const b of bytes)
        out += BASE62[b % 62];
    return out;
}
function normalizeNote(note) {
    if (typeof note !== 'string')
        return undefined;
    const trimmed = note.trim().slice(0, exports.MAX_NOTE_LEN);
    return trimmed.length > 0 ? trimmed : undefined;
}
function normalizeCustomerName(name) {
    if (typeof name !== 'string')
        return undefined;
    const trimmed = name.trim().slice(0, exports.MAX_CUSTOMER_NAME_LEN);
    return trimmed.length > 0 ? trimmed : undefined;
}
/**
 * Validate the raw callable payload shape (not business rules — those need the
 * server's menu data). Returns a normalized input or throws a typed error.
 */
function validateCreateOrderInput(raw) {
    if (typeof raw !== 'object' || raw === null)
        throw new Error('INVALID_INPUT:not-an-object');
    const data = raw;
    if (typeof data.tableId !== 'string' || data.tableId.trim() === '') {
        throw new Error('INVALID_INPUT:tableId');
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('INVALID_INPUT:items-empty');
    }
    if (data.items.length > exports.MAX_LINES)
        throw new Error('INVALID_INPUT:too-many-lines');
    const lines = data.items.map((item, i) => {
        if (typeof item !== 'object' || item === null)
            throw new Error(`INVALID_INPUT:item-${i}`);
        const it = item;
        if (typeof it.menuItemId !== 'string' || it.menuItemId.trim() === '') {
            throw new Error(`INVALID_INPUT:item-${i}-menuItemId`);
        }
        if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > exports.MAX_QTY_PER_LINE) {
            throw new Error(`INVALID_INPUT:item-${i}-quantity`);
        }
        const line = { menuItemId: it.menuItemId, quantity: it.quantity };
        const note = normalizeNote(it.notes);
        if (note)
            line.notes = note;
        return line;
    });
    const result = { tableId: data.tableId, lines };
    const customerName = normalizeCustomerName(data.customerName);
    if (customerName)
        result.customerName = customerName;
    return result;
}
//# sourceMappingURL=orderLogic.js.map