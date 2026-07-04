// QR Ordering — Table Management client (Sprint 2 · admin table-management).
//
// Staff/admin-only callables (RBAC enforced server-side). listQrTables returns a
// TOKEN-OMITTING projection; getQrTableToken reveals one table's token only on
// explicit request. createQrTable mints a new table (+ its token) server-side.
// No Xendit, no inventory. Writes go through the callable (qr_tables is
// `write: if false`).

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from './qrFunctions';
import type {
    ListQrTablesInput, ListQrTablesResult,
    CreateQrTableInput, CreateQrTableResult,
    GetQrTableTokenInput, GetQrTableTokenResult,
} from '../types/qrOrder.types';

/** List a business unit's tables (never includes qrToken). */
export async function listQrTables(businessUnitId: string): Promise<ListQrTablesResult> {
    const callable = httpsCallable<ListQrTablesInput, ListQrTablesResult>(getQrFunctions(), 'listQrTables');
    const { data } = await callable({ businessUnitId });
    return data;
}

/** Create a table; the server mints the qrToken and returns it once. */
export async function createQrTable(businessUnitId: string, tableNumber: string): Promise<CreateQrTableResult> {
    const callable = httpsCallable<CreateQrTableInput, CreateQrTableResult>(getQrFunctions(), 'createQrTable');
    const { data } = await callable({ businessUnitId, tableNumber });
    return data;
}

/** Reveal a single table's qrToken (admin, on explicit request). */
export async function getQrTableToken(tableId: string): Promise<GetQrTableTokenResult> {
    const callable = httpsCallable<GetQrTableTokenInput, GetQrTableTokenResult>(getQrFunctions(), 'getQrTableToken');
    const { data } = await callable({ tableId });
    return data;
}

/** True when the callable rejected the caller's role/permission. */
export function isPermissionDenied(err: unknown): boolean {
    const code = (err as { code?: string } | null)?.code ?? '';
    return code === 'functions/permission-denied' || code === 'functions/unauthenticated';
}

/** Staff-facing message for a failed list/token read. Never leaks internal codes. */
export function toUserFacingTableError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/permission-denied':
        case 'functions/unauthenticated':
            return 'You need an admin account to manage tables.';
        case 'functions/not-found':
            return 'That table no longer exists.';
        case 'functions/invalid-argument':
            return 'Something looks off with that request. Please try again.';
        default:
            return 'Couldn’t reach table management. Please check your connection and try again.';
    }
}

/** Staff-facing message for a failed create. */
export function toUserFacingCreateError(err: unknown): string {
    const code = (err as { code?: string } | null)?.code ?? '';
    switch (code) {
        case 'functions/already-exists':
            return 'An active table with that number already exists.';
        case 'functions/not-found':
            return 'That business unit doesn’t exist.';
        case 'functions/permission-denied':
        case 'functions/unauthenticated':
            return 'You need an admin account to create tables.';
        case 'functions/invalid-argument':
            return 'Please enter a valid table number.';
        default:
            return 'Couldn’t create the table. Please try again.';
    }
}
