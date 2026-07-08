// The Fun Roof — PURE token→table guard (no firebase imports, so it is unit
// testable in the node runner). The service module (funRoofTable.service.ts)
// wires this to the deployed getPublicMenu callable and re-exports it.

import { FUN_ROOF_BUSINESS_ID } from '../utils/customerMenuUrl';

export interface FunRoofTable {
    /** qr_tables document id — the `tableId` createQrOrder expects (NOT the token). */
    tableId: string;
    tableNumber: string;
    businessUnitId: string;
}

export interface RawGetPublicMenuResponse {
    tableId: string;
    tableNumber: string;
    businessUnitId: string;
}

/** Error thrown when a scanned token belongs to a DIFFERENT business — it must
 *  never open the Fun Roof experience with someone else's table. */
export function isWrongBusinessError(err: unknown): boolean {
    return (err as { wrongBusiness?: boolean } | null)?.wrongBusiness === true;
}

/**
 * Pure: map a resolved getPublicMenu response to a Fun Roof table, enforcing the
 * b1 guard. A token that resolves to any OTHER business throws a wrongBusiness
 * error — it must NEVER silently fall back to (or open) another business's table
 * (e.g. Inflatable / b3).
 */
export function toFunRoofTable(data: RawGetPublicMenuResponse): FunRoofTable {
    if (data.businessUnitId !== FUN_ROOF_BUSINESS_ID) {
        throw { code: 'functions/failed-precondition', wrongBusiness: true };
    }
    return { tableId: data.tableId, tableNumber: data.tableNumber, businessUnitId: data.businessUnitId };
}
