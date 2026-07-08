// The Fun Roof — resolve a scanned QR token to its real table (b1).
//
// Reuses the deployed getPublicMenu callable (the same server resolver Inflatable
// Island uses) purely to turn the opaque QR token into the values the order flow
// needs: the qr_tables DOC ID (createQrOrder's `tableId`), the human tableNumber,
// and the businessUnitId. The menu itself is the curated Fun Roof snapshot, so the
// callable's `items` are intentionally ignored here — we only need the table.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from '../services/qrFunctions';
import { FUN_ROOF_BUSINESS_ID } from '../utils/customerMenuUrl';

export interface FunRoofTable {
    /** qr_tables document id — the `tableId` createQrOrder expects (NOT the token). */
    tableId: string;
    tableNumber: string;
    businessUnitId: string;
}

interface RawGetPublicMenuResponse {
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
 * Resolve a Fun Roof QR token to its table. Throws (with a callable-style `code`)
 * on not-found / inactive / transport errors, or a wrongBusiness error if the
 * token resolves to a non-Fun-Roof business.
 */
export async function resolveFunRoofTable(qrToken: string): Promise<FunRoofTable> {
    const callable = httpsCallable<{ qrToken: string }, RawGetPublicMenuResponse>(
        getQrFunctions(),
        'getPublicMenu',
    );
    const { data } = await callable({ qrToken });
    if (data.businessUnitId !== FUN_ROOF_BUSINESS_ID) {
        throw { code: 'functions/failed-precondition', wrongBusiness: true };
    }
    return { tableId: data.tableId, tableNumber: data.tableNumber, businessUnitId: data.businessUnitId };
}
