// QR Ordering — client for the createQrOrder Cloud Function (Sprint 2 wiring).
//
// Submits the customer's cart and creates a real `qr_orders` document at status
// AWAITING_PAYMENT / paymentStatus UNPAID. NO payment, NO Xendit, NO webhook,
// NO inventory deduction — those are later phases. Pricing is server-authoritative:
// the client-supplied unitPrice is intentionally NOT sent; the callable reprices
// every line from the server's menu_items.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from './qrFunctions';
import type {
    CreateQrOrderInput,
    CreateQrOrderLineInput,
    CreateQrOrderResult,
} from '../types/qrOrder.types';
import type { CartLine } from '../customer/CartDrawer';

export interface SubmitQrOrderArgs {
    /** The resolved `qr_tables` document id (from the getPublicMenu response) —
     *  NOT the raw QR token. createQrOrder resolves the table by document id. */
    tableId: string;
    lines: CartLine[];
    customerName?: string;
    /** Dedupe key, stable across retries of the same submit (see newIdempotencyKey). */
    idempotencyKey?: string;
}

/**
 * Generate a fresh idempotency key (8–64 of [A-Za-z0-9_-]). Prefers a crypto UUID
 * / random bytes; degrades to a timestamp+random string only if Web Crypto is
 * unavailable. The CALLER holds one key stable across retries of a single submit.
 */
export function newIdempotencyKey(): string {
    const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    if (c && typeof c.getRandomValues === 'function') {
        const bytes = c.getRandomValues(new Uint8Array(16));
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Pure map from the UI cart to the createQrOrder payload. Sends only what the
 * server needs and trusts: menu item id, quantity, and (normalized) notes.
 * Prices/names are deliberately omitted — the server reprices from menu_items.
 */
export function mapCartToOrderInput(args: SubmitQrOrderArgs): CreateQrOrderInput {
    const items: CreateQrOrderLineInput[] = args.lines.map(line => {
        const mapped: CreateQrOrderLineInput = {
            menuItemId: line.id,
            quantity: line.qty,
        };
        const note = line.note.trim();
        if (note) mapped.notes = note;
        return mapped;
    });

    const input: CreateQrOrderInput = { tableId: args.tableId, items };
    const name = args.customerName?.trim();
    if (name) input.customerName = name;
    if (args.idempotencyKey) input.idempotencyKey = args.idempotencyKey;
    return input;
}

/** Submit the cart and return the created order's id/number/total. */
export async function submitQrOrder(args: SubmitQrOrderArgs): Promise<CreateQrOrderResult> {
    const callable = httpsCallable<CreateQrOrderInput, CreateQrOrderResult>(
        getQrFunctions(),
        'createQrOrder',
    );
    const { data } = await callable(mapCartToOrderInput(args));
    return data;
}

/** Map a createQrOrder error to a diner-friendly message. Never surfaces internal
 *  error codes or ids to the client (keeps L4 closed on the client side). */
export function toUserFacingOrderError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/failed-precondition':
            return 'Some items are no longer available. Please review your cart and try again.';
        case 'functions/not-found':
            return 'We couldn’t find your table. Please rescan the QR code on your table.';
        case 'functions/invalid-argument':
            return 'Your order looks incomplete. Please review your cart and try again.';
        case 'functions/resource-exhausted':
            return 'You’re ordering very quickly. Please wait a few seconds and try again.';
        default:
            return 'We couldn’t place your order. Please check your connection and try again.';
    }
}
