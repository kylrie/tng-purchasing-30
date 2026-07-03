/**
 * getPublicMenu — Callable Cloud Function (Sprint 1 · MOCK-FREE, real Firestore)
 *
 * Resolves a scanned table QR token to its table + business unit, then returns
 * the SANITIZED public menu for that BU. No auth required (customers are
 * anonymous) — the Admin SDK reads server-side, so firestore.rules is never
 * touched by the customer path (Master Plan §6.4 / A9).
 *
 * Hard rule: the response is a whitelisted projection — cost/margin/recipe
 * fields are never read into it (sanitizeMenuItem in orderLogic.ts).
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { qrDb as db } from './firestore';
import { sanitizeMenuItem, RawMenuItem } from './orderLogic';

interface GetPublicMenuInput {
    qrToken?: string;
}

export const getPublicMenu = onCall(async (request: CallableRequest<GetPublicMenuInput>) => {
    const qrToken = request.data?.qrToken;
    if (typeof qrToken !== 'string' || qrToken.trim() === '') {
        throw new HttpsError('invalid-argument', 'qrToken is required');
    }

    // 1. Resolve the table from the opaque token.
    const tableSnap = await db.collection('qr_tables').where('qrToken', '==', qrToken).limit(1).get();
    if (tableSnap.empty) {
        throw new HttpsError('not-found', 'Table not found');
    }
    const tableDoc = tableSnap.docs[0];
    const table = tableDoc.data();
    if (table.isActive !== true) {
        throw new HttpsError('failed-precondition', 'This table is not currently active');
    }
    const businessUnitId: string = table.businessUnitId;

    // 2. Read the BU's menu items and sanitize. We fetch active items only.
    const menuSnap = await db
        .collection('menu_items')
        .where('businessUnitId', '==', businessUnitId)
        .where('isActive', '==', true)
        .get();

    const items = menuSnap.docs.map(doc => {
        const raw = { id: doc.id, ...(doc.data() as Omit<RawMenuItem, 'id'>) } as RawMenuItem;
        return sanitizeMenuItem(raw);
    });

    return {
        tableId: tableDoc.id,
        tableNumber: table.tableNumber,
        businessUnitId,
        items,
    };
});
