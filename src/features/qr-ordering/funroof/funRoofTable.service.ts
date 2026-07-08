// The Fun Roof — resolve a scanned QR token to its real table (b1).
//
// Reuses the deployed getPublicMenu callable (the same server resolver Inflatable
// Island uses) purely to turn the opaque QR token into the values the order flow
// needs: the qr_tables DOC ID (createQrOrder's `tableId`), the human tableNumber,
// and the businessUnitId. The menu itself is the curated Fun Roof snapshot, so the
// callable's `items` are intentionally ignored here — we only need the table.
//
// The pure b1 guard lives in funRoofTableGuard.ts (firebase-free, unit-tested);
// it is re-exported here so existing importers keep a single entry point.

import { httpsCallable } from 'firebase/functions';
import { getQrFunctions } from '../services/qrFunctions';
import {
    toFunRoofTable, isWrongBusinessError,
    type FunRoofTable, type RawGetPublicMenuResponse,
} from './funRoofTableGuard';

export { isWrongBusinessError };
export type { FunRoofTable };

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
    return toFunRoofTable(data);
}
