// QR Operations — client for the updateQrOrderStatus callable (kitchen transitions).
//
// `qr_orders` is `write: if false`, so the ONLY way staff advance an order is
// through this callable (server validates role, BU scope, and the legal forward
// transition). No local-only status state — the UI reflects the live onSnapshot
// after the write lands.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from './qrFunctions';

export interface UpdateQrOrderStatusInput {
    orderId: string;
    toStatus: string;
}

export interface UpdateQrOrderStatusResult {
    orderId: string;
    status: string;
    changed: boolean;
}

/** The single legal forward step for each status (mirrors the server NEXT_STATUS).
 *  Used only to label/enable the action button; the SERVER is authoritative. */
export const NEXT_STATUS: Record<string, string> = {
    PAID: 'IN_KITCHEN',
    IN_KITCHEN: 'READY',
    READY: 'SERVED',
    SERVED: 'COMPLETED',
};

/** Advance an order to the given status. Rejects (server-side) on any illegal
 *  transition / role / BU violation. */
export async function updateQrOrderStatus(orderId: string, toStatus: string): Promise<UpdateQrOrderStatusResult> {
    const callable = httpsCallable<UpdateQrOrderStatusInput, UpdateQrOrderStatusResult>(
        getQrFunctions(),
        'updateQrOrderStatus',
    );
    const { data } = await callable({ orderId, toStatus });
    return data;
}

/** Diner/staff-safe message for a failed transition (never leaks internal codes). */
export function toUserFacingTransitionError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/failed-precondition':
            return 'That order can’t move to that stage right now. Refresh and try again.';
        case 'functions/permission-denied':
            return 'You don’t have permission to update this order.';
        case 'functions/unauthenticated':
            return 'Please sign in again to update orders.';
        case 'functions/not-found':
            return 'That order no longer exists.';
        default:
            return 'Couldn’t update the order. Please try again.';
    }
}
