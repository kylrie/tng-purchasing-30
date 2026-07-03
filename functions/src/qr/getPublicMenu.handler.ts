/**
 * getPublicMenu — core handler (Sprint 1 · testability extraction)
 *
 * Resolves a table QR token → table/BU, then returns the SANITIZED public menu.
 * db is injected for testing; the onCall wrapper passes the real `qrDb`.
 * Hard rule (Master Plan §6.4): the response is a whitelisted projection —
 * cost/margin/recipe fields are never read into it.
 */

import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { Firestore } from 'firebase-admin/firestore';
import { sanitizeMenuItem, RawMenuItem } from './orderLogic';

export interface GetPublicMenuInput {
    qrToken?: string;
}

export async function getPublicMenuHandler(db: Firestore, request: CallableRequest<GetPublicMenuInput>) {
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
    const table = tableDoc.data() as { isActive: boolean; businessUnitId: string; tableNumber: string };
    if (table.isActive !== true) {
        throw new HttpsError('failed-precondition', 'This table is not currently active');
    }
    const businessUnitId: string = table.businessUnitId;

    // 2. Read the BU's active menu items and sanitize.
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
}
