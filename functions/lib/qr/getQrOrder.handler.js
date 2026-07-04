"use strict";
/**
 * getQrOrder — core handler (Sprint 2 · customer order-status read)
 *
 * Resolves an order by its (unguessable, auto-id) orderId and returns a
 * SANITIZED customer-facing projection so a diner can watch their own order
 * without a login. The Admin SDK reads server-side, so firestore.rules stays
 * staff-only (Master Plan §6.4 / A9) — customers never read `qr_orders` directly
 * (the rule requires signed-in, same-BU staff).
 *
 * Whitelisted projection: never returns businessUnitId, tableId, xendit* or
 * officialInvoice* fields. db is injected for testing; the onCall wrapper passes
 * the real `qrDb`. Read-only — no writes, no payment, no kitchen transitions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQrOrderHandler = getQrOrderHandler;
const https_1 = require("firebase-functions/v2/https");
const rateLimit_1 = require("./rateLimit");
/** Whitelist a stored order line to the customer-facing shape. Cost/margin/recipe
 *  fields are never stored on order lines, but we still copy only known keys. */
function sanitizeLine(raw) {
    const line = {
        productName: typeof raw.productName === 'string' ? raw.productName : '',
        quantity: Number(raw.quantity ?? 0),
        unitPrice: Number(raw.unitPrice ?? 0),
        subtotal: Number(raw.subtotal ?? 0),
        category: typeof raw.category === 'string' ? raw.category : '',
    };
    if (typeof raw.notes === 'string' && raw.notes.length > 0)
        line.notes = raw.notes;
    return line;
}
async function getQrOrderHandler(db, request) {
    const orderId = request.data?.orderId;
    if (typeof orderId !== 'string' || orderId.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', 'orderId is required');
    }
    const id = orderId.trim();
    // 1. Resolve the order. A bogus id fails here — before any rate-limit doc is
    //    created — so the rate-limit collection stays bounded to real orders.
    const orderSnap = await db.collection('qr_orders').doc(id).get();
    if (!orderSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Order not found');
    }
    const order = orderSnap.data();
    // 2. Rate limit per real order (bounded — bogus ids fail above first).
    await (0, rateLimit_1.enforceRateLimit)(db, `order-read:${id}`, rateLimit_1.MENU_READ_LIMIT);
    // 3. Best-effort table-number lookup (the order stores tableId, not number).
    let tableNumber = '';
    const tableId = typeof order.tableId === 'string' ? order.tableId : '';
    if (tableId) {
        const tableSnap = await db.collection('qr_tables').doc(tableId).get();
        if (tableSnap.exists) {
            const table = tableSnap.data();
            if (typeof table.tableNumber === 'string')
                tableNumber = table.tableNumber;
        }
    }
    const rawItems = Array.isArray(order.items) ? order.items : [];
    const dto = {
        orderId: id,
        orderNumber: typeof order.orderNumber === 'string' ? order.orderNumber : '',
        tableNumber,
        status: typeof order.status === 'string' ? order.status : '',
        paymentStatus: typeof order.paymentStatus === 'string' ? order.paymentStatus : '',
        items: rawItems.map(sanitizeLine),
        subtotal: Number(order.subtotal ?? 0),
        taxAmount: Number(order.taxAmount ?? 0),
        totalAmount: Number(order.totalAmount ?? 0),
        currency: typeof order.currency === 'string' ? order.currency : 'PHP',
    };
    if (typeof order.customerName === 'string' && order.customerName.length > 0) {
        dto.customerName = order.customerName;
    }
    const createdAt = order.createdAt;
    if (createdAt && typeof createdAt.toMillis === 'function') {
        dto.createdAtMillis = createdAt.toMillis();
    }
    return dto;
}
//# sourceMappingURL=getQrOrder.handler.js.map